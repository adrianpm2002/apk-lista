import { supabase } from '../supabaseClient';

// Servicio para gestionar clientes y disponibilidad
export const fetchClientsForListero = async (listeroId) => {
  if (!listeroId) return [];
  const { data, error } = await supabase
    .from('cliente')
    .select('id_cliente, id_listero, loterias_disponibles, horarios_disponibles, activo')
    .eq('id_listero', listeroId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[clientService] Error fetchClientsForListero:', error);
    return [];
  }
  const list = data || [];
  // Resolver nombres visibles desde profiles en paralelo
  const names = await Promise.all(list.map(async (c) => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', c.id_cliente)
        .maybeSingle();
      const display = prof?.username || null;
      return display || c.id_cliente?.slice(0,8);
    } catch (_) {
      return c.id_cliente?.slice(0,8);
    }
  }));
  return list.map((c, i) => ({ ...c, display_name: names[i] }));
};

// Sincroniza clientes: toma perfiles con role='client' del listero y asegura filas en tabla cliente
export const syncClientsFromProfiles = async (listeroId) => {
  if (!listeroId) return { inserted: 0, existing: 0 };

  // 1) Leer perfiles de clientes que pertenecen a este listero
  const { data: profileClients, error: profErr } = await supabase
    .from('profiles')
    .select('id, role, lister_id')
    .eq('role', 'client')
    .eq('lister_id', listeroId);
  if (profErr) {
    console.error('[clientService] Error leyendo profiles clientes:', profErr);
    return { inserted: 0, existing: 0 };
  }

  const profileIds = (profileClients || []).map(p => p.id);
  if (profileIds.length === 0) return { inserted: 0, existing: 0 };

  // 2) Leer clientes ya existentes en tabla cliente
  const { data: existingRows, error: existErr } = await supabase
    .from('cliente')
    .select('id_cliente')
    .in('id_cliente', profileIds);
  if (existErr) {
    console.error('[clientService] Error leyendo cliente existentes:', existErr);
    return { inserted: 0, existing: 0 };
  }
  const existingIds = new Set((existingRows || []).map(r => r.id_cliente));

  // 3) Preparar inserts faltantes
  const toInsert = profileClients
    .filter(p => !existingIds.has(p.id))
    .map(p => ({ id_cliente: p.id, id_listero: listeroId, activo: true }));

  if (toInsert.length === 0) return { inserted: 0, existing: existingIds.size };

  const { error: insErr } = await supabase
    .from('cliente')
    .insert(toInsert);
  if (insErr) {
    console.error('[clientService] Error insertando clientes faltantes:', insErr);
    return { inserted: 0, existing: existingIds.size };
  }

  return { inserted: toInsert.length, existing: existingIds.size };
};

export const saveClientAvailability = async (idCliente, payload) => {
  // payload: { loterias: string[] | null, horarios: Array<{horario_id,loteria_id,window?:{start,end}}>|null, activo?:boolean }
  if (!idCliente) throw new Error('idCliente requerido');
  const update = {
    loterias_disponibles: payload?.loterias ?? null,
    horarios_disponibles: payload?.horarios ?? null,
  };
  if (payload?.activo !== undefined) update.activo = !!payload.activo;
  const { error } = await supabase
    .from('cliente')
    .update(update)
    .eq('id_cliente', idCliente);
  if (error) throw error;
  return true;
};

export const computeEffectiveLotteries = (listeroLotteries, clienteRow) => {
  // Si cliente no tiene configuradas, usar todas las del listero
  const ids = clienteRow?.loterias_disponibles;
  if (!ids || (Array.isArray(ids) && ids.length === 0)) return listeroLotteries;
  return (listeroLotteries || []).filter(l => ids.includes(l.value || l.id));
};

export const computeEffectiveSchedules = (openSchedulesGrouped, clienteRow) => {
  // openSchedulesGrouped: { loteriaId: [{ label, value, meta: { hora_inicio, hora_fin } }] }
  // clienteRow.horarios_disponibles: array de { horario_id, loteria_id, window? }
  const result = {};
  const allowed = clienteRow?.horarios_disponibles;

  if (!allowed || (Array.isArray(allowed) && allowed.length === 0)) {
    // Usa los abiertos del listero tal cual
    return openSchedulesGrouped;
  }

  const byHorarioId = new Map();
  allowed.forEach(entry => {
    if (entry && entry.horario_id) {
      byHorarioId.set(entry.horario_id, entry);
    }
  });

  Object.keys(openSchedulesGrouped || {}).forEach(lotId => {
    const arr = openSchedulesGrouped[lotId] || [];
    const filtered = arr.filter(opt => byHorarioId.has(opt.value));
    // Adjuntar window al meta si existe
    const mapped = filtered.map(opt => {
      const cfg = byHorarioId.get(opt.value);
      return {
        ...opt,
        meta: {
          ...(opt.meta || {}),
          clientWindow: cfg?.window || null,
        }
      };
    });
    if (mapped.length) result[lotId] = mapped;
  });

  return result;
};

export const fetchClientById = async (idCliente) => {
  if (!idCliente) return null;
  const { data, error } = await supabase
    .from('cliente')
    .select('id_cliente, id_listero, loterias_disponibles, horarios_disponibles, activo')
    .eq('id_cliente', idCliente)
    .maybeSingle();
  if (error) {
    console.error('[clientService] Error fetchClientById:', error);
    return null;
  }
  return data || null;
};
