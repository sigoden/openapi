import Koa, { ParameterizedContext, DefaultState, Middleware } from "koa";
import { Operation, AjvErrorObject } from "use-openapi";
import Router from "@koa/router";
import type { Spec } from "jsona-openapi-types";

export interface KisaHandlers<S> {
  [k: string]: (ctx: ParameterizedContext<S>) => Promise<void>;
}

export interface KisaMiddlewares<S> {
  [k: string]: Middleware<S>;
}

export interface KisaSecurityHandlers<S> {
  [k: string]: (config: string[]) => Middleware<S>;
}

export type OpenApiSpec = Spec;

export { Middleware as KisaMiddleware, Koa };

export interface kisaConfig<H, M, S> {
  prefix: string;
  operations: Operation[];
  handlers: H;
  middlewares: M;
  securityHandlers: S;
  handlerHook: (
    ctx: ParameterizedContext<S>,
    operation: Operation
  ) => Promise<void>;
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
    const missMiddlewares = [];
    const missHandlers = [];
    const missSecurityHandlers = [];
    const prefix = kisa.prefix.endsWith("/")
      ? kisa.prefix.slice(0, -1)
      : kisa.prefix;

    for (const operation of kisa.operations) {
      const { method, operationId, path, security, xProps } = operation;
      let mountable = true;
      const handler = kisa.handlers[operation.operationId];
      if (!handler) {
        missHandlers.push({ method, operationId, path });
        mountable = false;
      }

      const apiMiddlrewares = [];

      const xMids = xProps["x-middlewares"];
      if (Array.isArray(xMids)) {
        for (const name of xMids) {
          const middleware = kisa.middlewares[name];
          if (!middleware) {
            missMiddlewares.push(name);
            mountable = false;
          }
          apiMiddlrewares.push(middleware);
        }
      }

      const securityInfo = getSecurityInfo(security);
      if (securityInfo) {
        const { name, config } = securityInfo;
        const securityHandler = kisa.securityHandlers[name];
        if (!securityHandler) {
          missSecurityHandlers.push(name);
          mountable = false;
          continue;
        }
        apiMiddlrewares.push(securityHandler(config));
      }

      if (!mountable) continue;

      router[operation.method](
        prefix + operation.path,
        ...apiMiddlrewares,
        async (ctx: Koa.Context) => {
          if (kisa.handlerHook) await kisa.handlerHook(ctx, operation);
          if (ctx.response.body) return;
          const { request, params, headers, query } = ctx;
          const { body } = request;
          const req = { params, headers, query, body };
          const errors = operation.validate(req);
          if (errors) return kisa.errorHandlers.validate(errors);
          ctx.kisa = req;
          return handler(ctx);
        }
      );
    }
    if (
      missMiddlewares.length +
        missSecurityHandlers.length +
        missHandlers.length >
      0
    ) {
      kisa.errorHandlers.routes(
        new RoutesError(
          "routes incomplete",
          missHandlers,
          missMiddlewares,
          missSecurityHandlers
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
