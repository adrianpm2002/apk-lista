// Utilidad para parsear texto de jugadas en modo texto
// Exporta función parseTextMode(playsText, { isLocked })

export function parseTextMode(rawText, { isLocked = false } = {}) {
  const text = (rawText || '').trim();
  if (!text) {
    return { instructions: [], errors: [], perLotterySum: 0 };
  }
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const instructions = [];
  const errors = [];

  const numberSepRegex = /[\s.,]+/;
  const toInt = (s) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
  const comb2 = (arr) => { const out = []; for (let i = 0; i < arr.length; i++) { for (let j = i + 1; j < arr.length; j++) { out.push([arr[i], arr[j]]); } } return out; };

  lines.forEach((line, idx) => {
    if (line.includes('*')) {
      const [numsPart, amountPartRaw] = line.split(/-/); // un solo monto esperado
      if (!amountPartRaw) { errors.push({ line: idx + 1, message: 'Falta monto parle' }); return; }
      const amountTotal = toInt(amountPartRaw.trim());
      const baseNums = numsPart.split('*').map(n => n.replace(/[^0-9]/g, '').padStart(2, '0')).filter(n => n.length === 2);
      if (baseNums.length < 2) { errors.push({ line: idx + 1, message: 'Parle requiere >=2 números de 2 dígitos' }); return; }
      if (amountTotal <= 0) { errors.push({ line: idx + 1, message: 'Monto parle debe ser >0' }); return; }
      const pairs = comb2(baseNums).map(p => p[0] + p[1]);
      if (!pairs.length) { errors.push({ line: idx + 1, message: 'Sin combinaciones parle' }); return; }
      let amountEach; let totalPerLottery;
      if (isLocked) { // candado reparte
        amountEach = Math.floor(amountTotal / pairs.length) || 0;
        if (amountEach === 0) { errors.push({ line: idx + 1, message: 'Monto insuficiente para repartir entre parle' }); return; }
        totalPerLottery = amountTotal;
      } else {
        amountEach = amountTotal;
        totalPerLottery = amountTotal * pairs.length;
      }
      instructions.push({ playType: 'parle', numbers: pairs, amountEach, totalPerLottery, meta: { mode: 'pairs' } });
      return;
    }

    const parts = line.split('-').map(p => p.trim()).filter(p => p.length > 0 || p === '0' || p === '00');
    if (parts.length < 2) { errors.push({ line: idx + 1, message: 'Falta monto (guion)' }); return; }
    const numbersPart = parts[0];
    const amount1 = toInt(parts[1]);
    const amount2 = parts.length > 2 ? toInt(parts[2]) : 0;
    const rawNums = numbersPart.split(numberSepRegex).map(n => n.replace(/[^0-9]/g, '')).filter(Boolean);
    if (!rawNums.length) { errors.push({ line: idx + 1, message: 'Sin números' }); return; }
    const lenSet = new Set(rawNums.map(n => n.length));
    if (lenSet.size !== 1) { errors.push({ line: idx + 1, message: 'Longitudes mezcladas' }); return; }
    const tokenLen = rawNums[0].length;

    if (tokenLen === 2) {
      if (amount1 > 0) {
        instructions.push({ playType: 'fijo', numbers: rawNums.map(n => n.padStart(2, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length });
      }
      if (amount2 > 0) {
        instructions.push({ playType: 'corrido', numbers: rawNums.map(n => n.padStart(2, '0')), amountEach: amount2, totalPerLottery: amount2 * rawNums.length });
      }
      if (amount1 === 0 && amount2 === 0) { errors.push({ line: idx + 1, message: 'Ambos montos 0 (fijo/corrido)' }); return; }
      if (parts.length === 2 && amount1 === 0) { errors.push({ line: idx + 1, message: 'Monto fijo 0' }); return; }
    } else if (tokenLen === 3) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto centena debe ser >0' }); return; }
      instructions.push({ playType: 'centena', numbers: rawNums.map(n => n.padStart(3, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length });
    } else if (tokenLen === 4) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto parle debe ser >0' }); return; }
      instructions.push({ playType: 'parle', numbers: rawNums.map(n => n.padStart(4, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length, meta: { mode: 'direct' } });
    } else if (tokenLen === 6) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto tripleta debe ser >0' }); return; }
      instructions.push({ playType: 'tripleta', numbers: rawNums.map(n => n.padStart(6, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length });
    } else {
      errors.push({ line: idx + 1, message: 'Longitud no soportada' }); return;
    }
  });

  // Duplicados únicos por tipo
  const duplicateMap = {};
  instructions.forEach(inst => {
    inst.numbers.forEach(n => {
      const key = inst.playType + '|' + n;
      duplicateMap[key] = (duplicateMap[key] || 0) + 1;
    });
  });
  const duplicateSet = new Set();
  Object.keys(duplicateMap).forEach(k => { if (duplicateMap[k] > 1) duplicateSet.add(k.split('|')[1]); });
  const instructionsWithMeta = instructions.map(inst => ({ ...inst, duplicates: Array.from(new Set(inst.numbers.filter(n => duplicateSet.has(n)))) }));

  const perLotterySum = instructions.reduce((acc, i) => acc + (i.totalPerLottery || 0), 0);
  return { instructions: instructionsWithMeta, errors, perLotterySum };
}
