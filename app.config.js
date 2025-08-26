import 'dotenv/config';

export default {
  "expo": {
    "name": "APK Lista",
    "slug": "apk-lista",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./src/assets/icon.png",
    "userInterfaceStyle": "light",
    "platforms": ["ios", "android", "web"],
    "splash": {
      "image": "./src/assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#F8F9FA"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "jsEngine": "jsc"
    },
    "android": {
      "compileSdkVersion": 35,
      "targetSdkVersion": 35,
      "minSdkVersion": 21,
      "adaptiveIcon": {
        "foregroundImage": "./src/assets/adaptive-icon.png",
        "backgroundColor": "#F8F9FA"
      },
      "jsEngine": "jsc"
    },
    "web": {
      "favicon": "./src/assets/favicon.png"
    },
    "jsEngine": "jsc",
    "experiments": {
      "tsconfigPaths": true
    },
    "extra": {
      "anthropicApiKey": process.env.ANTHROPIC_API_KEY,
      "claudeModel": process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022"
    }
  }
};