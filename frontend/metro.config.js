const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure for React Navigation
config.resolver.platforms = ['native', 'ios', 'android', 'web'];

module.exports = config; 