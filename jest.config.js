module.exports = {
  transform: {
    "^.+\\.ts?$": "ts-jest",
    "^.+\\.js?$": "jest-esm-transformer",
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  testPathIgnorePatterns: ["/node_modules/"],
  transformIgnorePatterns: [`/node_modules/`],
};
