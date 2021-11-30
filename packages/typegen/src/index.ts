import { Spec, SchemaObject } from "jsona-openapi-types";
import lodashMerge from "lodash.merge";
import lodashGet from "lodash.get";
import ejs from "ejs";
import * as cases from "change-case";

export const METHODS = ["get", "put", "delete", "post", "options"];
export const X_MIDDLEWARE_PROP = "x-middleware";

const PARAMETERS = { header: "headers", query: "query", path: "params" };

export interface Options {
  /**
   * Ident with spaces, default value is 2
   */
  indent?: number;
  /**
   * Ejs template for generate handlers type
   *
   * context:
   * {
   *    cases,
   *    list: [ "signUp" ]
   * }
   *
   */
  handlers?: string;
  /**
   * Ejs template for generate middlewares type
   *
   * context:
   * {
   *    cases,
   *    list: [ "rateLimit" ]
   * }
   */
  middlewares?: string;
  /**
   * Ejs template for generate security handlers type
   *
   * context:
   * {
   *    cases,
   *    list: [ "jwt" ]
   * }
   */
  securityHandlers?: string;
}

export function generate(spec: Spec, options: Options = {}) {
  const defaultOptions: Options = {
    indent: 2,
  };
  options = lodashMerge(defaultOptions, options);
  const { operations, schemas, middlewares, securitys } = parseSpec(spec);
  const builder = new Builder(options);
  for (const operationId in operations) {
    builder.build(
      cases.pascalCase(operationId + "Req"),
      operations[operationId]
    );
  }
  for (const name in schemas) {
    builder.build(cases.pascalCase(name), schemas[name]);
  }
  if (options.handlers)
    builder.buildEjs(options.handlers, { list: Object.keys(operations) });
  if (options.middlewares)
    builder.buildEjs(options.middlewares, { list: middlewares });
  if (options.securityHandlers)
    builder.buildEjs(options.securityHandlers, { list: securitys });
  return builder.buffer.slice(0, -1);
}

export interface SchemaRecord {
  [k: string]: SchemaObject;
}

export interface ParseSpecResult {
  operations: SchemaRecord;
  schemas: SchemaRecord;
  middlewares: string[];
  securitys: string[];
}

export function parseSpec(spec: Spec): ParseSpecResult {
  const operations = {} as SchemaRecord;
  const middlewares = new Set<string>();
  const securitys = new Set<string>();
  for (const path in spec.paths) {
    const pathItem = spec.paths[path];
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      if (!operation.operationId) {
        throw new Error(
          `endpoint ${method.toUpperCase()} ${path} miss operationId`
        );
      }
      const endpointSchema = createDefaultSchema();
      const addParamaterSchema = (key, obj: any) => {
        const dataKey = PARAMETERS[key];
        if (!dataKey) return;
        let data = endpointSchema.properties[dataKey] as SchemaObject;
        if (!data) {
          data = endpointSchema.properties[dataKey] = createDefaultSchema();
          endpointSchema.required.push(dataKey);
        }
        if (obj.$ref) {
          const paths = refToPath(obj.$ref);
          if (paths) {
            data.properties[obj.name] = lodashGet(spec, paths.concat("schema"));
          } else {
            data.properties[obj.name] = {};
          }
        } else {
          data.properties[obj.name] = obj.schema;
        }
        if (obj.required) data.required.push(obj.name);
      };
      const parameters: any[] = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
      ];
      for (const parameter of parameters) {
        addParamaterSchema(parameter.in, parameter);
      }
      const bodySchema = lodashGet(operation, [
        "requestBody",
        "content",
        "application/json",
        "schema",
      ]);
      if (bodySchema) {
        endpointSchema.properties["body"] = bodySchema;
        endpointSchema.required.push("body");
      }
      operations[operation.operationId] = endpointSchema;
      if (
        operation[X_MIDDLEWARE_PROP] &&
        Array.isArray(operation[X_MIDDLEWARE_PROP])
      ) {
        operation[X_MIDDLEWARE_PROP].forEach((v) =>
          middlewares.add(v.toString())
        );
      }
      const securityObj = operation.security || spec.security || [];
      if (securityObj[0] && typeof securityObj[0] === "object") {
        const name = Object.keys(securityObj[0])[0];
        if (name) securitys.add(name);
      }
    }
  }
  return {
    operations,
    schemas: lodashGet(spec, "components.schemas"),
    middlewares: Array.from(middlewares),
    securitys: Array.from(securitys),
  };
}

