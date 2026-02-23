// Re-export all configurations
module.exports = {
  eslint: {
    base: require("./eslint/base"),
    next: require("./eslint/next"),
    reactNative: require("./eslint/react-native"),
  },
  prettier: require("./prettier/index"),
  typescript: {
    base: require("./typescript/base"),
    nextjs: require("./typescript/nextjs"),
    reactNative: require("./typescript/react-native"),
  },
};
