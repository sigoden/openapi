/* eslint-disable @typescript-eslint/no-var-requires  */
import derefSchema from "../src/derefSchema";

test("deref petstore", () => {
  const origin = require("./spec/petstore.json");
  const output = require("./spec/petstore-deref.json");
  derefSchema(origin);
  expect(origin).toEqual(output);
});
