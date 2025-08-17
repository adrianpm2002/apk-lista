# Modal de Cambio de Contraseña

## Descripción
Modal independiente y reutilizable para cambiar la contraseña del usuario autenticado. Se separa del sidebar para evitar problemas de eventos táctiles y cierre accidental.

## Características

### ✅ **Funcionalidades**
- Modal completamente independiente del sidebar
- Validación de contraseña (mínimo 6 caracteres)
- Confirmación de contraseña
- Feedback visual de errores y éxito
- Estado de carga durante el proceso
- Soporte para modo oscuro
- Cierre automático después del éxito

### ✅ **Compatibilidad**
- Todos los roles: admin, collector, listero
- React Native (móvil y web)
- Modo claro y oscuro

## Uso

### Integración en componentes
```jsx
import ChangePasswordModal from '../components/ChangePasswordModal';

const MyComponent = () => {
  const [modalVisible, setModalVisible] = useState(false);
  
  return (
    <>
      <Button onPress={() => setModalVisible(true)} title="Cambiar contraseña" />
      
      <ChangePasswordModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isDarkMode={isDarkMode}
      />
    </>
  );
};
```

### Props

| Prop | Tipo | Requerido | Descripción |
|------|------|-----------|-------------|
| `visible` | boolean | ✅ | Controla la visibilidad del modal |
| `onClose` | function | ✅ | Callback ejecutado al cerrar el modal |
| `isDarkMode` | boolean | ❌ | Activa el tema oscuro |

## Funcionamiento Interno

### Validaciones
1. **Longitud mínima**: 6 caracteres
2. **Confirmación**: Las contraseñas deben coincidir
3. **Estado**: No permitir envío múltiple durante carga

### Backend
- Usa `supabase.auth.updateUser({ password: newPassword })`
- Método seguro de Supabase para cambio de contraseña propia
- No requiere Edge Functions ni Service Role Key

### Estados
- `newPassword`: String - Nueva contraseña
- `confirmPassword`: String - Confirmación de contraseña  
- `isLoading`: Boolean - Estado de carga
- `status`: Object - `{type: 'error'|'success', message: string}`

## Flujo de Usuario

1. **Acceso**: Sidebar → ⚙️ Configuración → 🔑 Cambiar contraseña
2. **Modal**: Se abre modal independiente
3. **Validación**: Escribe y confirma nueva contraseña
4. **Envío**: Presiona "Guardar"
5. **Resultado**: Ve feedback de éxito/error
6. **Cierre**: Modal se cierra automáticamente (éxito) o manualmente

## Ventajas sobre implementación anterior

### ❌ **Problemas resueltos**
- Modal del sidebar que se cerraba al tocar inputs
- Eventos táctiles conflictivos
- Formulario integrado complejo de mantener

### ✅ **Mejoras obtenidas**
- Modal independiente y estable
- Mejor UX sin cierres accidentales
- Código más limpio y reutilizable
- Fácil mantenimiento y testing

## Estilos

### Responsive
- Ancho máximo 400px
- Ancho del 100% en pantallas pequeñas
- Padding apropiado para móvil

### Colores
- **Modo claro**: Fondo blanco, textos oscuros
- **Modo oscuro**: Fondo `#2c3e50`, textos claros
- **Estados**: Verde para éxito, rojo para errores

### Interacciones
- Botones con estados deshabilitados
- Feedback visual inmediato
- Animaciones suaves (fade)

## Debugging

### Errores comunes
1. **Modal no se abre**: Verificar prop `visible`
2. **No guarda**: Verificar conexión Supabase
3. **Estilo raro**: Verificar prop `isDarkMode`

### Logs útiles
```javascript
console.log('ChangePasswordModal - visible:', visible);
console.log('ChangePasswordModal - status:', status);
```
