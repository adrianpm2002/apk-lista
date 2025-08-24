// Mock data para pruebas del Collector
export const mockCollectorStats = [
  {
    date: '2025-08-17',
    totalRecogido: 25450.00,
    totalPagado: 12300.50,
    balance: 13149.50
  },
  {
    date: '2025-08-18',
    totalRecogido: 28900.75,
    totalPagado: 15620.25,
    balance: 13280.50
  },
  {
    date: '2025-08-19',
    totalRecogido: 32100.00,
    totalPagado: 18450.75,
    balance: 13649.25
  },
  {
    date: '2025-08-20',
    totalRecogido: 29850.25,
    totalPagado: 16890.00,
    balance: 12960.25
  },
  {
    date: '2025-08-21',
    totalRecogido: 35200.50,
    totalPagado: 21450.25,
    balance: 13750.25
  },
  {
    date: '2025-08-22',
    totalRecogido: 38750.00,
    totalPagado: 24320.75,
    balance: 14429.25
  },
  {
    date: '2025-08-23',
    totalRecogido: 41200.25,
    totalPagado: 26850.50,
    balance: 14349.75
  }
];

export const mockCollectorDetails = {
  '1': {
    listero: 'Juan Pérez',
    plays: [
      {
        id: 1,
        created_at: '2025-08-23T14:30:00',
        numeros: '123,456,789',
        monto_unitario: 50.00,
        monto_total: 150.00,
        resultado: '456',
        estado: 'bingo',
        pago_calculado: 2500.00,
        loteria: 'Lotería Nacional',
        horario: 'Vespertino'
      },
      {
        id: 2,
        created_at: '2025-08-23T09:15:00',
        numeros: '001,002,003',
        monto_unitario: 25.00,
        monto_total: 75.00,
        resultado: 'resultado no disponible',
        estado: 'no cogió premio',
        pago_calculado: 0.00,
        loteria: 'Leidsa',
        horario: 'Matutino'
      },
      {
        id: 6,
        created_at: '2025-08-23T16:45:00',
        numeros: '555,666,777,888',
        monto_unitario: 30.00,
        monto_total: 120.00,
        resultado: '777',
        estado: 'bingo',
        pago_calculado: 1500.00,
        loteria: 'Lotería Nacional',
        horario: 'Vespertino'
      }
    ]
  },
  '2': {
    listero: 'María García',
    plays: [
      {
        id: 3,
        created_at: '2025-08-23T19:45:00',
        numeros: '555,777,999',
        monto_unitario: 100.00,
        monto_total: 300.00,
        resultado: '777',
        estado: 'bingo',
        pago_calculado: 5000.00,
        loteria: 'Lotería Nacional',
        horario: 'Nocturno'
      },
      {
        id: 7,
        created_at: '2025-08-23T12:20:00',
        numeros: '100,200',
        monto_unitario: 40.00,
        monto_total: 80.00,
        resultado: '300',
        estado: 'no cogió premio',
        pago_calculado: 0.00,
        loteria: 'Leidsa',
        horario: 'Matutino'
      }
    ]
  },
  '3': {
    listero: 'Carlos López',
    plays: [
      {
        id: 4,
        created_at: '2025-08-23T11:20:00',
        numeros: '111,222,333,444,555',
        monto_unitario: 20.00,
        monto_total: 100.00,
        resultado: '333',
        estado: 'bingo',
        pago_calculado: 1000.00,
        loteria: 'Leidsa',
        horario: 'Matutino'
      },
      {
        id: 5,
        created_at: '2025-08-23T16:10:00',
        numeros: '666,888',
        monto_unitario: 75.00,
        monto_total: 150.00,
        resultado: '999',
        estado: 'no cogió premio',
        pago_calculado: 0.00,
        loteria: 'Lotería Nacional',
        horario: 'Vespertino'
      },
      {
        id: 8,
        created_at: '2025-08-23T20:30:00',
        numeros: '123',
        monto_unitario: 60.00,
        monto_total: 60.00,
        resultado: '123',
        estado: 'bingo',
        pago_calculado: 3000.00,
        loteria: 'Lotería Nacional',
        horario: 'Nocturno'
      }
    ]
  }
};

// Mock data para casos de prueba con números limitados
export const mockLimitedNumbersData = {
  '1': {
    listero: 'Juan Pérez (Números Limitados)',
    plays: [
      {
        id: 101,
        created_at: '2025-08-23T14:30:00',
        numeros: '123,456',
        monto_unitario: 50.00,
        monto_total: 100.00,
        resultado: '123',
        estado: 'bingo',
        pago_calculado: 1750.00, // 50 * 50 * 0.7 (tarifa limitada)
        loteria: 'Lotería Nacional',
        horario: 'Vespertino',
        numero_limitado: [
          { numero: '123', tarifa_aplicada: 0.7 }
        ]
      },
      {
        id: 102,
        created_at: '2025-08-23T15:00:00',
        numeros: '789,456,123',
        monto_unitario: 30.00,
        monto_total: 90.00,
        resultado: '456',
        estado: 'bingo',
        pago_calculado: 1500.00, // 30 * 50 * 1.0 (regular)
        loteria: 'Lotería Nacional',
        horario: 'Vespertino',
        numero_limitado: [
          { numero: '123', tarifa_aplicada: 0.8 }
          // 789 y 456 son regulares
        ]
      }
    ]
  }
};

// Totales históricos mock
export const mockHistoricalTotals = {
  totalRecogidoHistorico: 125780.50,
  totalPagadoHistorico: 68420.25,
  balanceHistorico: 57360.25
};
