// Utilidades para parsear resultados y calcular premios por jugada
// Reglas según requerimientos con ejemplo "234 5984"

// Canonicalización de parle: AB+CD ≡ CD+AB (ej. 3459 ≡ 5934)
export const canonicalParle = (n) => {
  if (!n || n.length !== 4) return n || '';
  const a = n.slice(0, 2);
  const b = n.slice(2);
  const alt = b + a;
  return alt < n ? alt : n;
};

// Parsear "NNN NNNN" → { pick3, pick4, fijo, corridos:[..], centena, parleWinners:Set(canonical 4d), tripletaWinners:Set(6d) }
export const parseResultado = (numeros) => {
  if (!/^[0-9]{3} [0-9]{4}$/.test(numeros || '')) return null;
  const [pick3, pick4] = numeros.split(' ');
  const fijo = pick3.slice(1); // últimos 2
  const pair1 = pick4.slice(0, 2);
  const pair2 = pick4.slice(2, 4);
  const corridos = [pair1, pair2];
  const centena = pick3;

  // Parle ganadores: 34+59, 34+84 y el pick4 completo; bidireccional vía canonicalParle
  const parleCandidates = [fijo + pair1, fijo + pair2, pick4];
  const parleWinners = new Set(parleCandidates.map(canonicalParle));

  // Tripleta: permutaciones de [fijo(2), pair1(2), pair2(2)] => 6 combinaciones de 6 dígitos
  const parts = [fijo, pair1, pair2];
  const tripletaWinners = new Set();
  const permute = (arr, l = 0) => {
    if (l === arr.length - 1) {
      tripletaWinners.add(arr.join(''));
      return;
    }
    for (let i = l; i < arr.length; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      permute(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  };
  permute(parts.slice());

  return { pick3, pick4, fijo, corridos, centena, parleWinners, tripletaWinners };
};

// Obtener set de ganadores por tipo (para comparación directa contra el número jugado)
export const winnersByType = (parsed, playType) => {
  if (!parsed) return new Set();
  switch (playType) {
    case 'fijo':
      return new Set([parsed.fijo]);
    case 'corrido':
      return new Set(parsed.corridos);
    case 'centena':
      return new Set([parsed.centena]);
    case 'parle':
      return new Set(parsed.parleWinners); // ojo: son canónicos
    case 'tripleta':
      return new Set(parsed.tripletaWinners);
    default:
      return new Set();
  }
};

// Calcula pago para una jugada dada, con resultado parseado, set de números limitados y precios
// play = { playType, numbers:"comma,sep", amount:number }
// limitedSet = Set de números limitados (strings) para ese horario
// prices = { fijo:{limited,regular}, corrido:{...}, centena:{...}, parle:{...}, tripleta:{...} }
export const evaluatePlay = (play, parsedResult, limitedSet, prices) => {
  const res = { hasPrize: false, pay: 0 };
  if (!play || !parsedResult || !prices) return res;

  const rawNums = (play.numbers || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!rawNums.length) return res;

  const winners = winnersByType(parsedResult, play.playType);
  const priceConf = prices[play.playType] || { limited: 0, regular: 0 };

  let total = 0;
  let any = false;
  for (const num of rawNums) {
    let isWin = false;
    if (play.playType === 'parle') {
      isWin = winners.has(canonicalParle(num));
    } else {
      isWin = winners.has(num);
    }
    if (isWin) {
      any = true;
      const limited = limitedSet?.has(num);
      const factor = limited ? Number(priceConf.limited || 0) : Number(priceConf.regular || 0);
      total += Number(play.amount || 0) * factor;
    }
  }
  res.hasPrize = any;
  res.pay = Number(total.toFixed(2));
  return res;
};

// Default/fallback de precios si el perfil no tiene id_precio asignado
export const DEFAULT_PRICES = {
  fijo: { limited: 50, regular: 80 },
  corrido: { limited: 50, regular: 80 },
  centena: { limited: 500, regular: 800 },
  parle: { limited: 900, regular: 1200 },
  tripleta: { limited: 10000, regular: 15000 },
};

// Formateo con 2 decimales (string)
export const formatMoney = (n) => (Number(n || 0).toFixed(2));
