const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Enable CSS support for web
config.resolver.sourceExts.push("css");

module.exports = withNativeWind(config, { input: "./global.css" });
