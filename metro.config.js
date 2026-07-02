// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 把打包的唯讀內容庫 (assets/db/kioku-content.db) 當作 asset 內嵌，供 src/db/contentDb.ts require + ATTACH。
config.resolver.assetExts.push('db');

module.exports = config;
