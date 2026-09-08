// Expo config plugin: pins the Android NDK version in android/build.gradle on every prebuild.
// Expo's default (27.1) failed to download on this machine; 28.2 is installed and works.
// Configured in app.json:  ["./plugins/withNdkVersion", { "ndkVersion": "28.2.13676358" }]
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// [withNdkVersion]';

module.exports = function withNdkVersion(config, { ndkVersion } = {}) {
  if (!ndkVersion) return config;
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) {
      src = src.replace(/\/\/ \[withNdkVersion\][\s\S]*?\n}\n\n/, '');
    }
    const anchor = 'apply plugin: "expo-root-project"';
    const block = `${MARKER} pinned so Gradle uses the locally installed NDK (see plugins/withNdkVersion.js)\next {\n  ndkVersion = "${ndkVersion}"\n}\n\n`;
    if (!src.includes(anchor)) throw new Error('withNdkVersion: could not find the expo-root-project apply line in android/build.gradle');
    cfg.modResults.contents = src.replace(anchor, block + anchor);
    return cfg;
  });
};
