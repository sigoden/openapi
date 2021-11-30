import Koa, { ParameterizedContext, DefaultState, Middleware, Next } from "koa";
import {
  createAjv,
  AjvErrorObject,
  Operation,
  createReqValiateFn,
} from "use-openapi";
import Router from "@koa/router";

export interface KisaHandlers<S> {
  [k: string]: (ctx: ParameterizedContext<S>, next?: Next) => Promise<void>;
}

export interface KisaMiddlewares<S> {
  [k: string]: Middleware<S>;
}

export interface KisaSecurityHandlers<S> {
  [k: string]: (config: string[]) => Middleware<S>;
}

export { Middleware as KisaMiddleware, Koa, Router, Operation };

export interface kisaConfig<H, M, S> {
  prefix?: string;
  handlers: H;
  middlewares?: M;
  securityHandlers?: S;
  hook?: (ctx: ParameterizedContext<S>, operation: Operation) => Promise<void>;
  operations: Operation[];
  errorHandlers: {
    routes: (error: RoutesError) => void;
    validate: (errors: AjvErrorObject[]) => void;
  };
}

export type KisaHandler<D, T> = (
  ctx: ParameterizedContext<D> & { kisa: T }
) => Promise<void>;

export default function useKisa<
  T extends DefaultState,
  H extends KisaHandlers<T>,
  M extends KisaMiddlewares<T>,
  S extends KisaSecurityHandlers<T>
>(kisa: Partial<kisaConfig<H, M, S>> = {}) {
  const mountKisa = async (router: Router) => {
    const missHandlers = [];
    const missMiddlewares = new Set<string>();
    const missSecurityHandlers = new Set<string>();
    const prefix = sanitizePrefix(kisa.prefix);
    const ajv = createAjv();

    for (const operation of kisa.operations) {
      const { method, operationId, path, security, xProps, reqSchema } =
        operation;
      let mountable = true;
      const handler = (kisa.handlers || {})[operation.operationId];
      if (!handler) {
        missHandlers.push({ method, operationId, path });
        mountable = false;
      }

      const mountMiddlewares = [];

      const xMids = xProps["x-middlewares"];
      if (Array.isArray(xMids)) {
        for (const name of xMids) {
          const middleware = (kisa.middlewares || {})[name];
          if (!middleware) {
            missMiddlewares.add(name);
            mountable = false;
          }
          mountMiddlewares.push(middleware);
        }
      }

      const securityInfo = getSecurityInfo(security);
      if (securityInfo) {
        const { name, config } = securityInfo;
        const securityHandler = (kisa.securityHandlers || {})[name];
        if (!securityHandler) {
          missSecurityHandlers.add(name);
          mountable = false;
          continue;
        }
        mountMiddlewares.push(securityHandler(config));
      }

      if (!mountable) continue;

      const validate = createReqValiateFn(ajv, reqSchema);
      router[operation.method](
        concatPath(prefix, operation.path),
        ...mountMiddlewares,
        async (ctx: Koa.Context) => {
          if (kisa.hook) await kisa.hook(ctx, operation);
          if (ctx.response.body) return;
          const { request, params, headers, query } = ctx;
          const { body } = request;
          const req = { params, headers, query, body };
          const errors = validate(req);
          if (errors) return kisa.errorHandlers.validate(errors);
          ctx.kisa = req;
          return handler(ctx);
        }
      );
    }
    if (
      missHandlers.length + missMiddlewares.size + missSecurityHandlers.size >
      0
    ) {
      kisa.errorHandlers.routes(
        new RoutesError(
          "routes incomplete",
          missHandlers,
          Array.from(missMiddlewares),
          Array.from(missSecurityHandlers)
        )
      );
    }
  };
  return { kisa, mountKisa };
}

export class RoutesError extends Error {
  public missHandlers: string[];
  public missMiddlewares: string[];
  public missSecurityHandlers: string[];
  public constructor(
    message: string,
    missHandlers: string[],
    missMiddlewares: string[],
    missSecurityHandlers: string[]
  ) {
    super(message);
    this.name = "RouterError";
    this.missHandlers = missHandlers;
    this.missMiddlewares = missMiddlewares;
    this.missSecurityHandlers = missSecurityHandlers;
    Error.captureStackTrace(this, this.constructor);
  }
}

function getSecurityInfo(security) {
  if (!security) return null;
  if (!security.length) return null;
  security = security[0];
  const name = Object.keys(security)[0];
  if (!name) return null;
  return { name, config: security[name] };
}

function sanitizePrefix(prefix: string) {
  if (!prefix) {
    return "/";
  }
  if (prefix[0] !== "/") prefix = "/" + prefix;
  if (prefix.endsWith("/") && prefix.length > 0) {
    return prefix.slice(0, -1);
  }
  return prefix;
}

function concatPath(prefix: string, path: string) {
  if (path.startsWith("/")) {
    return prefix + path.slice(1);
  }
  return prefix + path;
}
