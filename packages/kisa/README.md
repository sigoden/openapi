# kisa

A web framework based on koa and openapi.

## Usage

```ts
import useKisa, { Koa, Router, RoutesError } from "kisa";
import * as Api from "./apiType"; // generated with kisa-typegen

const app = new Koa();
app.use(bodyParser());
const router = new Router();
const { mountKisa } = useKisa<
  State,
  Api.Handlers<State>,
  Api.Middlewares<State>,
  Api.SecurityHandlers<State>
>({
  operations: Api.OPERATIONS,
  middlewares: {
    ratelimit: async (ctx, next) => {
      await next();
    },
  },
  securityHandlers: {
    jwt: () => {
      return async (ctx, next) => {
        if (ctx.headers["authorization"]) {
          ctx.state.auth = {
            user: ctx.headers["authorization"].slice("Bearer ".length),
          };
        }
        await next();
      };
    },
  },
  errorHandlers: {
    routes: (error) => {
      return;
    },
    validate: (errors) => {
      return;
    },
  },
});

kisa.handlers.login = async (ctx) => {};

mountKisa(router);
app.use(router.routes());
app.listen(3000);
```
