import bodyParser from "koa-bodyparser";
import request from "supertest";
import http from "http";
import useKisa, { Koa, Router, MountError } from "../src";
import * as Api from "./fixtures/api";

interface State {
  auth: {
    user: string;
  };
}

describe("it should works", () => {
  let server: http.Server;
  const spyRatelimit = jest.fn();
  const spyMountErr = jest.fn();
  const spyValidateErr = jest.fn();
  const spyJwt = jest.fn();
  beforeAll(() => {
    const app = new Koa();
    app.use(bodyParser());
    const router = new Router();
    const generic = async (ctx) => {
      ctx.body = { kisa: ctx.kisa };
    };
    const [, mountKisa] = useKisa<
      State,
      Api.Handlers<State>,
      Api.Middlewares<State>,
      Api.SecurityHandlers<State>
    >({
      operations: Api.OPERATIONS,
      handlers: {
        login: generic,
        createPost: generic,
        deletePost: generic,
        listMyPosts: generic,
        listPosts: generic,
        publishPost: generic,
      },
      middlewares: {
        ratelimit: async (ctx, next) => {
          spyRatelimit();
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
            spyJwt();
            await next();
          };
        },
      },
      errorHandlers: {
        mount: (error) => {
          spyMountErr(error);
        },
        validate: (ctx, errors) => {
          spyValidateErr(errors);
        },
      },
    });
    mountKisa(router);
    app.use(router.routes());
    server = http.createServer(app.callback());
  });
  beforeEach(() => {
    spyValidateErr.mockClear();
    spyRatelimit.mockClear();
    spyJwt.mockClear();
  });
  it("routes", () => {
    expect(spyMountErr.mock.calls).toEqual([]);
  });
  it("login", (done) => {
    const data = { name: "admin", pass: "a123456" };
    request(server)
      .post("/login")
      .send(data)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.body).toEqual(data);
        expect(spyRatelimit.mock.calls.length).toEqual(0);
        expect(spyJwt.mock.calls.length).toEqual(0);
        done();
      });
  });
  it("createPost", (done) => {
    const data = {
      title: "How to write blog?",
      description:
        "Lorem Ipsum is simply dummy text of the printing and typesetting industry",
      content: `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever`,
    };
    request(server)
      .post("/posts")
      .send(data)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.body).toEqual(data);
        expect(spyRatelimit.mock.calls.length).toEqual(1);
        expect(spyJwt.mock.calls.length).toEqual(1);
        done();
      });
  });
  it("createPost validate err", (done) => {
    const data = {
      description:
        "Lorem Ipsum is simply dummy text of the printing and typesetting industry",
      content: `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever`,
    };
    request(server)
      .post("/posts")
      .send(data)
      .end(function () {
        expect(spyValidateErr.mock.calls[0][0]).toEqual([
          {
            instancePath: "/body",
            schemaPath: "#/properties/body/required",
            keyword: "required",
            params: { missingProperty: "title" },
            message: "must have required property 'title'",
          },
        ]);
        done();
      });
  });
  it("publishPost", (done) => {
    request(server)
      .put("/posts/1/publish")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.params).toEqual({ id: 1 });
        expect(spyRatelimit.mock.calls.length).toEqual(0);
        expect(spyJwt.mock.calls.length).toEqual(1);
        done();
      });
  });
  it("listMyPosts", (done) => {
    request(server)
      .get("/posts/my?pageSize=1&pageNum=10")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.query).toEqual({ pageSize: 1, pageNum: 10 });
        expect(spyRatelimit.mock.calls.length).toEqual(0);
        expect(spyJwt.mock.calls.length).toEqual(1);
        done();
      });
  });
  it("listPosts", (done) => {
    request(server)
      .get("/posts?pageSize=1&pageNum=10")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.query).toEqual({ pageSize: 1, pageNum: 10 });
        expect(spyRatelimit.mock.calls.length).toEqual(0);
        expect(spyJwt.mock.calls.length).toEqual(0);
        done();
      });
  });
  it("deletePost", (done) => {
    request(server)
      .delete("/posts/1")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body.kisa.params).toEqual({ id: 1 });
        expect(spyRatelimit.mock.calls.length).toEqual(0);
        expect(spyJwt.mock.calls.length).toEqual(1);
        done();
      });
  });
});

test("routes err", () => {
  const spyMountErr = jest.fn();
  const app = new Koa();
  app.use(bodyParser());
  const router = new Router();
  const [, mountKisa] = useKisa<
    State,
    Api.Handlers<State>,
    Api.Middlewares<State>,
    Api.SecurityHandlers<State>
  >({
    operations: Api.OPERATIONS,
    errorHandlers: {
      mount: (error) => {
        spyMountErr(error);
      },
      validate: (errors) => {
        return;
      },
    },
  });
  mountKisa(router);
  app.use(router.routes());
  const err = spyMountErr.mock.calls[0][0];
  expect(err).toBeInstanceOf(MountError);
  expect(err.missHandlers).toEqual([
    { method: "post", operationId: "login", path: "/login" },
    { method: "get", operationId: "listPosts", path: "/posts" },
    { method: "post", operationId: "createPost", path: "/posts" },
    { method: "put", operationId: "publishPost", path: "/posts/:id/publish" },
    { method: "get", operationId: "listMyPosts", path: "/posts/my" },
    { method: "delete", operationId: "deletePost", path: "/posts/:id" },
  ]);
  expect(err.missMiddlewares).toEqual(["ratelimit"]);
  expect(err.missSecurityHandlers).toEqual(["jwt"]);
  expect(err.dump()).toMatchSnapshot();
});