class Builder {
  public buffer = "";
  private options: Options;
  private indent = 0;
  private scopes: string[] = [];
  constructor(options: Options) {
    this.options = options;
  }
  public build(name: string, schema) {
    if (schema.$ref) {
      this.writeln(
        `export type ${cases.pascalCase(name)} = ${refTail(schema.$ref)}`
      );
      this.writeln("");
    } else if (schema.type === "object") {
      this.writeln(`export interface ${cases.pascalCase(name)} {`);
      this.enterScope("object");
      this.buildProperties(schema.properties, schema.required);
      this.exiteScope(true);
      this.writeln("");
    }
  }
  public buildEjs(tmpl: string, data: Record<string, any>) {
    this.writeln("");
    this.writeln(ejs.render(tmpl, { ...data, cases }));
  }
  private buildProperties(properties: any[], required: string[] = []) {
    for (const name in properties) {
      const optional = required.find((v) => v === name) ? "" : "?";
      const schema = properties[name];
      const type = getType(schema);
      const safeName = normalizeName(name);
      if (isScalar(type)) {
        this.writeln(`${safeName}${optional}: ${type};`);
      } else {
        if (type === "array") {
          const elemSchema = schema.items;
          const elemType = getType(elemSchema);
          if (isCombile(elemSchema)) {
            this.writeln(`${safeName}${optional}: any[];`);
          } else if (isScalar(elemType)) {
            this.writeln(`${safeName}${optional}: ${elemType}[];`);
          } else {
            this.writeln(`${safeName}${optional}: {`);
            this.enterScope(type);
            this.buildProperties(elemSchema.properties, elemSchema.required);
            this.exiteScope();
          }
        } else {
          this.writeln(`${safeName}${optional}: {`);
          this.enterScope(type);
          this.buildProperties(schema.properties, schema.required);
          this.exiteScope();
        }
      }
    }
  }
  private enterScope(kind: string) {
    this.scopes.push(kind);
    this.indent += 1;
  }
  private exiteScope(root = false) {
    const kind = this.scopes.pop();
    const semi = root ? "" : ";";
    this.indent -= 1;
    if (kind === "object") {
      this.writeln(`}${semi}`);
    } else {
      this.writeln(`}[]${semi}`);
    }
  }
  private writeln(line) {
    this.buffer += this.spaces() + line + "\n";
  }
  private spaces() {
    return " ".repeat(this.indent * this.options.indent);
  }
}

function createDefaultSchema(): SchemaObject {
  return { type: "object", properties: {}, required: [] };
}

function refToPath(ref: string) {
  if (ref === "#") return;
  if (!ref.startsWith("#/")) return;
  return ref.slice(2).split("/");
}

function refTail(ref: string) {
  const paths = refToPath(ref);
  if (paths) return paths[paths.length - 1];
  return "any";
}

function isScalar(type: string) {
  return ["object", "array"].indexOf(type) === -1;
}

function isCombile(schema) {
  return schema["anyOf"] || schema["oneOf"] || schema["allOf"];
}

function getType(shcema: any) {
  if (!shcema) return "any";
  switch (shcema.type) {
    case "integer":
      return "number";
    case "number":
    case "string":
    case "boolean":
    case "object":
    case "array":
      return shcema.type;
    default:
      if (shcema.properties) {
        return "object";
      } else if (shcema.items) {
        return "array";
      } else if (shcema.$ref) {
        return refTail(shcema.$ref);
      }
      return "any";
  }
}

function normalizeName(name: string) {
  if (/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(name)) {
    return name;
  }
  return `"${name}"`;
}
