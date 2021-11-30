import { generate } from "../src";

test("should works", () => {
  const petstore = require("./spec/cases.json"); // eslint-disable-line
  const result = generate(petstore, {});
  expect(result).toMatchSnapshot();
});
