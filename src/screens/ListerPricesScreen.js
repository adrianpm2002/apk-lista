import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import { createShadowStyle } from '../utils/shadowUtils';
import { supabase } from '../supabaseClient';
import {
  fetchLotteriesByBank,
  fetchActiveJugadasByBank,
  getActiveJugadasForLottery,
  fetchPriceConfigsForListero,
  savePriceConfigForListero,
  fetchListeroClientsWithPrice,
  assignPriceToClients,
} from '../services/priceService';

const JUGADA_ORDER = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];

const ListerPricesScreen = ({ navigation }) => (
  <ScreenWrapper>
    <ListerPricesContent navigation={navigation} />
  </ScreenWrapper>
);

const ListerPricesContent = ({ navigation }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [listeroId, setListeroId] = useState(null);
  const [bankId, setBankId] = useState(null);

  const [lotteries, setLotteries] = useState([]);
  const [jugadasMap, setJugadasMap] = useState({});
  const [priceConfigs, setPriceConfigs] = useState([]);

  const [selectedLottery, setSelectedLottery] = useState('');
  const [configName, setConfigName] = useState('');
  const [pricing, setPricing] = useState({}); // { playType: { regular:'', limited:'' } }
  const [editingId, setEditingId] = useState(null);

  const [clients, setClients] = useState([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // client id or 'ALL'
  const [assignPriceId, setAssignPriceId] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile || profile.role !== 'listero') {
          Alert.alert('Permisos', 'Solo el listero puede gestionar precios de clientes.');
          setLoading(false);
          return;
        }
        setListeroId(user.id);
        if (!profile.id_banco) {
          Alert.alert('Perfil incompleto', 'No se encontró id_banco en el perfil del listero.');
          setLoading(false);
          return;
        }
        setBankId(profile.id_banco);
        await loadAll(profile.id_banco, user.id);
      } catch (e) {
        console.error('[lister-prices] init', e);
        Alert.alert('Error', 'No se pudieron cargar los datos iniciales.');
      }
      setLoading(false);
    };
    init();
  }, []);

  const loadAll = async (bank, listero) => {
    setLoading(true);
    try {
      const [lots, jugMap] = await Promise.all([
        fetchLotteriesByBank(bank),
        fetchActiveJugadasByBank(bank),
      ]);
      setLotteries(lots || []);
      setJugadasMap(jugMap || {});
      await refreshPrices(listero, bank);
      await refreshClients(listero);
    } catch (e) {
      console.error('[lister-prices] loadAll', e);
    }
    setLoading(false);
  };

  const refreshPrices = async (listero, bank) => {
    const list = await fetchPriceConfigsForListero(listero, bank);
    setPriceConfigs(list || []);
  };

  const refreshClients = async (listero) => {
    const list = await fetchListeroClientsWithPrice(listero);
    setClients(list || []);
  };

  const activeJugadasForSelected = useMemo(() => {
    const lotId = selectedLottery || '';
    const actives = getActiveJugadasForLottery(jugadasMap, lotId);
    // ordenar según JUGADA_ORDER
    return [...actives].sort((a, b) => JUGADA_ORDER.indexOf(a) - JUGADA_ORDER.indexOf(b));
  }, [selectedLottery, jugadasMap]);

  const handleSelectLottery = (option) => {
    const val = option?.value || '';
    setSelectedLottery(val);
    // reset pricing for active jugadas
    const next = {};
    getActiveJugadasForLottery(jugadasMap, val).forEach(j => {
      next[j] = { regular: '', limited: '' };
    });
    setPricing(next);
  };

  const setPriceField = (playType, field, value) => {
    // Permitir solo números y punto decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Evitar múltiples puntos decimales
    const parts = cleaned.split('.');
    const validValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    
    setPricing(prev => ({
      ...prev,
      [playType]: {
        ...(prev[playType] || {}),
        [field]: validValue,
      }
    }));
  };

  const validateAndBuildPayload = () => {
    if (!selectedLottery) throw new Error('Selecciona una lotería.');
    if (!configName.trim()) throw new Error('Ingresa un nombre para el precio.');
    const precios = {};
    activeJugadasForSelected.forEach(j => {
      const entry = pricing[j] || {};
      const reg = entry.regular?.toString?.().trim();
      const lim = entry.limited?.toString?.().trim();
      const hasAny = reg || lim;
      if (!hasAny) return;
      const parsed = {};
      if (reg) parsed.regular = parseFloat(reg);
      if (lim) parsed.limited = parseFloat(lim);
      precios[j] = parsed;
    });
    if (Object.keys(precios).length === 0) throw new Error('Debes ingresar al menos un valor para alguna jugada activa.');
    return precios;
  };

  const handleSavePrice = async () => {
    try {
      setSaving(true);
      const precios = validateAndBuildPayload();
      const payload = {
        id: editingId,
        nombre: configName,
        id_loteria: selectedLottery,
        precios,
      };
      const id = await savePriceConfigForListero(listeroId, bankId, payload);
      Alert.alert('Éxito', 'Precio guardado');
      setEditingId(null);
      await refreshPrices(listeroId, bankId);
      // reset form
      setConfigName('');
      setSelectedLottery('');
      setPricing({});
      setAssignPriceId(id || '');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
    setSaving(false);
  };

  const startEdit = (config) => {
    setEditingId(config.id);
    setConfigName(config.nombre || '');
    setSelectedLottery(config.id_loteria);
    const prepared = {};
    const jugadas = getActiveJugadasForLottery(jugadasMap, config.id_loteria);
    jugadas.forEach(j => {
      const v = config.precios?.[j] || {};
      prepared[j] = {
        regular: v.regular?.toString?.() || '',
        limited: v.limited?.toString?.() || '',
      };
    });
    setPricing(prepared);
  };

  const openAssignModalFor = (clientId) => {
    setAssignTarget(clientId);
    setAssignPriceId('');
    setAssignModalVisible(true);
  };

  const applyAssignment = async () => {
    if (!assignPriceId) {
      Alert.alert('Selecciona un precio para asignar');
      return;
    }
    setAssigning(true);
    try {
      const targetIds = assignTarget === 'ALL' ? clients.map(c => c.id) : [assignTarget];
      await assignPriceToClients(assignPriceId, targetIds);
      Alert.alert('Éxito', 'Precio asignado');
      await refreshClients(listeroId);
      setAssignModalVisible(false);
      setAssignPriceId('');
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo asignar');
    }
    setAssigning(false);
  };

  const priceOptions = useMemo(() => {
    return (priceConfigs || []).map(cfg => ({
      label: `${cfg.nombre} • ${cfg.loteriaNombre}${cfg.scope === 'banco' ? ' (banco)' : ''}`,
      value: cfg.id,
    }));
  }, [priceConfigs]);

  const priceNameById = (id) => {
    if (!id) return '—';
    const found = priceConfigs.find(p => p.id === id);
    return found ? `${found.nombre} (${found.loteriaNombre})` : '—';
  };

  const lotteryDropdownOptions = useMemo(() => (lotteries || []).map(l => ({ label: l.nombre, value: l.id })), [lotteries]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Precios de Clientes</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={styles.hintText}>Cargando datos...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{editingId ? 'Editar precio' : 'Crear precio'}</Text>
            <DropdownPicker
              label="Lotería"
              placeholder="Selecciona lotería"
              options={lotteryDropdownOptions}
              value={lotteries.find(l => l.id === selectedLottery)?.nombre || ''}
              onSelect={handleSelectLottery}
              style={{ marginTop: 8 }}
            />
            <InputField
              label="Nombre"
              value={configName}
              onChangeText={setConfigName}
              placeholder="Ej: Precio noche"
            />

            {activeJugadasForSelected.length === 0 ? (
              <Text style={styles.hintText}>Selecciona una lotería para ver jugadas activas.</Text>
            ) : (
              activeJugadasForSelected.map(j => (
                <View key={j} style={styles.playRow}>
                  <Text style={styles.playLabel}>{j}</Text>
                  <View style={styles.playInputsRow}>
                    <InputField
                      label="Regular"
                      value={pricing?.[j]?.regular || ''}
                      onChangeText={(t)=>setPriceField(j,'regular',t)}
                      keyboardType="numeric"
                    />
                    <InputField
                      label="Limitado"
                      value={pricing?.[j]?.limited || ''}
                      onChangeText={(t)=>setPriceField(j,'limited',t)}
                      keyboardType="numeric"
                    />
                  </View>
                  {/* Porcentajes para colectores/listeros gestionados por el banco; ocultos aquí */}
                </View>
              ))
            )}

            <TouchableOpacity style={[styles.actionButton, styles.saveButton, saving && styles.disabled]} onPress={handleSavePrice} disabled={saving}>
              <Text style={styles.actionText}>{saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Precios del listero</Text>
            </View>
            {priceConfigs.filter(p => p.scope === 'listero').length === 0 ? (
              <Text style={styles.hintText}>Sin precios creados.</Text>
            ) : (
              priceConfigs.filter(p => p.scope === 'listero').map(cfg => (
                <View key={cfg.id} style={styles.priceItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.priceTitle}>{cfg.nombre}</Text>
                    <Text style={styles.priceSubtitle}>{cfg.loteriaNombre}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => startEdit(cfg)}>
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Asignar a clientes</Text>
              <TouchableOpacity style={[styles.actionButton, styles.applyAllButton]} onPress={() => { setAssignTarget('ALL'); setAssignPriceId(''); setAssignModalVisible(true); }}>
                <Text style={styles.actionText}>Aplicar a todos</Text>
              </TouchableOpacity>
            </View>
            {clients.length === 0 ? (
              <Text style={styles.hintText}>Sin clientes.</Text>
            ) : (
              clients.map(c => (
                <View key={c.id} style={styles.clientRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{c.username || c.id.slice(0,8)}</Text>
                    <Text style={styles.clientPrice}>Precio: {priceNameById(c.id_precio)}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openAssignModalFor(c.id)}>
                    <Text style={styles.actionText}>Asignar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={assignModalVisible} transparent animationType="slide" onRequestClose={() => setAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{assignTarget === 'ALL' ? 'Asignar a todos' : 'Asignar precio'}</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}><Text style={styles.closeButton}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <DropdownPicker
                label="Precio"
                placeholder="Selecciona un precio"
                options={priceOptions}
                value={priceOptions.find(p => p.value === assignPriceId)?.label || ''}
                onSelect={(opt)=>setAssignPriceId(opt?.value || '')}
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setAssignModalVisible(false)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.saveButton, assigning && styles.disabled]} onPress={applyAssignment} disabled={assigning}>
                <Text style={styles.actionText}>{assigning ? 'Asignando...' : 'Aplicar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SideBar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation} role={'listero'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FDF5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8F5E8', ...createShadowStyle(0,2,'#000',0.1,4) },
  sidebarButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D5016', flex: 1, textAlign: 'center', marginRight: 40 },
  loadingBox: { padding: 24, alignItems: 'center' },
  hintText: { fontSize: 12, color: '#7f8c8d' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14, ...createShadowStyle(0,2,'#000',0.1,4) },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2D5016' },
  playRow: { marginTop: 8, marginBottom: 10, padding: 10, backgroundColor: '#F8F9FA', borderRadius: 8 },
  playLabel: { fontSize: 14, fontWeight: '700', color: '#2D5016', marginBottom: 6 },
  playInputsRow: { flexDirection: 'row', gap: 8 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  saveButton: { backgroundColor: '#27ae60', marginTop: 10 },
  editButton: { backgroundColor: '#3498db' },
  applyAllButton: { backgroundColor: '#8e44ad' },
  actionText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.7 },
  priceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e1e1' },
  priceTitle: { fontSize: 14, fontWeight: '600', color: '#2D5016' },
  priceSubtitle: { fontSize: 12, color: '#4F6B3A' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e1e1' },
  clientName: { fontSize: 14, fontWeight: '600', color: '#2D5016' },
  clientPrice: { fontSize: 12, color: '#4F6B3A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxHeight: '70%', ...createShadowStyle(0,4,'#000',0.3,8) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E8F5E8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D5016', flex: 1 },
  closeButton: { fontSize: 18, color: '#95a5a6', fontWeight: 'bold', padding: 5 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: '#E8F5E8' },
  cancelButton: { backgroundColor: '#e74c3c', marginRight: 8 },
});

export default ListerPricesScreen;
