// Parser para Modo Texto 2.0
// Sintaxis general: <numeros/expresiones> con <montos+tipo ...>
// Separadores de números: espacio, coma, punto, guion, asterisco
// Tipos de tokens de monto (orden libre): 10f (fijo), 20c (corrido), 15p (parle unitario), 60can (parle candado total)
// Si los números son de 4 dígitos y solo se pone "con 10" => parle directo.
// Si son de 3 dígitos => centena; si 6 => tripleta (mismo caso, solo monto sin sufijo)
// Comandos especiales antes de 'con':
//  c4x25.23.24  => centena 4 combinada con 25,23,24 -> 425,423,424
//  c4*d5        => centena 4 con decena 5 -> 450..459
//  c4xt5        => centena 4 con terminal 5 -> 405,415,..495
//  c4xp         => centena 4 con parejas (00..99 iguales) -> 400,411,..499
//  Nota: aceptamos x o * como separador tras la centena base.

export function parseTextMode2(rawText){
  const text=(rawText||'').trim();
  if(!text) return { instructions:[], errors:[], perLotterySum:0 };
  const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const instructions=[]; const errors=[];

  const SEP=/[\s,.*;-]+/;
  const toInt = (s)=> parseInt(s.replace(/[^0-9]/g,''),10)||0;
  const comb2=(arr)=>{ const out=[]; for(let i=0;i<arr.length;i++){ for(let j=i+1;j<arr.length;j++){ out.push(arr[i]+arr[j]); } } return out; };
  const parleCanonical=(n)=>{ if(n.length!==4) return n; const a=n.slice(0,2), b=n.slice(2); return [a,b].sort().join(''); };

  const expandCommandSegment=(segment)=>{
    // Devuelve lista de números (como strings) o lanza error string
    // Buscar patrones cH...(combinaciones)
    // Primero si coincide con c<d>[x|*]p
    const mPair = segment.match(/^c(\d)[x*]p$/i);
    if(mPair){ const h=mPair[1]; const arr=[]; for(let d=0; d<=9; d++){ arr.push(h+ String(d)+ String(d)); } return arr; }
    const mDec = segment.match(/^c(\d)[x*]d(\d)$/i);
    if(mDec){ const h=mDec[1], dec=mDec[2]; const arr=[]; for(let u=0; u<=9; u++){ arr.push(h+dec+u); } return arr; }
    const mTerm = segment.match(/^c(\d)[x*]t(\d)$/i);
    if(mTerm){ const h=mTerm[1], term=mTerm[2]; const arr=[]; for(let ten=0; ten<=9; ten++){ arr.push(h+ten+term); } return arr; }
    const mList = segment.match(/^c(\d)[x*]([0-9]{2}(?:[\s,.*;-][0-9]{2})*)$/i);
    if(mList){ const h=mList[1]; const rest=mList[2]; const nums=rest.split(SEP).filter(Boolean).map(n=> n.padStart(2,'0')); return nums.map(n=> h+n); }
    return null; // no comando
  };

  lines.forEach((line, idx)=>{
    const lineNum=idx+1;
    const parts=line.split(/\bcon\b/i);
    if(parts.length<2){ errors.push({ line:lineNum, message:'Falta palabra "con"'}); return; }
    const left=parts[0].trim();
    const right=parts.slice(1).join(' con ').trim();
    if(!left){ errors.push({ line:lineNum, message:'Sin números'}); return; }
    if(!right){ errors.push({ line:lineNum, message:'Sin montos'}); return; }

    // Expandir comandos en left
    let rawTokens=left.split(SEP).filter(Boolean);
    let numbers=[]; let hadCommand=false;
    for(const tok of rawTokens){
      const exp=expandCommandSegment(tok);
      if(Array.isArray(exp)){ numbers = numbers.concat(exp); hadCommand=true; }
      else if(exp===null){ // número normal
        const digits=tok.replace(/[^0-9]/g,'');
        if(digits){ numbers.push(digits); }
      }
    }
    if(!numbers.length){ errors.push({ line:lineNum, message:'Sin números válidos'}); return; }
    // Normalizar padding según longitud base detectada (si mezcla -> error)
    const lenSet=new Set(numbers.map(n=> n.length));
    if(lenSet.size!==1){ errors.push({ line:lineNum, message:'Longitudes mezcladas'}); return; }
    const tokenLen=[...lenSet][0];
    const padLen = tokenLen; // ya homogéneo
    numbers = numbers.map(n=> n.padStart(padLen,'0'));

    // Procesar parte derecha (montos y tipos)
    const actionTokens=right.split(/[\s]+/).filter(Boolean);
    if(!actionTokens.length){ errors.push({ line:lineNum, message:'Sin montos'}); return; }

    // Detectar patrones
    const playAmounts={ fijo:null, corrido:null, parleUnit:null, parleCanTotal:null, generic:null };
    for(const aTok of actionTokens){
      const lower=aTok.toLowerCase();
      let m;
      if((m=lower.match(/^(\d+)(can)$/))){ playAmounts.parleCanTotal=toInt(m[1]); continue; }
      if((m=lower.match(/^(\d+)(p)$/))){ playAmounts.parleUnit=toInt(m[1]); continue; }
      if((m=lower.match(/^(\d+)(f)$/))){ playAmounts.fijo=toInt(m[1]); continue; }
      if((m=lower.match(/^(\d+)(c)$/))){ playAmounts.corrido=toInt(m[1]); continue; }
      if(/^[0-9]+$/.test(lower)){ playAmounts.generic=toInt(lower); continue; }
      // token desconocido -> error suave
      errors.push({ line:lineNum, message:`Token inválido: ${aTok}` }); return;
    }

    const pushInstr=(playType, amountEach, totalPerLottery, meta)=>{
      if(amountEach<=0){ errors.push({ line:lineNum, message:`Monto inválido (${playType})` }); return false; }
      instructions.push({ playType, numbers:[...numbers], amountEach, totalPerLottery, line:lineNum, meta });
      return true;
    };

    // Resolver según longitudes / tipos implícitos
    if(tokenLen===2){
      // fijos / corridos y potencial parle (solo si hay >=2 nums y tipo parle presente)
      if(playAmounts.fijo){ pushInstr('fijo', playAmounts.fijo, playAmounts.fijo * numbers.length); }
      if(playAmounts.corrido){ pushInstr('corrido', playAmounts.corrido, playAmounts.corrido * numbers.length); }
      const haveParle = (playAmounts.parleUnit || playAmounts.parleCanTotal);
      if(numbers.length>=2 && haveParle){
        const combos=comb2(numbers);
        if(playAmounts.parleUnit){
          pushInstr('parle', playAmounts.parleUnit, playAmounts.parleUnit * combos.length, { mode:'pairs' });
        }
        if(playAmounts.parleCanTotal){
          const each = Math.floor(playAmounts.parleCanTotal / combos.length);
          if(each<=0){ errors.push({ line:lineNum, message:'Monto parle candado insuficiente' }); return; }
          pushInstr('parle', each, playAmounts.parleCanTotal, { mode:'pairs-locked', originalTotal: playAmounts.parleCanTotal });
        }
      }
      if(!playAmounts.fijo && !playAmounts.corrido && !haveParle){ errors.push({ line:lineNum, message:'Falta tipo de jugada (f/c/p/can)' }); return; }
    } else if(tokenLen===3){
      // centena
      if(playAmounts.generic){ pushInstr('centena', playAmounts.generic, playAmounts.generic * numbers.length); }
      else { errors.push({ line:lineNum, message:'Centena requiere monto simple' }); return; }
    } else if(tokenLen===4){
      // parle directo
      if(playAmounts.generic){ pushInstr('parle', playAmounts.generic, playAmounts.generic * numbers.length, { mode:'direct' }); }
      else if(playAmounts.parleUnit){ pushInstr('parle', playAmounts.parleUnit, playAmounts.parleUnit * numbers.length, { mode:'direct' }); }
      else { errors.push({ line:lineNum, message:'Parle directo requiere monto' }); return; }
    } else if(tokenLen===6){
      // tripleta
      if(playAmounts.generic){ pushInstr('tripleta', playAmounts.generic, playAmounts.generic * numbers.length); }
      else { errors.push({ line:lineNum, message:'Tripleta requiere monto simple' }); return; }
    } else {
      errors.push({ line:lineNum, message:'Longitud no soportada' }); return;
    }
  });

  // Duplicados (mismo approach que parser 1)
  const duplicateMap={};
  instructions.forEach(inst=>{
    inst.numbers.forEach(n=>{
      let key = inst.playType+'|'+ (inst.playType==='parle'? parleCanonical(n): n);
      duplicateMap[key]=(duplicateMap[key]||0)+1;
    });
  });
  const dupSet=new Set(Object.keys(duplicateMap).filter(k=> duplicateMap[k]>1));
  const withDup = instructions.map(inst=>{
    const dups=[]; inst.numbers.forEach(n=>{ const key=inst.playType+'|'+(inst.playType==='parle'?parleCanonical(n):n); if(dupSet.has(key)) dups.push(n); });
    return { ...inst, duplicates:[...new Set(dups)] };
  });
  const perLotterySum=withDup.reduce((a,i)=> a+(i.totalPerLottery||0),0);
  return { instructions: withDup, errors, perLotterySum };
}

export default parseTextMode2;
