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
  const toFloat = (s) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  const comb2 = (arr) => { const out = []; for (let i = 0; i < arr.length; i++) { for (let j = i + 1; j < arr.length; j++) { out.push([arr[i], arr[j]]); } } return out; };

  lines.forEach((line, idx) => {
    // Verificar comandos especiales P y T#
    if (line.match(/^P\s+con\s+/i)) {
      // P con 10f 10c 2p -> todos los números AA (00,11,22...99)
      const match = line.match(/^P\s+con\s+(\d+(?:\.\d+)?)f(?:\s+(\d+(?:\.\d+)?)c)?(?:\s+(\d+(?:\.\d+)?)p)?/i);
      if (!match) { errors.push({ line: idx + 1, message: 'Formato P inválido. Usar: P con XfYcZp' }); return; }
      
      const fixedAmount = toFloat(match[1]);
      const corridoAmount = match[2] ? toFloat(match[2]) : 0;
      const parleAmount = match[3] ? toFloat(match[3]) : 0;
      
      // Generar números AA (00, 11, 22, ..., 99)
      const aaNumbers = [];
      for (let i = 0; i <= 9; i++) {
        const num = i.toString() + i.toString();
        aaNumbers.push(num);
      }
      
      if (fixedAmount > 0) {
        instructions.push({ playType: 'fijo', numbers: aaNumbers, amountEach: fixedAmount, totalPerLottery: fixedAmount * aaNumbers.length, line: idx+1 });
      }
      if (corridoAmount > 0) {
        instructions.push({ playType: 'corrido', numbers: aaNumbers, amountEach: corridoAmount, totalPerLottery: corridoAmount * aaNumbers.length, line: idx+1 });
      }
      if (parleAmount > 0) {
        const pairs = comb2(aaNumbers).map(p => p[0] + p[1]);
        let amountEach, totalPerLottery;
        if (isLocked) {
          amountEach = Math.floor(parleAmount / pairs.length) || 0;
          if (amountEach === 0) { errors.push({ line: idx + 1, message: 'Monto insuficiente para repartir entre parles P' }); return; }
          totalPerLottery = parleAmount;
        } else {
          amountEach = parleAmount;
          totalPerLottery = parleAmount * pairs.length;
        }
        instructions.push({ playType: 'parle', numbers: pairs, amountEach, totalPerLottery, meta: { mode: 'pairs' }, line: idx+1 });
      }
      return;
    }
    
    // Verificar comando T# (terminal)
    if (line.match(/^T\d+\s+con\s+/i)) {
      // T7 con 100f 5p -> todos los números que terminan en 7
      const match = line.match(/^T(\d)\s+con\s+(\d+(?:\.\d+)?)f(?:\s+(\d+(?:\.\d+)?)c)?(?:\s+(\d+(?:\.\d+)?)p)?/i);
      if (!match) { errors.push({ line: idx + 1, message: 'Formato T# inválido. Usar: T# con XfYcZp' }); return; }
      
      const terminal = match[1];
      const fixedAmount = toFloat(match[2]);
      const corridoAmount = match[3] ? toFloat(match[3]) : 0;
      const parleAmount = match[4] ? toFloat(match[4]) : 0;
      
      // Generar números con terminal específico (07, 17, 27, ..., 97)
      const terminalNumbers = [];
      for (let i = 0; i <= 9; i++) {
        const num = i.toString() + terminal;
        terminalNumbers.push(num);
      }
      
      if (fixedAmount > 0) {
        instructions.push({ playType: 'fijo', numbers: terminalNumbers, amountEach: fixedAmount, totalPerLottery: fixedAmount * terminalNumbers.length, line: idx+1 });
      }
      if (corridoAmount > 0) {
        instructions.push({ playType: 'corrido', numbers: terminalNumbers, amountEach: corridoAmount, totalPerLottery: corridoAmount * terminalNumbers.length, line: idx+1 });
      }
      if (parleAmount > 0) {
        const pairs = comb2(terminalNumbers).map(p => p[0] + p[1]);
        let amountEach, totalPerLottery;
        if (isLocked) {
          amountEach = Math.floor(parleAmount / pairs.length) || 0;
          if (amountEach === 0) { errors.push({ line: idx + 1, message: `Monto insuficiente para repartir entre parles T${terminal}` }); return; }
          totalPerLottery = parleAmount;
        } else {
          amountEach = parleAmount;
          totalPerLottery = parleAmount * pairs.length;
        }
        instructions.push({ playType: 'parle', numbers: pairs, amountEach, totalPerLottery, meta: { mode: 'pairs' }, line: idx+1 });
      }
      return;
    }

    if (line.includes('*')) {
      const [numsPart, amountPartRaw] = line.split(/-/); // un solo monto esperado
      if (!amountPartRaw) { errors.push({ line: idx + 1, message: 'Falta monto parle' }); return; }
      const amountTotal = toFloat(amountPartRaw.trim());
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
  instructions.push({ playType: 'parle', numbers: pairs, amountEach, totalPerLottery, meta: { mode: 'pairs' }, line: idx+1 });
      return;
    }

    const parts = line.split('-').map(p => p.trim()).filter(p => p.length > 0 || p === '0' || p === '00');
    if (parts.length < 2) { errors.push({ line: idx + 1, message: 'Falta monto (guion)' }); return; }
    const numbersPart = parts[0];
    const amount1 = toFloat(parts[1]);
    const amount2 = parts.length > 2 ? toFloat(parts[2]) : 0;
  const rawNums = numbersPart.split(numberSepRegex).map(n => n.replace(/[^0-9]/g, '')).filter(Boolean);
  if(rawNums.some(n=> n.length===1 || n.length===5 || n.length>=7)) { errors.push({ line: idx+1, message:'Números con formatos inválidos' }); return; }
    if (!rawNums.length) { errors.push({ line: idx + 1, message: 'Sin números' }); return; }
    const lenSet = new Set(rawNums.map(n => n.length));
    if (lenSet.size !== 1) { errors.push({ line: idx + 1, message: 'Longitudes mezcladas' }); return; }
    const tokenLen = rawNums[0].length;

    if (tokenLen === 2) {
      if (amount1 > 0) {
  instructions.push({ playType: 'fijo', numbers: rawNums.map(n => n.padStart(2, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length, line: idx+1 });
      }
      if (amount2 > 0) {
  instructions.push({ playType: 'corrido', numbers: rawNums.map(n => n.padStart(2, '0')), amountEach: amount2, totalPerLottery: amount2 * rawNums.length, line: idx+1 });
      }
      if (amount1 === 0 && amount2 === 0) { errors.push({ line: idx + 1, message: 'Ambos montos 0 (fijo/corrido)' }); return; }
      if (parts.length === 2 && amount1 === 0) { errors.push({ line: idx + 1, message: 'Monto fijo 0' }); return; }
    } else if (tokenLen === 3) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto centena debe ser >0' }); return; }
  instructions.push({ playType: 'centena', numbers: rawNums.map(n => n.padStart(3, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length, line: idx+1 });
    } else if (tokenLen === 4) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto parle debe ser >0' }); return; }
  instructions.push({ playType: 'parle', numbers: rawNums.map(n => n.padStart(4, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length, meta: { mode: 'direct' }, line: idx+1 });
    } else if (tokenLen === 6) {
      if (amount1 <= 0) { errors.push({ line: idx + 1, message: 'Monto tripleta debe ser >0' }); return; }
  instructions.push({ playType: 'tripleta', numbers: rawNums.map(n => n.padStart(6, '0')), amountEach: amount1, totalPerLottery: amount1 * rawNums.length, line: idx+1 });
    } else {
      errors.push({ line: idx + 1, message: 'Longitud no soportada' }); return;
    }
  });

  // Duplicados únicos por tipo (parle considera inversión AB|CD == CD|AB)
  const duplicateMap = {};
  const parleCanonical = (n) => {
    if(n.length!==4) return n;
    const a = n.slice(0,2); const b = n.slice(2);
    // ordenar par lexicográficamente para canónico
    const canonical = [a,b].sort().join('');
    return canonical;
  };
  instructions.forEach(inst => {
    inst.numbers.forEach(n => {
      let keyNumber = n;
      if(inst.playType==='parle') keyNumber = parleCanonical(n);
      const key = inst.playType + '|' + keyNumber;
      duplicateMap[key] = (duplicateMap[key] || 0) + 1;
    });
  });
  const duplicateSet = new Set();
  Object.keys(duplicateMap).forEach(k => { if (duplicateMap[k] > 1) duplicateSet.add(k); });
  const instructionsWithMeta = instructions.map(inst => {
    const dups = new Set();
    inst.numbers.forEach(n => {
      let keyNumber = n;
      if(inst.playType==='parle') keyNumber = parleCanonical(n);
      const key = inst.playType + '|' + keyNumber;
      if(duplicateSet.has(key)) dups.add(n);
    });
    return { ...inst, duplicates: Array.from(dups) };
  });

  const perLotterySum = instructions.reduce((acc, i) => acc + (i.totalPerLottery || 0), 0);
  return { instructions: instructionsWithMeta, errors, perLotterySum };
}
