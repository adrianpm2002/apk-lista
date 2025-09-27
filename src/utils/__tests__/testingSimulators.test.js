import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConnectionSimulator, useAppStateSimulator } from '../testingSimulators';

describe('useConnectionSimulator', () => {
  beforeEach(() => {
    AsyncStorage.clear();
    jest.clearAllMocks();
    // Restaurar console.log para las pruebas que lo necesiten
    global.console.log = jest.fn();
  });

  it('debe inicializar con valores por defecto', () => {
    const { result } = renderHook(() => useConnectionSimulator());
    
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.simulatedConnection).toBe(true);
  });

  it('debe iniciar simulación correctamente', async () => {
    const { result } = renderHook(() => useConnectionSimulator());

    await act(async () => {
      result.current.startSimulation();
    });

    expect(result.current.isSimulating).toBe(true);
    expect(global.console.log).toHaveBeenCalledWith(
      '🔧 Simulación de conexión activada:',
      'CONECTADO'
    );
  });

  it('debe detener simulación correctamente', async () => {
    const { result } = renderHook(() => useConnectionSimulator());

    await act(async () => {
      result.current.startSimulation();
      result.current.stopSimulation();
    });

    expect(result.current.isSimulating).toBe(false);
    expect(global.console.log).toHaveBeenCalledWith(
      '🔧 Simulación desactivada - Reinicia la app para usar conexión real'
    );
  });

  it('debe cambiar estado de conexión correctamente', async () => {
    const { result } = renderHook(() => useConnectionSimulator());

    await act(async () => {
      result.current.startSimulation();
      result.current.setConnectionState(false);
    });

    expect(result.current.simulatedConnection).toBe(false);
    expect(global.console.log).toHaveBeenCalledWith(
      '🔧 Estado de conexión simulado cambiado a:',
      'DESCONECTADO'
    );
  });

  it('debe alternar conexión correctamente', async () => {
    const { result } = renderHook(() => useConnectionSimulator());
    const initialState = result.current.simulatedConnection;

    await act(async () => {
      result.current.toggleConnection();
    });

    expect(result.current.simulatedConnection).toBe(!initialState);
  });

  it('debe guardar estado en AsyncStorage', async () => {
    const { result } = renderHook(() => useConnectionSimulator());

    await act(async () => {
      result.current.startSimulation();
      result.current.setConnectionState(false);
    });

    // Esperar un poco para que AsyncStorage procese
    await new Promise(resolve => setTimeout(resolve, 100));

    const savedState = await AsyncStorage.getItem('connection_simulation');
    expect(savedState).toBeTruthy();
    
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      expect(parsedState.isSimulating).toBe(true);
      expect(parsedState.simulatedConnection).toBe(false);
    }
  });
});

describe('useAppStateSimulator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.console.log = jest.fn();
  });

  it('debe inicializar con estado activo', () => {
    const { result } = renderHook(() => useAppStateSimulator());
    expect(result.current.simulatedAppState).toBe('active');
  });

  it('debe simular cambio de estado correctamente', () => {
    const { result } = renderHook(() => useAppStateSimulator());

    act(() => {
      result.current.simulateAppStateChange('background');
    });

    expect(result.current.simulatedAppState).toBe('background');
    expect(global.console.log).toHaveBeenCalledWith(
      '🔧 Simulando cambio de AppState: active -> background'
    );
  });

  it('debe simular minimizar app', () => {
    const { result } = renderHook(() => useAppStateSimulator());

    act(() => {
      result.current.simulateMinimizeApp();
    });

    expect(result.current.simulatedAppState).toBe('background');
  });

  it('debe simular restaurar app', () => {
    const { result } = renderHook(() => useAppStateSimulator());

    act(() => {
      result.current.simulateMinimizeApp();
      result.current.simulateRestoreApp();
    });

    expect(result.current.simulatedAppState).toBe('active');
  });

  it('debe simular app inactiva', () => {
    const { result } = renderHook(() => useAppStateSimulator());

    act(() => {
      result.current.simulateInactiveApp();
    });

    expect(result.current.simulatedAppState).toBe('inactive');
  });
});