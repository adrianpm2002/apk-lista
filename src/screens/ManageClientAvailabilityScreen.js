import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import { createShadowStyle } from '../utils/shadowUtils';
import { fetchClientsForListero, saveClientAvailability, syncClientsFromProfiles } from '../services/clientService';
import { useRoute } from '@react-navigation/native';

const ManageClientAvailabilityScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <ManageClientAvailabilityContent navigation={navigation} onModeVisibilityChange={onModeVisibilityChange} />
    </ScreenWrapper>
  );
};

const ManageClientAvailabilityContent = ({ navigation }) => {
  const route = useRoute();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [listeroId, setListeroId] = useState(null);
  const [clients, setClients] = useState([]);
  const [lotteries, setLotteries] = useState([]);
  const [schedulesByLottery, setSchedulesByLottery] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [selectedLotteries, setSelectedLotteries] = useState([]); // values
  const [clientSchedules, setClientSchedules] = useState([]); // [{horario_id,loteria_id,window?}]

  // Cargar usuario (listero) y sus loterías/horarios
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role, id_banco').eq('id', user.id).maybeSingle();
      if (!profile || profile.role !== 'listero') {
        Alert.alert('Permisos', 'Solo el listero puede gestionar clientes.');
        setInitialLoading(false);
        return;
      }
      setListeroId(user.id);
      try {
        const { data: lots } = await supabase.from('loteria').select('id, nombre').eq('id_banco', profile.id_banco).order('nombre');
        setLotteries((lots||[]).map(l=>({ label: l.nombre, value: l.id })));
        const lotIds = (lots||[]).map(l=>l.id);
        const { data: horarios } = await supabase
          .from('horario')
          .select('id, nombre, id_loteria, hora_inicio, hora_fin')
          .in('id_loteria', lotIds);
        const grouped = {};
        (horarios||[]).forEach(h => {
          const key = h.id_loteria;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ label: `${h.nombre} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})`, value: h.id, meta: { hora_inicio: h.hora_inicio, hora_fin: h.hora_fin } });
        });
        setSchedulesByLottery(grouped);
        // Sincronizar registros de clientes desde profiles antes de listar
        try { await syncClientsFromProfiles(user.id); } catch (_) {}
        const list = await fetchClientsForListero(user.id);
        setClients(list);
      } catch (e) {
        setLoadingError(e?.message || 'No se pudo cargar loterías/horarios');
      }
      setInitialLoading(false);
    };
    load();
  }, []);

  const openClientModal = (client) => {
    setSelectedClient(client);
    // Cargar nombre del cliente desde profiles
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', client.id_cliente)
          .maybeSingle();
        setSelectedClientName(prof?.username || client.id_cliente.slice(0,8));
      } catch (_) {
        setSelectedClientName(client.id_cliente.slice(0,8));
      }
    })();
    // Inicializar con configuración existente
    const currentLots = client.loterias_disponibles || [];
    setSelectedLotteries(currentLots.length ? currentLots : (lotteries.length ? lotteries.map(l=>l.value) : []));
    setClientSchedules(Array.isArray(client.horarios_disponibles) ? client.horarios_disponibles : []);
    setModalVisible(true);
  };

  // Si la pantalla se abre con un clientId desde navegación
  useEffect(() => {
    const clientId = route?.params?.clientId || null;
    if (clientId && clients.length) {
      const target = clients.find(c => c.id_cliente === clientId);
      if (target) openClientModal(target);
    }
  }, [route?.params?.clientId, clients]);

  // Si el modal está abierto y aún no se han seteado loterías, setear todas por defecto cuando carguen
  useEffect(() => {
    if (modalVisible && selectedLotteries.length === 0 && lotteries.length > 0) {
      setSelectedLotteries(lotteries.map(l=>l.value));
    }
  }, [modalVisible, selectedLotteries.length, lotteries]);

  const toggleLottery = (lotValue) => {
    setSelectedLotteries(prev => {
      const has = prev.includes(lotValue);
      if (has) return prev.filter(v => v !== lotValue);
      return [...prev, lotValue];
    });
  };

  const toggleSchedule = (lotId, schedule) => {
    setClientSchedules(prev => {
      const idx = prev.findIndex(e => e.horario_id === schedule.value && e.loteria_id === lotId);
      if (idx >= 0) {
        // quitar
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      // agregar sin ventana personalizada por defecto
      return [...prev, { horario_id: schedule.value, loteria_id: lotId }];
    });
  };

  const setWindowForSchedule = (horarioId, loteriaId, field, value) => {
    setClientSchedules(prev => prev.map(e => {
      if (e.horario_id !== horarioId || e.loteria_id !== loteriaId) return e;
      const currentWin = e.window || { start: null, end: null };
      const nextWin = { ...currentWin, [field]: value || null };
      // Si ambos están presentes, mantener objeto; si ambos son null, quitar ventana
      const bothNull = (!nextWin.start && !nextWin.end);
      return { ...e, window: bothNull ? null : nextWin };
    }));
  };

  const save = async () => {
    try {
      const payload = {
        loterias: selectedLotteries.length ? selectedLotteries : null,
        horarios: clientSchedules.length ? clientSchedules : null,
      };
      await saveClientAvailability(selectedClient.id_cliente, payload);
      Alert.alert('Éxito', 'Disponibilidad actualizada');
      setModalVisible(false);
      // refrescar lista
      const list = await fetchClientsForListero(listeroId);
      setClients(list);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Disponibilidad por Cliente</Text>
      </View>

      {initialLoading ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: '#2D5016' }}>Cargando clientes y horarios...</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id_cliente}
          renderItem={({ item }) => {
            const getLotteryLabel = (id) => lotteries.find(l => l.value === id)?.label || id;

            // Loterías permitidas: si hay horarios específicos, derivar de ellos; sino usar configuración o todas
            const allowedLots = (() => {
              const hasSpecific = Array.isArray(item.horarios_disponibles) && item.horarios_disponibles.length > 0;
              if (hasSpecific) {
                const uniq = new Set(item.horarios_disponibles.map(h => h.loteria_id));
                return Array.from(uniq);
              }
              if (Array.isArray(item.loterias_disponibles) && item.loterias_disponibles.length > 0) {
                return item.loterias_disponibles;
              }
              return (lotteries || []).map(l => l.value);
            })();

            // Horarios permitidos completos
            const scheduleEntries = (() => {
              const hasSpecific = Array.isArray(item.horarios_disponibles) && item.horarios_disponibles.length > 0;
              if (hasSpecific) return item.horarios_disponibles;
              const flat = [];
              allowedLots.forEach(lotId => {
                (schedulesByLottery[lotId] || []).forEach(opt => {
                  flat.push({ loteria_id: lotId, horario_id: opt.value });
                });
              });
              return flat;
            })();

            return (
              <View style={styles.clientCard}>
                <View style={styles.clientHeaderRow}>
                  <Text style={styles.clientTitle}>{item.display_name || item.id_cliente.slice(0,8) + '…'}</Text>
                </View>

                {/* Horarios permitidos: lista vertical completa por lotería */}
                <Text style={styles.clientSubtitle}>Horarios permitidos</Text>
                {scheduleEntries.length === 0 ? (
                  <View style={styles.summaryRow}><Text style={styles.summaryText}>• Sin horarios</Text></View>
                ) : (
                  scheduleEntries.map((cs, idx) => {
                    const lotLabel = getLotteryLabel(cs.loteria_id);
                    const opts = schedulesByLottery[cs.loteria_id] || [];
                    const opt = opts.find(o => o.value === cs.horario_id);
                    const schLabel = opt?.label || cs.horario_id;
                    const win = cs.window ? ` | Ventana: ${cs.window.start}–${cs.window.end}` : '';
                    return (
                      <View key={`sch-${cs.loteria_id}-${cs.horario_id}-${idx}`} style={styles.summaryRow}>
                        <Text style={styles.summaryText}>• {lotLabel}: {schLabel}{win}</Text>
                      </View>
                    );
                  })
                )}

                <View style={[styles.actionsRow, { marginTop: 8 }]}>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openClientModal(item)}>
                    <Text style={styles.actionButtonText}>Editar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 20 }}>
              <Text style={{ color: '#7f8c8d' }}>{loadingError ? loadingError : 'No tienes clientes todavía.'}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 20 }}
        />
      )}

      {/* Modal edición */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedClient?.display_name || selectedClientName || (selectedClient?.id_cliente?.slice(0,8) + '…')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeButton}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Loterías disponibles</Text>
              {(lotteries||[]).map(l => (
                <TouchableOpacity key={l.value} style={[styles.rowItem, selectedLotteries.includes(l.value) ? styles.rowItemActive : styles.rowItemInactive]} onPress={() => toggleLottery(l.value)}>
                  <Text style={styles.rowText}>{l.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>Horarios disponibles</Text>
              {selectedLotteries.length === 0 ? (
                <Text style={styles.hintText}>Sin loterías seleccionadas. Selecciona al menos una.</Text>
              ) : (
                selectedLotteries.map(lotId => (
                  <View key={lotId} style={styles.lotteryBlock}>
                    <Text style={styles.lotteryLabel}>Lotería: {lotteries.find(x=>x.value===lotId)?.label}</Text>
                    {(schedulesByLottery[lotId]||[]).length === 0 ? (
                      <Text style={styles.hintText}>Sin horarios configurados para esta lotería.</Text>
                    ) : (
                      (schedulesByLottery[lotId]||[]).map(opt => {
                        const active = clientSchedules.some(e => e.horario_id === opt.value && e.loteria_id === lotId);
                        return (
                          <View key={opt.value} style={[styles.rowItem, active ? styles.rowItemActive : styles.rowItemInactive]}>
                            <TouchableOpacity onPress={() => toggleSchedule(lotId, opt)} style={{ flex: 1 }}>
                              <Text style={styles.rowText}>{opt.label}</Text>
                            </TouchableOpacity>
                            {active && (
                              <View style={styles.windowRow}>
                                {Platform.OS === 'web' ? (
                                  <>
                                    {(() => {
                                      const current = clientSchedules.find(s => s.horario_id === opt.value && s.loteria_id === lotId)?.window || {};
                                      const startVal = current.start || '';
                                      const endVal = current.end || '';
                                      return (
                                        <>
                                          <input type="time" value={startVal} onChange={(e)=>setWindowForSchedule(opt.value, lotId, 'start', e.target.value)} />
                                          <Text style={{ marginHorizontal: 6 }}>—</Text>
                                          <input type="time" value={endVal} onChange={(e)=>setWindowForSchedule(opt.value, lotId, 'end', e.target.value)} />
                                        </>
                                      );
                                    })()}
                                  </>
                                ) : (
                                  <Text style={styles.hintText}>Configura ventana en app móvil (pendiente picker)</Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                ))
              )}

              {/* Resumen explícito de horarios permitidos para este cliente */}
              <Text style={styles.sectionTitle}>Horarios permitidos para el cliente</Text>
              {clientSchedules.length === 0 ? (
                <Text style={styles.hintText}>No hay horarios seleccionados. Si no seleccionas, el cliente hereda los horarios del listero.</Text>
              ) : (
                clientSchedules.map(cs => {
                  const lotLabel = lotteries.find(l => l.value === cs.loteria_id)?.label || cs.loteria_id;
                  // Buscar label del horario
                  const opts = schedulesByLottery[cs.loteria_id] || [];
                  const opt = opts.find(o => o.value === cs.horario_id);
                  const schLabel = opt?.label || cs.horario_id;
                  const win = cs.window ? `${cs.window.start} - ${cs.window.end}` : null;
                  return (
                    <View key={`${cs.loteria_id}-${cs.horario_id}`} style={styles.summaryRow}>
                      <Text style={styles.summaryText}>
                        • {lotLabel}: {schLabel}{win ? ` | Ventana: ${win}` : ''}
                      </Text>
                    </View>
                  );
                })
              )}

              <View style={styles.saveRow}>
                <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={save}>
                  <Text style={styles.actionButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  clientCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, ...createShadowStyle(0,2,'#000',0.1,4) },
  clientTitle: { fontSize: 16, fontWeight: '600', color: '#2D5016', marginBottom: 8 },
  clientHeaderRow: { marginBottom: 8 },
  clientSubtitle: { fontSize: 12, color: '#4F6B3A' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  editButton: { backgroundColor: '#3498db' },
  actionButtonText: { color: '#fff', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxHeight: '80%', ...createShadowStyle(0,4,'#000',0.3,8) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E8F5E8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D5016' },
  closeButton: { fontSize: 18, color: '#95a5a6', fontWeight: 'bold', padding: 5 },
  modalContent: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#4CAF50', marginTop: 8, marginBottom: 8 },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, marginBottom: 8 },
  rowItemActive: { backgroundColor: '#E8F5E8' },
  rowItemInactive: { backgroundColor: '#F8F9FA' },
  rowText: { color: '#2D5016', fontSize: 14, fontWeight: '500' },
  lotteryBlock: { marginBottom: 10 },
  lotteryLabel: { fontSize: 13, fontWeight: '600', color: '#2D5016', marginBottom: 6 },
  windowRow: { flexDirection: 'row', alignItems: 'center' },
  hintText: { fontSize: 12, color: '#7f8c8d' },
  saveRow: { marginTop: 12, alignItems: 'flex-end' },
  saveButton: { backgroundColor: '#27ae60' },
  summaryRow: { paddingVertical: 4 },
  summaryText: { fontSize: 13, color: '#2D5016' },
});

export default ManageClientAvailabilityScreen;
