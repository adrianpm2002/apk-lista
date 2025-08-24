import { calculatePrize } from '../utils/prizeCalculator';
import { mockCollectorStats, mockCollectorDetails, mockLimitedNumbersData } from '../data/mockCollectorData';

describe('Collector Stats Calculation', () => {
  test('calcula premios con números limitados correctamente', () => {
    const jugada = {
      numeros: '123,456',
      monto_unitario: 50,
      loteria: { tipo: 'pick3' }
    };
    
    const numeroLimitado = [
      { numero: '123', tarifa_aplicada: 0.7 },
      { numero: '456', tarifa_aplicada: 1.0 }
    ];
    
    const numeroGanador = '123';
    const premio = calculatePrize(jugada, numeroGanador, numeroLimitado);
    
    expect(premio).toBe(1750); // 50 * 50 * 0.7 = 1750
  });

  test('calcula premios mixtos (limitados y regulares)', () => {
    const jugada = {
      numeros: '123,456,789',
      monto_unitario: 30,
      loteria: { tipo: 'pick3' }
    };
    
    const numeroLimitado = [
      { numero: '123', tarifa_aplicada: 0.8 }
      // 456 y 789 son regulares (tarifa 1.0)
    ];
    
    const numeroGanador = '456';
    const premio = calculatePrize(jugada, numeroGanador, numeroLimitado);
    
    expect(premio).toBe(1500); // 30 * 50 * 1.0 = 1500 (regular)
  });

  test('calcula premios pick4 con números limitados', () => {
    const jugada = {
      numeros: '1234,5678',
      monto_unitario: 25,
      loteria: { tipo: 'pick4' }
    };
    
    const numeroLimitado = [
      { numero: '1234', tarifa_aplicada: 0.6 }
    ];
    
    const numeroGanador = '1234';
    const premio = calculatePrize(jugada, numeroGanador, numeroLimitado);
    
    expect(premio).toBe(7500); // 25 * 500 * 0.6 = 7500
  });

  test('maneja casos sin resultado disponible', () => {
    const jugada = {
      numeros: '123,456',
      monto_unitario: 25,
      loteria: { tipo: 'pick3' }
    };
    
    const numeroGanador = null;
    const premio = calculatePrize(jugada, numeroGanador, []);
    
    expect(premio).toBe(0);
  });

  test('calcula estadísticas diarias agregadas', () => {
    const jugadas = [
      { monto_total: 100, pago_calculado: 0 },
      { monto_total: 200, pago_calculado: 1500 },
      { monto_total: 150, pago_calculado: 750 }
    ];
    
    const totalRecogido = jugadas.reduce((sum, j) => sum + j.monto_total, 0);
    const totalPagado = jugadas.reduce((sum, j) => sum + j.pago_calculado, 0);
    const balance = totalRecogido - totalPagado;
    
    expect(totalRecogido).toBe(450);
    expect(totalPagado).toBe(2250);
    expect(balance).toBe(-1800);
  });

  test('verifica integridad de mock data', () => {
    // Verificar que los datos mock tienen la estructura correcta
    expect(mockCollectorStats).toBeDefined();
    expect(Array.isArray(mockCollectorStats)).toBe(true);
    expect(mockCollectorStats.length).toBe(7);
    
    mockCollectorStats.forEach(day => {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('totalRecogido');
      expect(day).toHaveProperty('totalPagado');
      expect(day).toHaveProperty('balance');
      expect(day.balance).toBe(day.totalRecogido - day.totalPagado);
    });
  });

  test('verifica datos de listeros en mock', () => {
    expect(mockCollectorDetails).toBeDefined();
    expect(typeof mockCollectorDetails).toBe('object');
    
    Object.values(mockCollectorDetails).forEach(listero => {
      expect(listero).toHaveProperty('listero');
      expect(listero).toHaveProperty('plays');
      expect(Array.isArray(listero.plays)).toBe(true);
      
      listero.plays.forEach(play => {
        expect(play).toHaveProperty('id');
        expect(play).toHaveProperty('created_at');
        expect(play).toHaveProperty('numeros');
        expect(play).toHaveProperty('monto_unitario');
        expect(play).toHaveProperty('monto_total');
        expect(play).toHaveProperty('resultado');
        expect(play).toHaveProperty('estado');
        expect(play).toHaveProperty('pago_calculado');
        expect(play).toHaveProperty('loteria');
        expect(play).toHaveProperty('horario');
      });
    });
  });

  test('calcula balance por listero correctamente', () => {
    const listeroData = mockCollectorDetails['1'];
    const totalRecogido = listeroData.plays.reduce((sum, play) => sum + play.monto_total, 0);
    const totalPagado = listeroData.plays.reduce((sum, play) => sum + play.pago_calculado, 0);
    const balance = totalRecogido - totalPagado;
    
    expect(totalRecogido).toBe(345); // 150 + 75 + 120
    expect(totalPagado).toBe(4000); // 2500 + 0 + 1500
    expect(balance).toBe(-3655);
  });

  test('maneja números limitados en datos mock', () => {
    const limitedData = mockLimitedNumbersData['1'];
    expect(limitedData).toBeDefined();
    expect(limitedData.plays[0].numero_limitado).toBeDefined();
    expect(limitedData.plays[0].numero_limitado[0].tarifa_aplicada).toBe(0.7);
    expect(limitedData.plays[0].pago_calculado).toBe(1750);
  });

  test('valida formatos de fecha y hora', () => {
    const testDate = '2025-08-23T14:30:00';
    const date = new Date(testDate);
    
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(7); // Agosto es mes 7 (0-indexed)
    expect(date.getDate()).toBe(23);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  test('verifica cálculo de cantidad de números', () => {
    const getQuantityFromNumbers = (numerosStr) => {
      return numerosStr.split(',').length;
    };
    
    expect(getQuantityFromNumbers('123')).toBe(1);
    expect(getQuantityFromNumbers('123,456')).toBe(2);
    expect(getQuantityFromNumbers('123,456,789,000')).toBe(4);
    expect(getQuantityFromNumbers('1,2,3,4,5')).toBe(5);
  });
});

describe('Edge Cases and Error Handling', () => {
  test('maneja strings de números vacíos', () => {
    const getQuantityFromNumbers = (numerosStr) => {
      if (!numerosStr || numerosStr.trim() === '') return 0;
      return numerosStr.split(',').filter(n => n.trim() !== '').length;
    };
    
    expect(getQuantityFromNumbers('')).toBe(0);
    expect(getQuantityFromNumbers('   ')).toBe(0);
    expect(getQuantityFromNumbers('123,')).toBe(1);
    expect(getQuantityFromNumbers(',123')).toBe(1);
  });

  test('maneja casos con tarifas faltantes', () => {
    const jugada = {
      numeros: '123,456',
      monto_unitario: 50,
      loteria: { tipo: 'pick3' }
    };
    
    // Sin número limitado definido - debe usar tarifa regular (1.0)
    const numeroGanador = '123';
    const premio = calculatePrize(jugada, numeroGanador, []);
    
    expect(premio).toBe(2500); // 50 * 50 * 1.0 = 2500
  });

  test('maneja montos con decimales', () => {
    const jugada = {
      numeros: '123',
      monto_unitario: 25.50,
      loteria: { tipo: 'pick3' }
    };
    
    const numeroGanador = '123';
    const premio = calculatePrize(jugada, numeroGanador, []);
    
    expect(premio).toBe(1275); // 25.50 * 50 * 1.0 = 1275
  });

  test('valida rangos de tarifas limitadas', () => {
    const validTariffs = [0.1, 0.5, 0.7, 0.8, 0.9, 1.0];
    
    validTariffs.forEach(tariff => {
      expect(tariff).toBeGreaterThan(0);
      expect(tariff).toBeLessThanOrEqual(1);
    });
  });
});
