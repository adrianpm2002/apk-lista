# Sistema de Almacenamiento Local - Documentación

Este sistema permite guardar y gestionar jugadas localmente en el dispositivo usando AsyncStorage.

## Instalación

```bash
npm install @react-native-async-storage/async-storage
```

## Estructura de Archivos

- `src/utils/storage.js` - Funciones básicas para interactuar con AsyncStorage
- `src/hooks/useStorage.js` - Hooks personalizados para usar en componentes React
- Datos se guardan automáticamente en el dispositivo local

## Uso Básico

### 1. Hook para Jugadas Guardadas

```javascript
import { useSavedPlays } from '../hooks/useStorage';

const MiComponente = () => {
  const { 
    plays, 
    isLoading, 
    error, 
    addPlay, 
    updatePlay, 
    deletePlay,
    deleteMultiplePlays,
    reloadPlays 
  } = useSavedPlays();

  // Agregar nueva jugada
  const handleSavePlay = async () => {
    try {
      const newPlay = {
        lottery: 'Georgia',
        schedule: 'mediodia',
        playType: 'fijo',
        numbers: '12, 34, 56',
        amount: 100,
        total: 300,
        note: 'Juan Pérez',
        result: 'no disponible',
        prize: 'desconocido',
        hasPrize: false
      };
      
      await addPlay(newPlay);
      console.log('Jugada guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  // Actualizar resultado de una jugada
  const handleUpdateResult = async (playId) => {
    try {
      await updatePlay(playId, {
        result: '12',
        prize: 5000,
        hasPrize: true
      });
      console.log('Resultado actualizado');
    } catch (error) {
      console.error('Error al actualizar:', error);
    }
  };

  // Eliminar jugada
  const handleDeletePlay = async (playId) => {
    try {
      await deletePlay(playId);
      console.log('Jugada eliminada');
    } catch (error) {
      console.error('Error al eliminar:', error);
    }
  };

  if (isLoading) return <Text>Cargando...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Text>Total de jugadas: {plays.length}</Text>
      {/* Renderizar lista de jugadas */}
    </View>
  );
};
```

### 2. Hook para Configuraciones de la App

```javascript
import { useAppSettings } from '../hooks/useStorage';

const ConfiguracionComponente = () => {
  const { settings, isLoading, updateSettings } = useAppSettings();

  const toggleDarkMode = async () => {
    try {
      await updateSettings({ 
        isDarkMode: !settings.isDarkMode 
      });
    } catch (error) {
      console.error('Error al cambiar tema:', error);
    }
  };

  const updateVisibleModes = async (newModes) => {
    try {
      await updateSettings({ 
        visibleModes: newModes 
      });
    } catch (error) {
      console.error('Error al actualizar modos:', error);
    }
  };

  return (
    <View>
      <Switch 
        value={settings.isDarkMode} 
        onValueChange={toggleDarkMode} 
      />
    </View>
  );
};
```

### 3. Uso Directo de las Funciones de Storage

```javascript
import { SavedPlaysStorage } from '../utils/storage';

// Guardar jugada manualmente
const savePlay = async () => {
  try {
    const play = {
      lottery: 'Florida',
      schedule: 'noche',
      playType: 'corrido',
      numbers: '78, 90, 12',
      amount: 50,
      total: 150,
      note: 'María García',
      result: 'no disponible',
      prize: 'desconocido',
      hasPrize: false
    };

    const savedPlay = await SavedPlaysStorage.save(play);
    console.log('Jugada guardada:', savedPlay);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Obtener todas las jugadas
const getAllPlays = async () => {
  try {
    const plays = await SavedPlaysStorage.getAll();
    console.log('Jugadas encontradas:', plays.length);
    return plays;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};

// Limpiar todas las jugadas (para testing)
const clearAllPlays = async () => {
  try {
    await SavedPlaysStorage.clear();
    console.log('Todas las jugadas eliminadas');
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Estructura de Datos

### Jugada (Play)
```javascript
{
  id: 1234567890, // Timestamp único
  lottery: 'Georgia', // 'Georgia', 'Florida', 'New York'
  schedule: 'mediodia', // 'mediodia', 'noche'
  playType: 'fijo', // 'fijo', 'corrido', 'parle', 'centena', 'tripleta'
  numbers: '12, 34, 56', // Números separados por comas
  amount: 100, // Monto individual por número
  total: 300, // Total gastado
  note: 'Juan Pérez', // Nombre del dueño/nota
  timestamp: '2025-01-13T12:00:00', // Fecha y hora
  result: '12', // Resultado oficial o 'no disponible'
  prize: 5000, // Premio ganado o 'desconocido'
  hasPrize: true // true si ganó, false si no
}
```

### Configuraciones de la App
```javascript
{
  isDarkMode: false,
  visibleModes: { visual: true, text: true },
  defaultLottery: 'Georgia',
  defaultSchedule: 'mediodia'
}
```

## Funciones Disponibles

### SavedPlaysStorage
- `getAll()` - Obtener todas las jugadas
- `save(play)` - Guardar nueva jugada
- `update(playId, data)` - Actualizar jugada existente
- `delete(playId)` - Eliminar una jugada
- `deleteMultiple(playIds)` - Eliminar múltiples jugadas
- `clear()` - Limpiar todas las jugadas
- `initializeWithMockData()` - Inicializar con datos de prueba

### AppSettingsStorage
- `get()` - Obtener configuraciones
- `update(settings)` - Actualizar configuraciones

## Estado Actual

✅ **Implementado:**
- Sistema completo de almacenamiento local
- Hooks personalizados para React
- Datos de prueba con nicknames reales
- Jugadas con 20+ números para testing
- Gestión de errores y loading states
- Funciones de CRUD completas

🔄 **En uso:**
- ListButton ya implementa el almacenamiento local
- Datos se cargan automáticamente al abrir la app
- Eliminación de jugadas funciona con persistencia

📋 **Próximos pasos:**
1. Integrar el hook en otros componentes que necesiten guardar jugadas
2. Agregar funciones para importar/exportar datos
3. Implementar sincronización con servidor (futuro)
4. Agregar más configuraciones de usuario

## Ejemplo de Integración

Para agregar una nueva jugada desde cualquier componente:

```javascript
// En el componente donde se crean las jugadas
import { useSavedPlays } from '../hooks/useStorage';

const CrearJugadaComponente = () => {
  const { addPlay } = useSavedPlays();
  
  const handleSubmit = async (formData) => {
    try {
      await addPlay({
        lottery: formData.lottery,
        schedule: formData.schedule,
        playType: formData.playType,
        numbers: formData.numbers,
        amount: formData.amount,
        total: formData.total,
        note: formData.customerName,
        result: 'no disponible',
        prize: 'desconocido',
        hasPrize: false
      });
      
      // Mostrar confirmación
      Alert.alert('Éxito', 'Jugada guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la jugada');
    }
  };
};
```

El sistema está listo para usar y ya está funcionando en el ListButton con datos persistentes.
