# APK Lista - React Native App

Una aplicación móvil desarrollada con React Native.

## 🚀 Instalación

### Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 16 o superior)
- [React Native CLI](https://reactnative.dev/docs/environment-setup)
- [Android Studio](https://developer.android.com/studio) (para desarrollo Android)
- [Xcode](https://developer.apple.com/xcode/) (para desarrollo iOS - solo en macOS)

### Pasos de instalación

1. **Clona el repositorio:**
   ```bash
   git clone <tu-repositorio>
   cd apk-lista
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Para Android:**
   ```bash
   npx react-native run-android
   ```

4. **Para iOS (solo macOS):**
   ```bash
   cd ios && pod install && cd ..
   npx react-native run-ios
   ```

## 📱 Scripts disponibles

- `npm start` - Inicia el Metro bundler
- `npm run android` - Ejecuta la app en Android
- `npm run ios` - Ejecuta la app en iOS
- `npm run clean` - Limpia el cache
- `npm run reset` - Reinicia el proyecto

## 📁 Estructura del proyecto

```
src/
├── components/     # Componentes reutilizables
├── screens/        # Pantallas de la aplicación
├── navigation/     # Configuración de navegación
└── assets/         # Imágenes, fuentes y recursos
```

## 🛠️ Tecnologías utilizadas

- React Native
- React Navigation
- JavaScript/JSX

## 📝 Desarrollo

Para comenzar el desarrollo:

1. Asegúrate de tener un emulador Android ejecutándose o un dispositivo conectado
2. Ejecuta `npm start` para iniciar Metro
3. En otra terminal, ejecuta `npm run android` o `npm run ios`

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request