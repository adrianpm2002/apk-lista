import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { createShadowStyle } from '../utils/shadowUtils';
import { fetchClientsForListero, saveClientLotteryLimits } from '../services/clientService';

const JUGADA_ORDER = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];

const ListeroClientLimitsScreen = ({ navigation }) => (
  <ScreenWrapper>
    <ListeroClientLimitsContent navigation={navigation} />
  </ScreenWrapper>
);

const ListeroClientLimitsContent = ({ navigation }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listeroId, setListeroId] = useState(null);
  const [bankId, setBankId] = useState(null);

  const [lotteries, setLotteries] = useState([]);
  const [activeJugadas, setActiveJugadas] = useState({});
  const [bankLimits, setBankLimits] = useState({}); // { loteriaId: { jugada: number } }

  const [clients, setClients] = useState([]);
  const [targetScope, setTargetScope] = useState('all'); // 'all' | 'client'
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [currentLimits, setCurrentLimits] = useState({});

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile || profile.role !== 'listero') {
        Alert.alert('Permisos', 'Solo listero puede gestionar límites');
        return;
      }
      setListeroId(user.id);
      setBankId(profile.id_banco);
      await Promise.all([loadLotteries(profile.id_banco), loadClients(user.id), loadActiveJugadas(profile.id_banco)]);
    };
    init();
  }, []);

  const loadLotteries = async (bank) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bank)
        .order('nombre');
      setLotteries(data || []);
      await loadBankLimits(data || []);
    } catch (e) {
      console.error('[ListeroLimits] loadLotteries', e);
    }
    setLoading(false);
  };

  const loadBankLimits = async (lotteriesList) => {
    try {
      const { data } = await supabase
        .from('limite_loteria')
        .select('id_loteria, limites')
        .in('id_loteria', lotteriesList.map(l => l.id));
      const map = {};
      (data || []).forEach(row => { map[row.id_loteria] = row.limites || {}; });
      setBankLimits(map);
    } catch (e) {
      console.warn('[ListeroLimits] loadBankLimits', e?.message);
      setBankLimits({});
    }
  };

  const loadActiveJugadas = async (bank) => {
    try {
      const { data } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bank)
        .maybeSingle();
      setActiveJugadas(data?.jugadas || {});
    } catch (e) {
      console.warn('[ListeroLimits] loadActiveJugadas', e?.message);
      setActiveJugadas({});
    }
  };

  const loadClients = async (listero) => {
    const list = await fetchClientsForListero(listero);
    setClients(list);
  };

  const getActiveJugadasList = (lotteryId) => {
    const lotteryJugadas = activeJugadas[lotteryId] || {};
    return JUGADA_ORDER.filter(j => lotteryJugadas[j] === true);
  };

  const openEditModal = (lottery) => {
    setSelectedLottery(lottery);
    // inicializar límites con vacíos (el guardado será por debajo del banco)
    const base = {};
    getActiveJugadasList(lottery.id).forEach(j => { base[j] = ''; });
    setCurrentLimits(base);
    setModalVisible(true);
  };

  const handleLimitChange = (jugada, value) => {
    setCurrentLimits(prev => ({ ...prev, [jugada]: value }));
  };

  const validateLimitsAgainstBank = () => {
    const bank = bankLimits[selectedLottery.id] || {};
    for (const [jugada, val] of Object.entries(currentLimits)) {
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) continue; // permitir vacío o >0
      const bankMax = bank[jugada];
      if (bankMax !== undefined && num > bankMax) {
        return { ok: false, msg: `El límite de ${jugada} (${num}) supera el del banco (${bankMax}).` };
      }
    }
    return { ok: true };
  };

  const saveLimits = async () => {
    if (!selectedLottery || !listeroId) return;
    const validation = validateLimitsAgainstBank();
    if (!validation.ok) {
      Alert.alert('Validación', validation.msg);
      return;
    }

    setSaving(true);
    try {
      const processed = {};
      Object.entries(currentLimits).forEach(([jugada, value]) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num > 0) processed[jugada] = num;
      });
      const limitsMap = { [selectedLottery.id]: processed };
      const target = targetScope === 'client'
        ? { scope: 'client', listeroId, clientId: selectedClientId }
        : { scope: 'all', listeroId };
      await saveClientLotteryLimits(target, limitsMap);
      Alert.alert('Éxito', 'Límites guardados');
      setModalVisible(false);
    } catch (e) {
      console.error('[ListeroLimits] saveLimits', e);
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
    setSaving(false);
  };

  const renderLotteryItem = ({ item }) => {
    const bank = bankLimits[item.id] || {};
    const active = getActiveJugadasList(item.id);
    return (
      <View style={styles.lotteryItem}>
        <View style={styles.lotteryInfo}>
          <Text style={styles.lotteryName}>{item.nombre}</Text>
          {active.length > 0 ? (
            <View style={styles.limitsPreview}>
              <Text style={styles.limitsPreviewTitle}>Límites del banco:</Text>
              <View style={styles.limitRow}>
                {active.map(j => (
                  <View key={j} style={styles.limitChip}>
                    <Text style={styles.limitChipText}>{j.charAt(0).toUpperCase()+j.slice(1)}: ${ (bank[j] ?? 0).toLocaleString() }</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.noLimitsText}>Sin jugadas activas</Text>
          )}
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
          <Text style={styles.editButtonText}>Establecer límites</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLimitInput = (jugada) => (
    <View key={jugada} style={styles.limitInputRow}>
      <Text style={styles.limitLabel}>{jugada.charAt(0).toUpperCase() + jugada.slice(1)}:</Text>
      <TextInput
        style={styles.limitInput}
        value={currentLimits[jugada]?.toString() || ''}
        onChangeText={(value) => handleLimitChange(jugada, value)}
        placeholder="0.00"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Límites por Cliente</Text>
      </View>

      <View style={styles.scopeRow}>
        <TouchableOpacity style={[styles.scopeButton, targetScope==='all' && styles.scopeButtonActive]} onPress={() => setTargetScope('all')}>
          <Text style={styles.scopeText}>Todos los clientes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.scopeButton, targetScope==='client' && styles.scopeButtonActive]} onPress={() => setTargetScope('client')}>
          <Text style={styles.scopeText}>Cliente específico</Text>
        </TouchableOpacity>
      </View>

      {targetScope === 'client' && (
        <FlatList
          data={clients}
          keyExtractor={(c) => c.id_cliente}
          horizontal
          style={{ maxHeight: 70, paddingHorizontal: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.clientPill, selectedClientId === item.id_cliente && styles.clientPillActive]}
              onPress={() => setSelectedClientId(item.id_cliente)}
            >
              <Text style={styles.clientPillText}>{item.display_name || item.id_cliente.slice(0,8)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={styles.loadingText}>Cargando loterías...</Text>
        </View>
      ) : (
        <FlatList
          data={lotteries}
          renderItem={renderLotteryItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {modalVisible && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Límites - {selectedLottery?.nombre}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.modalCloseButton}>×</Text></TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                {getActiveJugadasList(selectedLottery?.id).length > 0 ? (
                  getActiveJugadasList(selectedLottery.id).map(renderLimitInput)
                ) : (
                  <Text style={styles.noJugadasText}>No hay jugadas activas configuradas</Text>
                )}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]} onPress={saveLimits} disabled={saving}>
                  <Text style={styles.modalButtonText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <SideBar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation} role={'listero'} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FDF5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, paddingTop: 50, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8F5E8', ...createShadowStyle(0,2,'#000000',0.1,4) },
  sidebarButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D5016', flex: 1, textAlign: 'center', marginRight: 40 },
  scopeRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10 },
  scopeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0F3F4', marginRight: 8 },
  scopeButtonActive: { backgroundColor: '#E8F5E8' },
  scopeText: { color: '#2D5016', fontWeight: '600' },
  list: { flex: 1 },
  listContent: { padding: 20 },
  lotteryItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', ...createShadowStyle(0,2,'#000000',0.1,4) },
  lotteryInfo: { flex: 1, marginRight: 15 },
  lotteryName: { fontSize: 18, fontWeight: '600', color: '#2D5016', marginBottom: 8 },
  limitsPreview: { marginTop: 4 },
  limitsPreviewTitle: { fontSize: 12, fontWeight: '500', color: '#4CAF50', marginBottom: 6 },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  limitChip: { backgroundColor: '#E8F5E8', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 3 },
  limitChipText: { fontSize: 10, color: '#2D5016', fontWeight: '500' },
  noLimitsText: { fontSize: 12, color: '#e74c3c', fontStyle: 'italic' },
  editButton: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  editButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '90%', maxHeight: '80%', ...createShadowStyle(0,4,'#000000',0.3,8) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E8F5E8' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2D5016', flex: 1 },
  modalCloseButton: { fontSize: 24, color: '#95a5a6', fontWeight: 'bold', padding: 5 },
  modalBody: { padding: 20, maxHeight: 400 },
  limitInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  limitLabel: { fontSize: 16, fontWeight: '600', color: '#2D5016', width: 120, marginRight: 15 },
  limitInput: { flex: 1, backgroundColor: '#F8FDF5', borderWidth: 1, borderColor: '#B8D4A8', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#2D5016' },
  noJugadasText: { fontSize: 16, color: '#95a5a6', textAlign: 'center', paddingVertical: 40 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderTopWidth: 1, borderTopColor: '#E8F5E8' },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  cancelButton: { backgroundColor: '#e74c3c' },
  saveButton: { backgroundColor: '#4CAF50' },
  saveButtonDisabled: { backgroundColor: '#95a5a6' },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  clientPill: { backgroundColor: '#F0F3F4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  clientPillActive: { backgroundColor: '#E8F5E8' },
  clientPillText: { color: '#2D5016', fontWeight: '600' },
});

export default ListeroClientLimitsScreen;