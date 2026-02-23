const baseConfig = require("./base");

module.exports = {
  ...baseConfig,
  extends: [
    ...baseConfig.extends,
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
  ],
};
