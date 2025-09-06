// Parser para Modo Texto 2.0 (sintaxis basada en "con" y comandos en input)
// Exporta: parseTextMode2(rawText, { isLocked }) con misma forma de salida que parseTextMode

export function parseTextMode2(rawText, { isLocked = false } = {}) {
  const text = (rawText || '').trim();
  if (!text) return { instructions: [], errors: [], perLotterySum: 0 };

  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const instructions = [];
  const errors = [];

  const toInt = (s) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;
  const toFloat = (s) => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;
  const pad = (n, len) => String(n).replace(/[^0-9]/g, '').padStart(len, '0');
  const splitNums = (s) => s.split(/[^0-9]+/).map(x => x.trim()).filter(Boolean);
  const comb2 = (arr) => { const out = []; for(let i=0;i<arr.length;i++){ for(let j=i+1;j<arr.length;j++){ out.push([arr[i],arr[j]]);} } return out; };

  const GEN_PAIRS = () => Array.from({length:10}, (_,i)=> pad(i,2)).map(d => d[0]===d[1] ? d : null).filter(Boolean); // 00,11,...,99

  const parleCanonical = (n) => {
    if(n.length!==4) return n;
    const a=n.slice(0,2); const b=n.slice(2);
    return [a,b].sort().join('');
  };

  lines.forEach((line, idx) => {
    const lineNo = idx+1;

    // Verificar sintaxis x(...) para parle cruzado: ej. 35x(20 41 42 54) con 10p
    // Soporta también comandos P, D, T: Px(20 41) con 10p, D5x(12 34) con 15p, T7x(11 22) con 20p
    const xParenMatch = line.match(/^([Dd]\d|[Tt]\d|[Pp]|\d{1,2})x\(([^)]+)\)\s+con\s+(\d+(?:\.\d+)?)p$/i);
    if (xParenMatch) {
      const baseToken = xParenMatch[1];
      const innerNumbersStr = xParenMatch[2];
      const amountTotal = toFloat(xParenMatch[3]);
      
      if (amountTotal <= 0) { errors.push({ line: lineNo, message: 'Monto parle debe ser >0' }); return; }
      
      // Extraer números del paréntesis
      const innerNums = innerNumbersStr.split(/[\s.,]+/)
        .map(n => n.replace(/[^0-9]/g, ''))
        .filter(Boolean)
        .map(n => pad(n, 2))
        .filter(n => n.length === 2);
      
      if (innerNums.length === 0) { errors.push({ line: lineNo, message: 'Sin números válidos en paréntesis' }); return; }
      
      // Resolver el token base
      let baseNumbers = [];
      
      // Comando decenas: D4 -> 40-49
      if (baseToken.match(/^[Dd](\d)$/)) {
        const digit = parseInt(baseToken.match(/^[Dd](\d)$/)[1], 10);
        for(let u = 0; u <= 9; u++) {
          baseNumbers.push(`${digit}${u}`);
        }
      }
      // Comando terminales: T4 -> 04,14,24,34,44,54,64,74,84,94
      else if (baseToken.match(/^[Tt](\d)$/)) {
        const digit = parseInt(baseToken.match(/^[Tt](\d)$/)[1], 10);
        for(let d = 0; d <= 9; d++) {
          baseNumbers.push(`${d}${digit}`);
        }
      }
      // Comando parejas: P -> 00,11,22,33,44,55,66,77,88,99
      else if (baseToken.match(/^[Pp]$/)) {
        const pairs = ['00','11','22','33','44','55','66','77','88','99'];
        baseNumbers = pairs;
      }
      // Número directo
      else {
        baseNumbers = [pad(baseToken, 2)];
      }
      
      // Generar combinaciones: cada baseNumber con cada innerNum
      const parlePairs = [];
      for (const baseNum of baseNumbers) {
        for (const innerNum of innerNums) {
          parlePairs.push(baseNum + innerNum);
        }
      }
      
      let amountEach, totalPerLottery;
      if (isLocked) {
        amountEach = Math.floor(amountTotal / parlePairs.length) || 0;
        if (amountEach === 0) { errors.push({ line: lineNo, message: 'Monto insuficiente para repartir entre parle x(...)' }); return; }
        totalPerLottery = amountTotal;
      } else {
        amountEach = amountTotal;
        totalPerLottery = amountTotal * parlePairs.length;
      }
      
      instructions.push({ playType: 'parle', numbers: parlePairs, amountEach, totalPerLottery, meta: { mode: 'cross' }, line: lineNo });
      return;
    }

    const parts = line.split(/\s+con\s+/i);
    if (parts.length < 2) { errors.push({ line: lineNo, message: "Falta 'con'" }); return; }
    
    // Limpiar comas y espacios extra de la parte izquierda
    const left = parts[0].trim().replace(/,+$/, ''); // remover comas al final
    const right = parts.slice(1).join(' con ').trim(); // por si hay 'con' repetidos, unir y tratar como uno

    // 1) Resolver parte izquierda: números o comandos de centena
    let tokens = [];
    let inferredType = null; // '2d' | 'centena' | 'parle-direct' | 'tripleta'

    // Comando centena: c<d>(x|*)<pattern>
    let m = left.match(/^c\s*(\d)\s*[x\*]\s*(.+)$/i);
    if (m) {
      const c = m[1];
      const pattern = m[2].trim();
      let out = [];
      // c<d> x d<d>
      let md = pattern.match(/^d\s*(\d)$/i);
      let mt = pattern.match(/^t\s*(\d)$/i);
      let mp = pattern.match(/^p$/i);
      if (md) {
        const d = parseInt(md[1],10);
        for(let u=0; u<=9; u++) out.push(`${c}${d}${u}`);
      } else if (mt) {
        const u = parseInt(mt[1],10);
        for(let d=0; d<=9; d++) out.push(`${c}${d}${u}`);
      } else if (mp) {
        const pairs = ['00','11','22','33','44','55','66','77','88','99'];
        out = pairs.map(p => `${c}${p}`);
      } else {
        // lista de dos dígitos
        const arr = splitNums(pattern).map(n => pad(n,2)).filter(n => n.length===2);
        if(!arr.length){ errors.push({ line: lineNo, message: 'Sin números válidos en comando de centena' }); return; }
        out = arr.map(n => `${c}${n}`);
      }
      tokens = out;
      inferredType = 'centena';
    } 
    // Comando decenas: D4 o d5 -> 40-49 o 50-59
    else if (left.match(/^[Dd]\s*(\d)$/)) {
      const decenaMatch = left.match(/^[Dd]\s*(\d)$/);
      const digit = parseInt(decenaMatch[1], 10);
      let out = [];
      for(let u = 0; u <= 9; u++) {
        out.push(`${digit}${u}`);
      }
      tokens = out;
      inferredType = '2d';
    }
    // Comando terminales: T4 o t4 -> 04,14,24,34,44,54,64,74,84,94
    else if (left.match(/^[Tt]\s*(\d)$/)) {
      const terminalMatch = left.match(/^[Tt]\s*(\d)$/);
      const digit = parseInt(terminalMatch[1], 10);
      let out = [];
      for(let d = 0; d <= 9; d++) {
        out.push(`${d}${digit}`);
      }
      tokens = out;
      inferredType = '2d';
    }
    // Comando parejas: P o p -> 00,11,22,33,44,55,66,77,88,99
    else if (left.match(/^[Pp]$/)) {
      const pairs = ['00','11','22','33','44','55','66','77','88','99'];
      tokens = pairs;
      inferredType = '2d';
    }
    // Detectar si hay mezcla de comandos y números directos
    else if (left.match(/([dDtTpP]\d*|\d{2,6})/)) {
      // Dividir por espacios y otros separadores (igual que splitNums)
      const allTokens = left.split(/[^0-9dDtTpP]+/).filter(Boolean);
      let allNumbers = []; // Usar array normal para mantener todos los números, incluyendo duplicados
      let hasCommands = false;
      let hasDirectNumbers = false;
      
      for (const token of allTokens) {
        let tokenNumbers = [];
        
        // Procesar comando de decena
        if (token.match(/^[Dd](\d)$/)) {
          hasCommands = true;
          const digit = parseInt(token.match(/^[Dd](\d)$/)[1], 10);
          for(let u = 0; u <= 9; u++) {
            tokenNumbers.push(pad(`${digit}${u}`, 2));
          }
        }
        // Procesar comando de terminal
        else if (token.match(/^[Tt](\d)$/)) {
          hasCommands = true;
          const digit = parseInt(token.match(/^[Tt](\d)$/)[1], 10);
          for(let d = 0; d <= 9; d++) {
            tokenNumbers.push(pad(`${d}${digit}`, 2));
          }
        }
        // Procesar comando de parejas
        else if (token.match(/^[Pp]$/)) {
          hasCommands = true;
          tokenNumbers = ['00','11','22','33','44','55','66','77','88','99'];
        }
        // Procesar número directo
        else if (token.match(/^\d{2,6}$/)) {
          hasDirectNumbers = true;
          const num = token.replace(/[^0-9]/g, '');
          if ([2,3,4,6].includes(num.length)) {
            tokenNumbers.push(pad(num, num.length));
          }
        }
        
        // Agregar todos los números del token actual
        allNumbers.push(...tokenNumbers);
      }
      
      if (allNumbers.length > 0) {
        tokens = allNumbers;
        // Determinar el tipo basado en la longitud más común o si hay comandos
        if (hasCommands && hasDirectNumbers) {
          // Mezcla de comandos y números directos
          const directNums = allNumbers.filter(n => !hasCommands || n.length === 2);
          if (directNums.length > 0) {
            const commonLength = directNums[0].length;
            if (commonLength === 2) inferredType = '2d';
            else if (commonLength === 3) inferredType = 'centena';
            else if (commonLength === 4) inferredType = 'parle-direct';
            else if (commonLength === 6) inferredType = 'tripleta';
          } else {
            inferredType = '2d'; // Default para comandos
          }
        } else if (hasCommands) {
          inferredType = '2d'; // Solo comandos
        } else {
          // Solo números directos
          const lens = new Set(allNumbers.map(n => n.length));
          if (lens.size !== 1) { errors.push({ line: lineNo, message: 'Longitudes mezcladas' }); return; }
          const L = [...lens][0];
          if (![2,3,4,6].includes(L)) { errors.push({ line: lineNo, message: 'Longitud no soportada' }); return; }
          if(L===2) inferredType = '2d';
          if(L===3) inferredType = 'centena';
          if(L===4) inferredType = 'parle-direct';
          if(L===6) inferredType = 'tripleta';
        }
      } else {
        errors.push({ line: lineNo, message: 'Sin números válidos encontrados' }); 
        return;
      }
    }
    else {
      // Números directos
      const arrRaw = splitNums(left);
      if(!arrRaw.length){ errors.push({ line: lineNo, message: 'Sin números' }); return; }
      const lens = new Set(arrRaw.map(n => n.length));
      if(lens.size !== 1){ errors.push({ line: lineNo, message: 'Longitudes mezcladas' }); return; }
      const L = [...lens][0];
      if (![2,3,4,6].includes(L)) { errors.push({ line: lineNo, message: 'Longitud no soportada' }); return; }
      tokens = arrRaw.map(n => pad(n, L));
      if(L===2) inferredType = '2d';
      if(L===3) inferredType = 'centena';
      if(L===4) inferredType = 'parle-direct';
      if(L===6) inferredType = 'tripleta';
    }

    // 2) Resolver parte derecha: comandos/montos
    const cmdTokens = right.split(/\s+/).filter(Boolean);
    if(!cmdTokens.length){ errors.push({ line: lineNo, message: 'Falta monto/comando' }); return; }

    // Acciones acumuladas
    let acc = {
      fijo: 0,
      corrido: 0,
      parlePer: 0,
      parleCan: 0,
      centena: 0,
      tripleta: 0,
      parleDirect: 0, // para 4 dígitos con monto por jugada
    };

    const parseCmd = (tok) => {
      const m = tok.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)?$/);
      if(!m) return null;
      const amount = toFloat(m[1]);
      const suf = (m[2]||'').toLowerCase();
      return { amount, suf };
    };

    // Interpretar tokens
    for(const tok of cmdTokens){
      const parsed = parseCmd(tok);
      if(!parsed){ errors.push({ line: lineNo, message: `Token inválido: ${tok}` }); return; }
      const { amount, suf } = parsed;
      if(amount <= 0){ errors.push({ line: lineNo, message: 'Monto debe ser >0' }); return; }

      if(!suf){
        // Sin sufijo: permitido solo para tipos no ambiguos (centena, parle-direct, tripleta)
        if(inferredType === 'centena') acc.centena = amount; 
        else if(inferredType === 'parle-direct') acc.parleDirect = amount;
        else if(inferredType === 'tripleta') acc.tripleta = amount;
        else { errors.push({ line: lineNo, message: 'Monto sin sufijo no permitido para 2 dígitos' }); return; }
        continue;
      }

      if(suf === 'f') acc.fijo = amount;
      else if(suf === 'c') acc.corrido = amount;
      else if(suf === 'p') acc.parlePer = amount;
      else if(suf === 'can') acc.parleCan = amount;
      else if(suf === 'k') { // no especificado, pero ignoramos sufijos desconocidos con error
        errors.push({ line: lineNo, message: `Sufijo desconocido: ${suf}` }); return;
      } else {
        errors.push({ line: lineNo, message: `Sufijo desconocido: ${suf}` }); return;
      }
    }

    // 3) Emisión de instrucciones según tipo inferido y comandos
    const emit = (obj) => instructions.push({ ...obj, line: lineNo });

    if(inferredType === '2d'){
      const nums2 = tokens.map(n => pad(n,2));
      const count = nums2.length;
      if(acc.fijo>0) emit({ playType:'fijo', numbers: nums2, amountEach:acc.fijo, totalPerLottery: acc.fijo*count });
      if(acc.corrido>0) emit({ playType:'corrido', numbers: nums2, amountEach:acc.corrido, totalPerLottery: acc.corrido*count });

      if(acc.parlePer>0 || acc.parleCan>0){
        const pairs = comb2(nums2).map(([a,b])=> a+b);
        if(pairs.length===0){ errors.push({ line: lineNo, message:'Parle requiere >=2 números' }); return; }
        if(acc.parlePer>0){
          emit({ playType:'parle', numbers:pairs, amountEach:acc.parlePer, totalPerLottery: acc.parlePer * pairs.length, meta:{ mode:'pairs' } });
        }
        if(acc.parleCan>0){
          let each = Math.floor(acc.parleCan / pairs.length);
          if(each<=0){ errors.push({ line: lineNo, message:'Monto insuficiente para repartir entre parle' }); return; }
          emit({ playType:'parle', numbers:pairs, amountEach:each, totalPerLottery: acc.parleCan, meta:{ mode:'pairs', locked:true } });
        }
      }
      if(acc.fijo===0 && acc.corrido===0 && acc.parlePer===0 && acc.parleCan===0){ errors.push({ line: lineNo, message:'Falta tipo de jugada (f,c,p,can)' }); return; }
    }
    else if(inferredType === 'centena'){
      const nums3 = tokens.map(n => pad(n,3));
      if(acc.centena<=0){ errors.push({ line: lineNo, message:'Monto centena debe ser >0' }); return; }
      emit({ playType:'centena', numbers: nums3, amountEach: acc.centena, totalPerLottery: acc.centena * nums3.length });
    }
    else if(inferredType === 'parle-direct'){
      const nums4 = tokens.map(n => pad(n,4));
      const count = nums4.length;
      // Permitir p/can también aquí además de monto simple
      if(acc.parlePer>0){ emit({ playType:'parle', numbers: nums4, amountEach: acc.parlePer, totalPerLottery: acc.parlePer * count, meta:{ mode:'direct' } }); }
      if(acc.parleCan>0){
        let each = Math.floor(acc.parleCan / count);
        if(each<=0){ errors.push({ line: lineNo, message:'Monto insuficiente para repartir entre parle' }); return; }
        emit({ playType:'parle', numbers: nums4, amountEach: each, totalPerLottery: acc.parleCan, meta:{ mode:'direct', locked:true } });
      }
      if(acc.parlePer===0 && acc.parleCan===0 && acc.parleDirect>0){
        emit({ playType:'parle', numbers: nums4, amountEach: acc.parleDirect, totalPerLottery: acc.parleDirect * count, meta:{ mode:'direct' } });
      }
      if(acc.parlePer===0 && acc.parleCan===0 && acc.parleDirect===0){ errors.push({ line: lineNo, message:'Falta monto parle' }); return; }
    }
    else if(inferredType === 'tripleta'){
      const nums6 = tokens.map(n => pad(n,6));
      if(acc.tripleta<=0){ errors.push({ line: lineNo, message:'Monto tripleta debe ser >0' }); return; }
      emit({ playType:'tripleta', numbers: nums6, amountEach: acc.tripleta, totalPerLottery: acc.tripleta * nums6.length });
    }
  });

  // Duplicados (mismo criterio que parser original)
  const duplicateMap = {};
  instructions.forEach(inst => {
    inst.numbers.forEach(n => {
      let keyNumber = n;
      if(inst.playType==='parle') keyNumber = parleCanonical(n);
      const key = inst.playType + '|' + keyNumber;
      duplicateMap[key] = (duplicateMap[key] || 0) + 1;
    });
  });
  const duplicateSet = new Set(Object.keys(duplicateMap).filter(k => duplicateMap[k] > 1));
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
