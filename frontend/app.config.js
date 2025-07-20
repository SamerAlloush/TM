require('dotenv').config({ path: '../.env' });

export default {
  expo: {
    name: "TM Paysage Site Manager",
    slug: "tm-paysage-manager",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gsconstruction.sitemanager"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.gsconstruction.sitemanager"
    },
    web: {
      bundler: "metro"
    },
    scheme: "tm-paysage"
  }
}; 