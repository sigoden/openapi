/* eslint-disable @typescript-eslint/no-var-requires  */
import deref from "../src";

test("deref petstore", () => {
  const origin = require("./spec/petstore.json");
  const output = require("./spec/petstore-deref.json");
  deref(origin);
  expect(origin).toEqual(output);
});
