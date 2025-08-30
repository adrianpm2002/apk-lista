// Utilidades para estadísticas del listero

export const mockPlays = [
  // Dos loterías, tres horarios, últimos 7 días
  // Lotería A
  { id:1, date:'2025-08-17', lottery:'Lotería A', schedule:'Matutino', numbers:'12,34,56', amount:100, paid:0, collected:300, result:'1234', note:'Cliente 1' },
  { id:2, date:'2025-08-17', lottery:'Lotería A', schedule:'Vespertino', numbers:'78,90', amount:200, paid:400, collected:400, result:'7890', note:'' },
  { id:3, date:'2025-08-18', lottery:'Lotería A', schedule:'Nocturno', numbers:'00,11', amount:150, paid:0, collected:300, result:'0011', note:'' },
  { id:4, date:'2025-08-19', lottery:'Lotería A', schedule:'Matutino', numbers:'22,33,44', amount:50, paid:0, collected:150, result:'2233', note:'' },
  // Lotería B
  { id:5, date:'2025-08-17', lottery:'Lotería B', schedule:'Matutino', numbers:'12,13,14', amount:100, paid:0, collected:300, result:'0000', note:'' },
  { id:6, date:'2025-08-18', lottery:'Lotería B', schedule:'Vespertino', numbers:'77', amount:500, paid:2000, collected:500, result:'7777', note:'Ganador' },
  { id:7, date:'2025-08-19', lottery:'Lotería B', schedule:'Nocturno', numbers:'88,99', amount:120, paid:0, collected:240, result:'8899', note:'' },
  { id:8, date:'2025-08-20', lottery:'Lotería B', schedule:'Vespertino', numbers:'45,54', amount:80, paid:0, collected:160, result:'4554', note:'' },
];

export const last7DaysSummary = () => {
  // Genera serie diaria de recogido vs pagado
  const byDay = new Map();
  mockPlays.forEach(p=>{
    if(!byDay.has(p.date)) byDay.set(p.date, { date:p.date, collected:0, paid:0, net:0 });
    const d = byDay.get(p.date);
    d.collected += Number(p.collected||0);
    d.paid += Number(p.paid||0);
    d.net = d.collected - d.paid;
  });
  return Array.from(byDay.values()).sort((a,b)=> a.date.localeCompare(b.date));
};

export const groupByLottery = () => {
  const groups = new Map();
  mockPlays.forEach(p=>{
    if(!groups.has(p.lottery)) groups.set(p.lottery, { id:p.lottery, title:p.lottery, rows:[] });
    groups.get(p.lottery).rows.push(p);
  });
  return Array.from(groups.values());
};

export const groupBySchedule = () => {
  const groups = new Map();
  mockPlays.forEach(p=>{
    if(!groups.has(p.schedule)) groups.set(p.schedule, { id:p.schedule, title:p.schedule, rows:[] });
    groups.get(p.schedule).rows.push(p);
  });
  return Array.from(groups.values());
};

export const quickKPIs = () => {
  const collected = mockPlays.reduce((s,p)=> s + (p.collected||0), 0);
  const paid = mockPlays.reduce((s,p)=> s + (p.paid||0), 0);
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
