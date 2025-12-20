export default {
  expo: {
    name: "Cloud",
    slug: "apk-lista-clean-2024",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "apk-lista-clean",
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
      bundleIdentifier: "com.adrianpm.apklistaclean",
      // Configuración de seguridad para iOS
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSExceptionDomains: {
            "kathcxgrriikfdwvqhpz.supabase.co": {
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionMinimumTLSVersion: "1.2"
            }
          }
        }
      }
    },
    android: {
      icon: "./assets/icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.adrianpm.apklistaclean",
      permissions: [
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "SYSTEM_ALERT_WINDOW"
      ],
      // Configuración de seguridad para Android
      proguardObfuscate: true, // Habilitar ofuscación con ProGuard
      allowBackup: false, // Prevenir backups automáticos
      networkSecurityConfig: {
        domain: [
          {
            domain: "kathcxgrriikfdwvqhpz.supabase.co",
            includeSubdomains: true,
            pin: {
              digestAlgorithm: "SHA256"
            }
          }
        ]
      }
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    owner: "expo4085",
    extra: {
      eas: {
        projectId: "eebd5cf6-bc00-4ad1-863f-f8461ebd7219"
      }
    },
    plugins: [
      "expo-splash-screen",
      "expo-notifications",
      [
        "expo-background-fetch",
        {
          backgroundColor: "#ffffff"
        }
      ]
    ],
    // Configuración de updates OTA con validación
    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 30000,
      // codeSigningCertificate: "./code-signing-certificate.pem", // Certificado para validar updates (deshabilitado temporalmente)
      // codeSigningMetadata: {
      //   keyid: "main",
      //   alg: "rsa-v1_5-sha256"
      // }
    },
    // Hooks para validación de integridad
    hooks: {
      postPublish: [
        {
          file: "./scripts/validate-build.js"
        }
      ]
    }
  }
};