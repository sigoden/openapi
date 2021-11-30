/* eslint-disable @typescript-eslint/no-var-requires  */
import { createAjv, createReqValiateFn, parseOperations } from "../src";

const petstore = require("../../deref/tests/spec/petstore.json");
const petstoreDeref = require("../../deref/tests/spec/petstore-deref.json");
const operations = parseOperations(petstore);
const lodashGet = require("lodash.get");

const ajv = createAjv();
test("parsed route object", () => {
  const operation = operations.find((v) => v.operationId === "updatePet");
  expect(operation).toMatchSnapshot();
  expect(
    createReqValiateFn(
      ajv,
      operation.reqSchema
    )({
      body: {
        id: 10,
        name: "doggie",
        category: {
          id: 1,
          name: "Dogs",
        },
        photoUrls: ["<url:img>"],
        tags: [
          {
            id: 1,
            name: "dog",
          },
        ],
        status: "available",
      },
    })
  ).toEqual(null);
});

test("validate query and params", () => {
  const { reqSchema } = operations.find(
    (v) => v.operationId === "updatePetWithForm"
  );
  const validate = createReqValiateFn(ajv, reqSchema);
  const errors1 = validate({
    query: {
      name: "Tim",
      status: "available",
    },
    params: {
      petId: "32",
    },
  });
  expect(errors1).toEqual(null);
  const errors2 = validate({
    query: {
      name: "Tim",
      status: "available",
    },
    params: {
      petId: "abc",
    },
  });
  expect(errors2).toEqual([
    {
      instancePath: "/params/petId",
      schemaPath: "#/properties/params/properties/petId/type",
      keyword: "type",
      params: {
        type: "integer",
      },
      message: "must be integer",
    },
  ]);
});

test("collect xprops", () => {
  const route = operations.find((v) => v.operationId === "getInventory");
  expect(route.xProps).toEqual({
    "x-swagger-router-controller": "OrderController",
  });
});
