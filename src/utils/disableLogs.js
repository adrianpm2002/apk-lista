// Desactivar console.log en producción para Android
// Agregar al inicio de App.js o index.js

if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  // Mantener console.error para debugging crítico
  // console.error = () => {};
}

export default {};