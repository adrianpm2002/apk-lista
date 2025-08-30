// Reglas:
// - parle y tripleta son exclusivas: si se elige una se deselecciona todo lo demás.
// - combinaciones válidas: fijo + corrido o fijo + centena (máx 2). "fijo" solo está permitido.
// - Al pasar de exclusivo -> combinable: si no hay base aún, se toma la última selección válida.
// - Al pasar de combinable -> exclusivo: mantener únicamente la exclusiva seleccionada.
// - NOTA: Se permite extender lógica sin romper interfaz existente.
export function applyPlayTypeSelection(previous, incomingValues, playTypesOptions){
  const valid = incomingValues.filter(v => playTypesOptions.some(pt => pt.value === v));
  const exclusive = ['parle','tripleta'];
  const justSelected = valid.filter(v => !previous.includes(v)).pop(); // última recién agregada

  // Si lo último agregado es exclusivo -> devolver sólo eso
  if (justSelected && exclusive.includes(justSelected)) {
    return [justSelected];
  }

  // Si antes había exclusivo y ahora se intenta agregar algo combinable
  const prevExclusive = previous.length === 1 && exclusive.includes(previous[0]);
  if (prevExclusive) {
    // El usuario quiere salir del modo exclusivo: iniciamos nueva base con la(s) selecciones no exclusivas
    const nonExclusive = valid.filter(v => !exclusive.includes(v));
    if (nonExclusive.length === 0) return previous; // nada que hacer
    // Mantener sólo la última no-exclusiva como base inicial
    const base = nonExclusive.pop();
    return [base];
  }

  // Modo combinable normal
  let pool = Array.from(new Set(valid.filter(v => ['fijo','corrido','centena'].includes(v))));

  // Limitar a combinaciones válidas
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
