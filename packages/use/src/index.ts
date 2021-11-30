import Ajv, { Options as AjvOptions, ErrorObject as AjvErrorObject } from "ajv";
import lodashMerge from "lodash.merge";
import lodashGet from "lodash.get";
import addFormats from "ajv-formats";
import derefSchema from "./derefSchema";
import {
  Spec,
  OperationObject,
  ParameterObject,
  SecurityRequirementObject,
} from "jsona-openapi-types";

const METHODS = ["get", "put", "delete", "post", "options"];
const PARAMETER_MAP = { header: "headers", query: "query", path: "params" };

function getOperations(spec: Spec, options: Options = {}): Operation[] {
  const defaultOptions: Options = {
    ajvOptions: {
      useDefaults: true,
      coerceTypes: true,
      keywords: ["example"],
    },
    createResValidate: false,
  };
  options = lodashMerge(defaultOptions, options);
  derefSchema(spec);
  const ajv = options.ajv ? options.ajv : createAjv(options.ajvOptions);
  const operations: Operation[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method] as OperationObject;
      if (!operation) continue;
      const xProps = Object.keys(operation)
        .filter((key) => key.startsWith("x-") || key.startsWith("x"))
        .reduce((a, c) => {
          a[c] = operation[c];
          return a;
        }, {});
      if (!operation.operationId) {
        throw new Error(
          `endpoint ${method.toUpperCase()} ${path} miss operationId`
        );
      }
      const endpointSchema = createDefaultSchema();
      const addParamaterSchema = (key, obj: ParameterObject) => {
        const dataKey = PARAMETER_MAP[key];
        if (!dataKey) return;
        let data = endpointSchema.properties[dataKey];
        if (!data) {
          data = endpointSchema.properties[dataKey] = createDefaultSchema();
        }
        data.properties[obj.name] = obj.schema;
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
      }

      const validate = ajv.compile(endpointSchema);
      let validateRes: ValidateResFn = null;
      if (options.createResValidate) {
        const validateStatusBody = {};
        const responses = lodashGet(options, ["responses"], {});
        for (const status in responses) {
          const schema = lodashGet(responses, [
            status,
            "content",
            "application/json",
          ]);
          if (schema) validateStatusBody[status] = ajv.compile(schema);
        }
        validateRes = (status, body) => {
          const validate = validateStatusBody[status];
          if (validate) return validate(body);
        };
      }

      operations.push({
        path: path.replace(/{([^}]+)}/g, ":$1").replace(/\/$/, ""),
        method,
        security: operation.security || spec.security,
        operationId: operation.operationId,
        xProps,
        validate: (data) => {
          validate(data);
          return validate.errors;
        },
        validateRes,
      });
    }
  }
  return operations;
}

function createDefaultSchema() {
  return { type: "object", properties: {}, required: [] };
}

function createAjv(options: AjvOptions): Ajv {
  const ajv = new Ajv(options);
  addFormats(ajv);
  return ajv;
}

export interface Options {
  /**
   * Whether create response body validate
   * @default false
   */
  createResValidate?: boolean;
  /**
   * Pass ajv instance
   */
  ajv?: Ajv;
  /*
   * Pass thoungh ajv options see https://ajv.js.org/#options
   */
  ajvOptions?: AjvOptions;
}

export enum Method {
  Get = "get",
  Put = "put",
  Delete = "delete",
  Post = "post",
  Patch = "patch",
}

export interface Operation {
  path: string;
  method: string;
  operationId: string;
  security: SecurityRequirementObject[];
  xProps: { [k: string]: any };
  validate: ValidateFn;
  validateRes?: ValidateResFn;
}

export type ValidateFn = (data: ValidateData) => AjvErrorObject[];
export type ValidateResFn = (status: number, data: any) => AjvErrorObject[];

export interface ValidateData {
  headers?: { [k: string]: any };
  params?: { [k: string]: any };
  query?: { [k: string]: any };
  body?: any;
}

export type { AjvErrorObject, AjvOptions };

export { getOperations };
