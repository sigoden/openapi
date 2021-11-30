const path = require("path");

const { yargs, run } = require("..");

test("it should works", () => {
  console.log = jest.fn();
  const input = path.resolve(__dirname, "../../kisa/tests/fixtures/api.jsona");
  expect(() => run(yargs.parse([input]))).not.toThrow();
  expect(console.log.mock.calls[0][0]).toMatchSnapshot();
});
