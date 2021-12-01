/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  Handler,
  Middleware,
  Operation,
  Handlers as KisaHandlers,
  Middlewares as KisaMiddlewares,
  SecurityHandlers as KisaSecurityHandlers,
} from "../../src";

export namespace ReqTypes {
  export interface Login {
    body: {
      name: string;
      pass: string;
    };
  }
  export interface ListPosts {
    query: {
      pageSize?: number;
      pageNum?: number;
    };
  }
  export interface CreatePost {
    body: {
      title: string;
      description?: string;
      content: string;
    };
  }
  export interface PublishPost {
    params: {
      id: number;
    };
  }
  export interface ListMyPosts {
    query: {
      pageSize?: number;
      pageNum?: number;
    };
  }
  export interface DeletePost {
    params: {
      id: number;
    };
  }
  export interface Post {
    id: number;
    userId: number;
    title: string;
    description: string;
    status: number;
    content: string;
    createdAt: string;
    updateAt: string;
  }
}

export interface Handlers<S> extends KisaHandlers<S> {
  login: Handler<S, ReqTypes.Login>; 
  listPosts: Handler<S, ReqTypes.ListPosts>; 
  createPost: Handler<S, ReqTypes.CreatePost>; 
  publishPost: Handler<S, ReqTypes.PublishPost>; 
  listMyPosts: Handler<S, ReqTypes.ListMyPosts>; 
  deletePost: Handler<S, ReqTypes.DeletePost>; 
}

export interface Middlewares<S> extends KisaMiddlewares<S> {
  ratelimit: Middleware<S>; 
}

export interface SecurityHandlers<S> extends KisaSecurityHandlers<S> {
  jwt: (config: string[]) => Middleware<S>; 
}

export const OPERATIONS: Operation[] = [{"path":"/login","method":"post","security":[],"operationId":"login","xProps":{},"reqSchema":{"type":"object","properties":{"body":{"type":"object","properties":{"name":{"type":"string","example":"admin"},"pass":{"type":"string","example":"a123456"}},"required":["name","pass"]}},"required":[]},"resSchema":{"200":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1},"name":{"type":"string","example":"user1"},"token":{"type":"string","example":"<token>"},"expireAt":{"type":"string","example":"<timestamp>"}},"required":["id","name","token","expireAt"]}}},{"path":"/posts","method":"get","security":[],"operationId":"listPosts","xProps":{},"reqSchema":{"type":"object","properties":{"query":{"type":"object","properties":{"pageSize":{"type":"integer","format":"int64","example":0},"pageNum":{"type":"integer","format":"int64","example":10}},"required":[]}},"required":[]},"resSchema":{"200":{"type":"array","items":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1},"userId":{"type":"integer","format":"int64","example":1},"title":{"type":"string","example":"How to write blog?"},"description":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry"},"status":{"type":"integer","format":"int64","example":0},"content":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever"},"createdAt":{"type":"string","example":"<datetime>"},"updateAt":{"type":"string","example":"<datetime>"}},"required":["id","userId","title","description","status","content","createdAt","updateAt"]}}}},{"path":"/posts","method":"post","security":[{"jwt":[]}],"operationId":"createPost","xProps":{"x-middlewares":["ratelimit"]},"reqSchema":{"type":"object","properties":{"body":{"type":"object","properties":{"title":{"type":"string","example":"How to write blog?"},"description":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry"},"content":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever"}},"required":["title","content"]}},"required":[]},"resSchema":{"200":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1},"userId":{"type":"integer","format":"int64","example":1},"title":{"type":"string","example":"How to write blog?"},"description":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry"},"status":{"type":"integer","format":"int64","example":0},"content":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever"},"createdAt":{"type":"string","example":"<datetime>"},"updateAt":{"type":"string","example":"<datetime>"}},"required":["id","userId","title","description","status","content","createdAt","updateAt"]}}},{"path":"/posts/:id/publish","method":"put","security":[{"jwt":[]}],"operationId":"publishPost","xProps":{},"reqSchema":{"type":"object","properties":{"params":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1}},"required":["id"]}},"required":[]},"resSchema":{"200":{"type":"object","properties":{"msg":{"type":"string","example":"OK"}},"required":["msg"]}}},{"path":"/posts/my","method":"get","security":[{"jwt":[]}],"operationId":"listMyPosts","xProps":{},"reqSchema":{"type":"object","properties":{"query":{"type":"object","properties":{"pageSize":{"type":"integer","format":"int64","example":0},"pageNum":{"type":"integer","format":"int64","example":10}},"required":[]}},"required":[]},"resSchema":{"200":{"type":"array","items":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1},"userId":{"type":"integer","format":"int64","example":1},"title":{"type":"string","example":"How to write blog?"},"description":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry"},"status":{"type":"integer","format":"int64","example":0},"content":{"type":"string","example":"Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever"},"createdAt":{"type":"string","example":"<datetime>"},"updateAt":{"type":"string","example":"<datetime>"}},"required":["id","userId","title","description","status","content","createdAt","updateAt"]}}}},{"path":"/posts/:id","method":"delete","security":[{"jwt":[]}],"operationId":"deletePost","xProps":{},"reqSchema":{"type":"object","properties":{"params":{"type":"object","properties":{"id":{"type":"integer","format":"int64","example":1}},"required":["id"]}},"required":[]},"resSchema":{"200":{"type":"object","properties":{"msg":{"type":"string","example":"OK"}},"required":["msg"]}}}];
