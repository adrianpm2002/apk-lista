import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { createShadowStyle } from '../utils/shadowUtils';
import { fetchClientsForListero, fetchBankLotteryLimits, fetchActiveJugadasByBank, saveClientLimits, bulkSaveClientLimitsForListero } from '../services/clientService';

const JUGADA_ORDER = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];

const ListerClientLimitsScreen = ({ navigation }) => (
  <ScreenWrapper>
    <ListerClientLimitsContent navigation={navigation} />
  </ScreenWrapper>
);

const ListerClientLimitsContent = ({ navigation }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listeroId, setListeroId] = useState(null);
  const [bankId, setBankId] = useState(null);

  const [lotteries, setLotteries] = useState([]);
  const [bankLimits, setBankLimits] = useState({});
  const [activeJugadas, setActiveJugadas] = useState({});
  const [clients, setClients] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [targetClient, setTargetClient] = useState(null); // null | {id_cliente,...} | 'ALL'
  const [currentLimits, setCurrentLimits] = useState({}); // {lotId: { jugada: string }}

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
          Alert.alert('Permisos', 'Solo el listero puede gestionar límites de clientes.');
          setLoading(false);
          return;
        }
        setListeroId(user.id);
        setBankId(profile.id_banco || user.id);
        await loadData(profile.id_banco || user.id, user.id);
      } catch (e) {
        console.error('[lister-client-limits] init error', e);
        Alert.alert('Error', 'No se pudieron cargar los datos.');
      }
      setLoading(false);
    };
    init();
  }, []);

  const loadData = async (bank, lister) => {
    setLoading(true);
    try {
      const { data: lots } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bank)
        .order('nombre');
      const lotList = lots || [];
      setLotteries(lotList);
      const lotIds = lotList.map(l => l.id);
      const [limitsMap, jugadas] = await Promise.all([
        fetchBankLotteryLimits(lotIds),
        fetchActiveJugadasByBank(bank),
      ]);
      setBankLimits(limitsMap || {});
      setActiveJugadas(jugadas || {});
      const clientList = await fetchClientsForListero(lister);
      setClients(clientList || []);
    } catch (e) {
      console.error('[lister-client-limits] loadData error', e);
      Alert.alert('Error', 'No se pudieron cargar loterías o clientes.');
    }
    setLoading(false);
  };

  const getActiveJugadasList = (lotteryId) => {
    const config = activeJugadas[lotteryId] || {};
    return JUGADA_ORDER.filter(j => config[j]);
  };

  const openModalForClient = (client) => {
    setTargetClient(client);
    // Prefill limits for this client
    const existing = client?.limites_por_loteria || {};
    const prepared = {};
    Object.keys(existing || {}).forEach(lotId => {
      const jugMap = existing[lotId] || {};
      prepared[lotId] = {};
      Object.keys(jugMap).forEach(j => {
        prepared[lotId][j] = jugMap[j]?.toString?.() || '';
      });
    });
    setCurrentLimits(prepared);
    setModalVisible(true);
  };

  const openModalForAll = () => {
    setTargetClient('ALL');
    setCurrentLimits({});
    setModalVisible(true);
  };

  const handleLimitChange = (lotteryId, jugada, value) => {
    setCurrentLimits(prev => ({
      ...prev,
      [lotteryId]: {
        ...(prev[lotteryId] || {}),
        [jugada]: value,
      }
    }));
  };

  const renderClientItem = ({ item }) => {
    const limits = item.limites_por_loteria || {};
    const hasLimits = Object.keys(limits).length > 0;
    const previewChips = [];
    Object.keys(limits).slice(0, 2).forEach(lotId => {
      const jugMap = limits[lotId] || {};
      const firstJug = Object.keys(jugMap)[0];
      if (firstJug) {
        const lotName = lotteries.find(l => l.id === lotId)?.nombre || lotId.slice(0, 4);
        previewChips.push(`${lotName}: ${firstJug} ${jugMap[firstJug]}`);
      }
    });
    const more = hasLimits && Object.keys(limits).length > 2 ? ' + más' : '';

    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.display_name || item.id_cliente.slice(0,8)}</Text>
          {hasLimits ? (
            <Text style={styles.cardSubtitle}>Límites: {previewChips.join(' • ')}{more}</Text>
          ) : (
            <Text style={styles.cardSubtitle}>Sin límites personalizados</Text>
          )}
        </View>
        <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openModalForClient(item)}>
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const processLimits = () => {
    const cleaned = {};
    for (const lot of lotteries) {
      const lotId = lot.id;
      const jugadas = currentLimits[lotId] || {};
      const activeList = getActiveJugadasList(lotId);
      activeList.forEach(j => {
        const raw = jugadas[j];
        if (!raw) return;
        const num = parseFloat(raw);
        if (isNaN(num) || num <= 0) return;
        const bankLimit = bankLimits?.[lotId]?.[j];
        if (bankLimit !== undefined && bankLimit !== null && num > bankLimit) {
          throw new Error(`El límite de ${j} en ${lot.nombre} excede el del banco (${bankLimit}).`);
        }
        if (!cleaned[lotId]) cleaned[lotId] = {};
        cleaned[lotId][j] = num;
      });
    }
    return cleaned;
  };

  const saveLimits = async () => {
    if (!targetClient && targetClient !== 'ALL') return;
    setSaving(true);
    try {
      const payload = processLimits();
      if (targetClient === 'ALL') {
        await bulkSaveClientLimitsForListero(listeroId, Object.keys(payload).length ? payload : null);
      } else {
        await saveClientLimits(targetClient.id_cliente, Object.keys(payload).length ? payload : null);
      }
      Alert.alert('Éxito', 'Límites guardados');
      // refrescar lista
      const refreshed = await fetchClientsForListero(listeroId);
      setClients(refreshed || []);
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
    setSaving(false);
  };

  const renderLotteryLimitsForm = (lot) => {
    const activeList = getActiveJugadasList(lot.id);
    if (activeList.length === 0) return null;
    return (
      <View key={lot.id} style={styles.lotteryBlock}>
        <Text style={styles.lotteryTitle}>{lot.nombre}</Text>
        {activeList.map(j => {
          const bankLimit = bankLimits?.[lot.id]?.[j];
          const value = currentLimits?.[lot.id]?.[j] || '';
          return (
            <View key={`${lot.id}-${j}`} style={styles.limitRow}>
              <Text style={styles.limitLabel}>{j.charAt(0).toUpperCase() + j.slice(1)}</Text>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.limitInput}
                  value={value}
                  onChangeText={(t)=>handleLimitChange(lot.id, j, t)}
                  placeholder={bankLimit ? `Banco: ${bankLimit}` : '0.00'}
                  keyboardType="numeric"
                  placeholderTextColor="#95a5a6"
                />
                {bankLimit !== undefined && bankLimit !== null && (
                  <Text style={styles.hintText}>Máximo banco: {bankLimit}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const modalTitle = useMemo(() => {
    if (targetClient === 'ALL') return 'Límites para todos los clientes';
    return targetClient?.display_name ? `Límites - ${targetClient.display_name}` : 'Límites del cliente';
  }, [targetClient]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Límites de Clientes</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity style={[styles.actionButton, styles.applyAllButton]} onPress={openModalForAll}>
          <Text style={styles.actionText}>Aplicar a todos</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={styles.hintText}>Cargando loterías y clientes...</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id_cliente}
          renderItem={renderClientItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.hintText}>Sin clientes.</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeButton}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {lotteries.map(renderLotteryLimitsForm)}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.saveButton, saving && styles.disabledButton]} onPress={saveLimits} disabled={saving}>
                <Text style={styles.actionText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
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
  actionsBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', ...createShadowStyle(0,2,'#000',0.1,4) },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#2D5016' },
  cardSubtitle: { fontSize: 12, color: '#4F6B3A', marginTop: 4 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  editButton: { backgroundColor: '#3498db' },
  applyAllButton: { backgroundColor: '#8e44ad' },
  actionText: { color: '#fff', fontWeight: '600' },
  loadingBox: { padding: 24, alignItems: 'center' },
  hintText: { fontSize: 12, color: '#7f8c8d' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, width: '92%', maxHeight: '85%', ...createShadowStyle(0,4,'#000',0.3,8) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E8F5E8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D5016', flex: 1 },
  closeButton: { fontSize: 18, color: '#95a5a6', fontWeight: 'bold', padding: 5 },
  modalBody: { padding: 16 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: '#E8F5E8' },

  lotteryBlock: { marginBottom: 14, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 10 },
  lotteryTitle: { fontSize: 14, fontWeight: '700', color: '#2D5016', marginBottom: 8 },
  limitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  limitLabel: { width: 90, fontSize: 14, fontWeight: '600', color: '#2D5016' },
  limitInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#B8D4A8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#2D5016' },
  hintTextSmall: { fontSize: 11, color: '#7f8c8d' },

  cancelButton: { backgroundColor: '#e74c3c', marginRight: 8 },
  saveButton: { backgroundColor: '#27ae60' },
  disabledButton: { opacity: 0.7 },
});

export default ListerClientLimitsScreen;
