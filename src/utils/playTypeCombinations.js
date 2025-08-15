export function applyPlayTypeSelection(previous, incomingValues, playTypesOptions){
  const valid = incomingValues.filter(v => playTypesOptions.some(pt => pt.value === v));
  const exclusive = ['parle','tripleta'];
  const exclusiveChosen = valid.filter(v=> exclusive.includes(v)).pop();
  if (exclusiveChosen) return [exclusiveChosen];
  let pool = Array.from(new Set(valid.filter(v => ['fijo','corrido','centena'].includes(v))));
  if (pool.length > 2) {
    const last = [...valid].reverse().find(v=> pool.includes(v));
    if (last === 'fijo') pool = ['fijo'];
    else if (['corrido','centena'].includes(last)) pool = ['fijo', last];
    else pool = [last];
  }
  if (pool.length === 2) {
    const key = pool.slice().sort().join('|');
    const allowed = ['corrido|fijo','centena|fijo'];
    if (!allowed.includes(key)) {
      const last = [...valid].reverse().find(v=> pool.includes(v));
      pool = [last];
    }
  }
  return pool;
}
