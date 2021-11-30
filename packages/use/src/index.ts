import Ajv, { Options as AjvOptions, ErrorObject as AjvErrorObject } from "ajv";
import lodashMerge from "lodash.merge";
import lodashGet from "lodash.get";
import addFormats from "ajv-formats";
import { SchemaObject } from "jsona-openapi-types";
import deref from "jsona-openapi-deref";
import {
  Spec,
  OperationObject,
  ParameterObject,
  SecurityRequirementObject,
} from "jsona-openapi-types";

const METHODS = ["get", "put", "delete", "post", "options"];
const PARAMETER_MAP = { header: "headers", query: "query", path: "params" };

export const AJV_OPTIONS: AjvOptions = {
  useDefaults: true,
  coerceTypes: true,
  keywords: ["example"],
};

export function parseOperations(spec: Spec): BaseOperation[] {
  deref(spec);
  const invalidOperations: InvalidOperation[] = [];
  const operations: BaseOperation[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method] as OperationObject;
      if (!operation) continue;
      if (!operation.operationId) {
        invalidOperations.push({ method, path, reason: "MissOperationId" });
        continue;
      }
      const xProps = Object.keys(operation)
        .filter((key) => key.startsWith("x-") || key.startsWith("x"))
        .reduce((a, c) => {
          a[c] = operation[c];
          return a;
        }, {});
      const reqSchema = createDefaultSchema();
      const addParamaterSchema = (key, obj: ParameterObject) => {
        const dataKey = PARAMETER_MAP[key];
        if (!dataKey) return;
        let data = reqSchema.properties[dataKey];
        if (!data) {
          data = reqSchema.properties[dataKey] = createDefaultSchema();
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
        reqSchema.properties["body"] = bodySchema;
      }

      const resSchema = {} as SchemaObjectRecord;
      const responses = lodashGet(operation, ["responses"], {});
      for (const status in responses) {
        const statusSchema = lodashGet(responses, [
          status,
          "content",
          "application/json",
        ]);
        if (statusSchema) resSchema[status] = statusSchema;
      }
      if (invalidOperations.length > 0) {
        throw new InvalidSpecError(invalidOperations);
      }

      operations.push({
        path: path.replace(/{([^}]+)}/g, ":$1").replace(/\/$/, ""),
        method,
        security: operation.security || spec.security,
        operationId: operation.operationId,
        xProps,
        reqSchema: reqSchema as SchemaObject,
        resSchema,
      });
    }
  }
  return operations;
}

export function getOperations(spec: Spec, options: Options = {}): Operation[] {
  const defaultOptions: Options = {
    ajvOptions: { ...AJV_OPTIONS },
    createResValidate: false,
  };
  options = lodashMerge(defaultOptions, options);
  const operations = parseOperations(spec);
  const ajv = options.ajv ? options.ajv : createAjv(options.ajvOptions);
  return mapOperations(operations, ajv, options.createResValidate);
}

export function mapOperations(
  operations: BaseOperation[],
  ajv: Ajv,
  createResValidate = false
): Operation[] {
  return operations.map((operation) => {
    const { reqSchema, resSchema } = operation;
    const ajvValidate = ajv.compile(reqSchema);
    const validate: ValidateFn = (data) => {
      ajvValidate(data);
      return ajvValidate.errors;
    };
    let validateRes: ValidateResFn;
    if (createResValidate) {
      const ajvValidates = Object.keys(resSchema).reduce((acc, status) => {
        acc[status] = ajv.compile(resSchema[status]);
        return acc;
      }, {});
      validateRes = (status, body) => {
        const validate = ajvValidates[status];
        if (validate) {
          validate(body);
          return validate.errors;
        }
      };
    }
    return {
      ...operation,
      validate,
      validateRes,
    };
  });
}

export interface InvalidOperation {
  method: string;
  path: string;
  reason: "MissOperationId";
}

export class InvalidSpecError extends Error {
  public invalidOperations: InvalidOperation[];
  public constructor(operations: InvalidOperation[], message = "Invalid spec") {
    super(message);
    this.invalidOperations = operations;
    this.name = "MissOperationIdsError";
    Error.captureStackTrace(this, this.constructor);
  }
}

function createDefaultSchema() {
  return { type: "object", properties: {}, required: [] };
}

export function createAjv(options: AjvOptions = AJV_OPTIONS): Ajv {
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

export interface BaseOperation {
  path: string;
  method: string;
  operationId: string;
  security: SecurityRequirementObject[];
  xProps: { [k: string]: any };
  reqSchema: SchemaObject;
  resSchema: SchemaObjectRecord;
}

export interface SchemaObjectRecord {
  [k: string]: SchemaObject;
}

export interface Operation extends BaseOperation {
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
