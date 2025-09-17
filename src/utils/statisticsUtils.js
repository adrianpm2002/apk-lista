// Utilidades para estadísticas del listero - datos mock eliminados

// Funciones de utilidad para estadísticas sin datos mock
export const last7DaysSummary = (plays = []) => {
  // Genera serie diaria de recogido vs pagado desde datos reales
  const byDay = new Map();
  plays.forEach(p=>{
    if(!byDay.has(p.date)) byDay.set(p.date, { date:p.date, collected:0, paid:0, net:0 });
    const d = byDay.get(p.date);
    d.collected += Number(p.collected||0);
    d.paid += Number(p.paid||0);
    d.net = d.collected - d.paid;
  });
  return Array.from(byDay.values()).sort((a,b)=> a.date.localeCompare(b.date));
};

export const groupByLottery = (plays = []) => {
  const groups = new Map();
  plays.forEach(p=>{
    if(!groups.has(p.lottery)) groups.set(p.lottery, { id:p.lottery, title:p.lottery, rows:[] });
    groups.get(p.lottery).rows.push(p);
  });
  return Array.from(groups.values());
};

export const groupBySchedule = (plays = []) => {
  const groups = new Map();
  plays.forEach(p=>{
    if(!groups.has(p.schedule)) groups.set(p.schedule, { id:p.schedule, title:p.schedule, rows:[] });
    groups.get(p.schedule).rows.push(p);
  });
  return Array.from(groups.values());
};

export const quickKPIs = (plays = []) => {
  const collected = plays.reduce((s,p)=> s + (p.collected||0), 0);
  const paid = plays.reduce((s,p)=> s + (p.paid||0), 0);
  const net = collected - paid;
  return { collected, paid, net };
};

export const exportCSV = async (rows, fileName='estadisticas.csv') => {
  try{
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(',')].concat(rows.map(r=> headers.map(h=> JSON.stringify(r[h] ?? '')).join(','))).join('\n');
    // En RN/Expo real, se usaría expo-file-system + expo-sharing; aquí devolvemos string
    return { ok:true, csv };
  }catch(e){
    return { ok:false, error:e.message };
  }
};

export const exportPDF = async (summaryText='Resumen Estadísticas') => {
  // Placeholder: en implementación real usar react-native-print o expo-print
  return { ok:true, content: summaryText };
};
