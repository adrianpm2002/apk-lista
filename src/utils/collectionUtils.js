// Utilidades para verificar si hay recogida abierta (cualquier horario activo ahora)
import { supabase } from '../supabaseClient';

// Convierte 'HH:MM' o 'HH:MM:SS' a minutos desde 00:00
export const timeStringToMinutes = (str) => {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

// Determina si nowMin cae dentro de [startMin, endMin), manejando ventanas que cruzan medianoche
export const isNowInWindow = (startMin, endMin, nowMin) => {
  if (startMin == null || endMin == null || nowMin == null) return false;
  if (startMin === endMin) return false; // ventana vacía
  if (endMin > startMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Cruza medianoche: ejemplo 22:00 -> 02:00
  return nowMin >= startMin || nowMin < endMin;
};

/**
 * Consulta si alguna lotería del banco tiene un horario abierto ahora mismo.
 * Devuelve { open: boolean, openSchedules: Array<{ id, nombre, loteriaNombre, start, end }> }
 */
export async function isAnyScheduleOpenNow(bankId) {
  try {
    if (!bankId) return { open: false, openSchedules: [] };
    // 1) Traer loterías del banco
    const { data: lots, error: lotErr } = await supabase
      .from('loteria')
      .select('id, nombre')
      .eq('id_banco', bankId);
    if (lotErr) {
      console.error('[collectionUtils] Error cargando loterías:', lotErr);
      return { open: false, openSchedules: [] };
    }
    const lotIds = (lots || []).map(l => l.id);
    if (lotIds.length === 0) return { open: false, openSchedules: [] };
    // 2) Traer horarios de esas loterías
    const { data: horarios, error: horErr } = await supabase
      .from('horario')
      .select('id, nombre, id_loteria, hora_inicio, hora_fin')
      .in('id_loteria', lotIds);
    if (horErr) {
      console.error('[collectionUtils] Error cargando horarios:', horErr);
      return { open: false, openSchedules: [] };
    }
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const lotNameById = new Map((lots || []).map(l => [l.id, l.nombre]));
    const open = [];
    (horarios || []).forEach(h => {
      const startMin = timeStringToMinutes(h.hora_inicio);
      const endMin = timeStringToMinutes(h.hora_fin);
      if (isNowInWindow(startMin, endMin, nowMin)) {
        open.push({
          id: h.id,
          nombre: h.nombre,
          loteriaNombre: lotNameById.get(h.id_loteria) || '—',
          start: h.hora_inicio,
          end: h.hora_fin,
        });
      }
    });
    return { open: open.length > 0, openSchedules: open };
  } catch (e) {
    console.error('[collectionUtils] Excepción isAnyScheduleOpenNow:', e);
    return { open: false, openSchedules: [] };
  }
}
