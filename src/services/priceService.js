import { supabase } from '../supabaseClient';

// Precios creados por listero (guardados en tabla precio con id_listero)

export const fetchLotteriesByBank = async (bankId) => {
  if (!bankId) return [];
  const { data, error } = await supabase
    .from('loteria')
    .select('id, nombre')
    .eq('id_banco', bankId)
    .order('nombre');
  if (error) {
    console.error('[priceService] fetchLotteriesByBank', error);
    return [];
  }
  return data || [];
};

// Devuelve el mapa jugadas_activas por lotería: { loteriaId: { fijo:true, ... } }
export const fetchActiveJugadasByBank = async (bankId) => {
  if (!bankId) return {};
  const { data, error } = await supabase
    .from('jugadas_activas')
    .select('jugadas')
    .eq('id_banco', bankId)
    .maybeSingle();
  if (error) {
    console.error('[priceService] fetchActiveJugadasByBank', error);
    return {};
  }
  return data?.jugadas || {};
};

export const getActiveJugadasForLottery = (jugadasMap, lotteryId) => {
  const config = jugadasMap?.[lotteryId] || {};
  return Object.keys(config).filter(k => config[k]);
};

// Lista precios del listero y del banco (para asignar)
export const fetchPriceConfigsForListero = async (listeroId, bankId) => {
  if (!listeroId || !bankId) return [];
  const { data, error } = await supabase
    .from('precio')
    .select(`id, nombre, precios, id_banco, id_listero, id_loteria, loteria:id_loteria(id, nombre)`) // join nombre lotería
    .eq('id_banco', bankId)
    .or(`id_listero.eq.${listeroId},id_listero.is.null`)
    .order('created_at', { ascending: false });
  if (error) {
    // Si la columna id_listero no existe en la tabla (migración no aplicada), avisar
    if (error?.code === '42703') {
      console.error('[priceService] fetchPriceConfigsForListero - missing column', error);
      throw new Error('La columna `id_listero` no existe en la tabla `precio`. Ejecuta el script `scripts/db/add_id_listero_to_precio.sql` en la base de datos (Supabase SQL editor) para agregarla.');
    }
    console.error('[priceService] fetchPriceConfigsForListero', error);
    return [];
  }
  const removePctFields = (precios) => {
    if (!precios || typeof precios !== 'object') return precios;
    const {
      pct_colector,
      pct_listero,
      porcentaje_colector,
      porcentaje_listero,
      pctCollector,
      pctListero,
      porcentajeColector,
      porcentajeListero,
      ...rest
    } = precios;
    return rest;
  };

  return (data || []).map(row => {
    const parsed = typeof row.precios === 'string' ? JSON.parse(row.precios) : row.precios;
    return {
      ...row,
      precios: removePctFields(parsed),
      loteriaNombre: row.loteria?.nombre || 'Lotería',
      scope: row.id_listero ? 'listero' : 'banco',
    };
  });
};

export const savePriceConfigForListero = async (listeroId, bankId, { id, nombre, id_loteria, precios }) => {
  if (!listeroId || !bankId) throw new Error('listeroId y bankId requeridos');
  if (!id_loteria) throw new Error('Lotería requerida');
  if (!nombre || !nombre.trim()) throw new Error('Nombre requerido');
  const payload = {
    nombre: nombre.trim(),
    id_loteria,
    precios,
    id_banco: bankId,
    id_listero: listeroId,
  };
  if (id) {
    const { error } = await supabase
      .from('precio')
      .update(payload)
      .eq('id', id)
      .eq('id_listero', listeroId);
    if (error) {
      if (error?.code === '42703') {
        throw new Error('No se puede actualizar: la columna `id_listero` no existe en la tabla `precio`. Ejecuta `scripts/db/add_id_listero_to_precio.sql` en la DB.');
      }
      throw error;
    }
    return id;
  }
  const { data, error } = await supabase
    .from('precio')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    if (error?.code === '42703') {
      throw new Error('No se puede insertar: la columna `id_listero` no existe en la tabla `precio`. Ejecuta `scripts/db/add_id_listero_to_precio.sql` en la DB.');
    }
    throw error;
  }
  return data?.id;
};

export const assignPriceToClients = async (priceId, clientIds) => {
  if (!priceId || !Array.isArray(clientIds) || clientIds.length === 0) return;
  const { error } = await supabase
    .from('profiles')
    .update({ id_precio: priceId })
    .in('id', clientIds);
  if (error) throw error;
};

export const fetchListeroClientsWithPrice = async (listeroId) => {
  if (!listeroId) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, id_precio')
    .eq('role', 'client')
    .eq('lister_id', listeroId)
    .order('username');
  if (error) {
    console.error('[priceService] fetchListeroClientsWithPrice', error);
    return [];
  }
  return data || [];
};
