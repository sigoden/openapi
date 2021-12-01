import { default as App } from "koa";
import * as Koa from "koa";

import {
  createAjv,
  AjvErrorObject,
  Operation,
  createReqValiateFn,
} from "use-openapi";
import Router from "@koa/router";

export type State = any;

export type Context<S = State> = Koa.ParameterizedContext<S> & {
  request: { body: any };
};

export type Next = Koa.Next;

export type Middleware<S = State> = Koa.Middleware<S, Context<S>>;

export type Handler<S, T> = (
  ctx: Context<S> & { kisa: T },
  next?: Next
) => Promise<void>;

export interface Handlers<S> {
  [k: string]: Handler<S, any>;
}

export interface Middlewares<S> {
  [k: string]: Middleware<S>;
}

export interface SecurityHandlers<S> {
  [k: string]: (config: string[]) => Middleware<S>;
}

export { App, Router, Operation };

export interface Config<H, S, M> {
  prefix?: string;
  handlers?: H;
  securityHandlers?: S;
  middlewares?: M;
  hook?: (ctx: Context<S>, operation: Operation) => Promise<void>;
  operations?: Operation[];
  errorHandlers?: ErrorHandlers;
}

export interface ErrorHandlers {
  mount?: (error: MountError) => void;
  validate?: (ctx: Context, errors: AjvErrorObject[]) => void;
}

export type HandleMountError = ErrorHandlers["mount"];

export type HandleValidateError = ErrorHandlers["validate"];

export const errorHandlers: ErrorHandlers = {
  mount: (error) => {
    console.log(error.dump());
  },
  validate: (ctx, errors) => {
    ctx.status = 401;
    ctx.body = `validate throws ${JSON.stringify(errors)}`;
  },
};

export type MountKisa<T> = (router: Router<T>) => void;

export type UseKisaResult<T, H, S, M> = [Config<H, S, M>, MountKisa<T>];

export default function useKisa<
  T extends State,
  H extends Handlers<T>,
  S extends SecurityHandlers<T> = SecurityHandlers<State>,
  M extends Middlewares<T> = Middlewares<State>
>(kisa: Config<H, S, M>): UseKisaResult<T, H, S, M> {
  kisa = {
    prefix: "/",
    handlers: {} as H,
    middlewares: {} as M,
    securityHandlers: {} as S,
    errorHandlers: {},
    ...(kisa || {}),
  };
  kisa.errorHandlers = { ...errorHandlers, ...kisa.errorHandlers };
  const mountKisa: MountKisa<T> = (router) => {
    const missHandlers: MissHandlerInfo[] = [];
    const missMiddlewares = new Set<string>();
    const missSecurityHandlers = new Set<string>();
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
        concatPath(kisa.prefix, operation.path),
        ...mountMiddlewares,
        async (ctx: Context) => {
          if (kisa.hook) await kisa.hook(ctx, operation);
          if (ctx.response.body) return;
          const { request, params, headers, query } = ctx;
          const { body } = request;
          const req = { params, headers, query, body };
          const errors = validate(req);
          if (errors) return kisa.errorHandlers.validate(ctx, errors);
          ctx.kisa = req;
          return handler(ctx);
        }
      );
    }
    if (
      missHandlers.length + missMiddlewares.size + missSecurityHandlers.size >
      0
    ) {
      kisa.errorHandlers.mount(
        new MountError(
          kisa.prefix,
          missHandlers,
          Array.from(missSecurityHandlers),
          Array.from(missMiddlewares)
        )
      );
    }
  };
  return [kisa, mountKisa];
}

interface MissHandlerInfo {
  path: string;
  method: string;
  operationId: string;
}

export class MountError extends Error {
  public prefix: string;
  public missHandlers: MissHandlerInfo[];
  public missSecurityHandlers: string[];
  public missMiddlewares: string[];
  public constructor(
    prefix: string,
    missHandlers: MissHandlerInfo[],
    missSecurityHandlers: string[],
    missMiddlewares: string[]
  ) {
    super(`mount ${prefix} incompletely`);
    this.name = "MountError";
    this.missHandlers = missHandlers;
    this.missMiddlewares = missMiddlewares;
    this.missSecurityHandlers = missSecurityHandlers;
    Error.captureStackTrace(this, this.constructor);
  }
  public dump() {
    let message = `${this.message}\n`;
    const indent = (level) => "  ".repeat(level);
    const { missMiddlewares, missSecurityHandlers, missHandlers } = this;
    if (missHandlers.length > 0) {
      message += indent(1) + "miss handlers:\n";
      for (const api of missHandlers) {
        message += `${indent(2)}${api.operationId}(${api.method} ${
          api.path
        })\n`;
      }
    }
    if (missSecurityHandlers.length > 0) {
      message += indent(1) + "miss security handlers:\n";
      for (const name of missSecurityHandlers) {
        message += `${indent(2)}${name}\n`;
      }
    }
    if (missMiddlewares.length > 0) {
      message += indent(1) + "miss middlewares:\n";
      for (const name of missMiddlewares) {
        message += `${indent(2)}${name}\n`;
      }
    }
    return message;
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

function concatPath(prefix: string, subPath: string) {
  let url: string;
  if (prefix.endsWith("/") && subPath.startsWith("/")) {
    url = prefix + subPath.slice(1);
  } else if (!prefix.endsWith("/") && !subPath.startsWith("/")) {
    url = prefix + "/" + subPath;
  } else {
    url + prefix + subPath;
  }
  if (!url.startsWith("/")) url = "/" + url;
  return url;
}
