const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable the experimental node:sea shim which causes issues on Windows
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
