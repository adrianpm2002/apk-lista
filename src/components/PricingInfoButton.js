import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import { t } from '../utils/i18n';

// Botón que muestra la configuración de precios (id_precio) asignada al listero
// Obtiene el id_precio del perfil del usuario actual y luego la fila de precio
// Muestra cada jugada en MAYÚSCULAS con limited, regular, listeroPct, colectorPct
const PricingInfoButton = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lotteryPrices, setLotteryPrices] = useState({}); // { lotteryId: { nombre: 'Lotería', precios: {...}, gainName: 'Ganancia' } }
  const [limits, setLimits] = useState(null); // limite_especifico
  const [numberLimits, setNumberLimits] = useState([]); // filas limite_numero
  const [bankId, setBankId] = useState(null);
  const [scheduleMap, setScheduleMap] = useState({}); // { id_horario: { nombre, id_loteria } }
  const [lotteryMap, setLotteryMap] = useState({}); // { id_loteria: nombre }
  const [limitedNumbers, setLimitedNumbers] = useState([]); // numero_limitado rows
  const [lotterySchedules, setLotterySchedules] = useState({}); // { loteriaId: { nombre: 'Lotería', schedules: [{id,nombre,hora_inicio,hora_fin}] } }
  const [lotteryLimits, setLotteryLimits] = useState({}); // limites por lotería { id_loteria: {fijo: X, parle: Y, ...} }
  const [dataLoaded, setDataLoaded] = useState(false); // para evitar recargar datos

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error('Usuario no autenticado');
      const { data: profile, error: pErr } = await supabase.from('profiles').select('id_precio, limite_especifico, id_banco, role').eq('id', user.id).maybeSingle();
      if (pErr) throw pErr;
      setLimits(profile?.limite_especifico || null);
      // Determinar bankId efectivo
      const effectiveBankId = profile ? (profile.role === 'admin' ? user.id : profile.id_banco) : null;
      setBankId(effectiveBankId);
      
      // Cargar precios específicos por lotería desde JSONB id_precio (fetch en batch)
      const lotteryPricesData = {};
      if (profile?.id_precio && typeof profile.id_precio === 'object') {
        const gainsData = profile.id_precio;
        // Obtener todas las entradas de ganancias por lotería
        const lotteryEntries = Object.entries(gainsData).filter(([key]) => key.endsWith('_id'));

        // Construir lista de gainIds y un map para asociarlos a la lotería
        const gainIds = [];
        const gainMap = {}; // gainId -> { lotteryId, lotteryName }
        lotteryEntries.forEach(([key, gainId]) => {
          const lotteryId = key.replace('_id', '');
          const lotteryName = gainsData[`${lotteryId}_nombre`] || `Lotería ${lotteryId}`;
          if (gainId) {
            gainIds.push(gainId);
            gainMap[gainId] = { lotteryId, lotteryName };
          }
        });

        if (gainIds.length) {
          try {
            console.time('pricesFetch');
            const { data: priceRows, error: priceErr } = await supabase
              .from('precio')
              .select('id, nombre, precios')
              .in('id', gainIds);
            console.timeEnd('pricesFetch');
            if (priceErr) throw priceErr;
            (priceRows || []).forEach(priceRow => {
              const info = gainMap[priceRow.id];
              if (info) {
                lotteryPricesData[info.lotteryId] = {
                  nombre: info.lotteryName,
                  precios: priceRow.precios || {},
                  gainName: priceRow.nombre || 'Sin nombre',
                  gainId: priceRow.id
                };
              }
            });
          } catch (err) {
            console.error('Error cargando precios en batch:', err);
          }
        }
      }

      setLotteryPrices(lotteryPricesData);
  // Cargar límites por número y números limitados si hay bankId
      if (effectiveBankId) {
        // Cargar límites por número y números limitados en paralelo
        try {
          console.time('numLimitsFetch');
          const [resLimits, resLimited] = await Promise.all([
            supabase.from('limite_numero').select('numero, limite, jugada, id_horario').eq('id_banco', effectiveBankId),
            supabase.from('numero_limitado').select('numero, jugada, id_horario').eq('id_banco', effectiveBankId)
          ]);
          console.timeEnd('numLimitsFetch');

          const nlErr = resLimits.error;
          const lnErr = resLimited.error;
          if (nlErr) throw nlErr;
          if (lnErr) throw lnErr;

          const limiteNumeroRows = resLimits.data || [];
          const limitedRows = resLimited.data || [];

        // Unificar ids de horario presentes en ambos conjuntos
        const horarioIds = [...new Set([...limiteNumeroRows, ...limitedRows].map(r => r.id_horario).filter(Boolean))];
        let scheduleMLocal = {};
        let lotMapLocal = {};
        if (horarioIds.length) {
          const { data: horarios, error: hErr } = await supabase
            .from('horario')
            .select('id, nombre, id_loteria')
            .in('id', horarioIds);
          if (hErr) throw hErr;
          const loteriaIds = new Set();
            (horarios || []).forEach(h => { scheduleMLocal[h.id] = { nombre: h.nombre, id_loteria: h.id_loteria }; loteriaIds.add(h.id_loteria); });
          setScheduleMap(scheduleMLocal);
          if (loteriaIds.size) {
            const { data: lots, error: lErr } = await supabase
              .from('loteria')
              .select('id,nombre')
              .in('id', Array.from(loteriaIds));
            if (lErr) throw lErr;
            (lots || []).forEach(l => lotMapLocal[l.id] = l.nombre);
            setLotteryMap(lotMapLocal);
          } else {
            setLotteryMap({});
          }
        } else {
          setScheduleMap({});
          setLotteryMap({});
        }

        const comparator = (a, b) => {
          const sa = scheduleMLocal[a.id_horario];
          const sb = scheduleMLocal[b.id_horario];
          const lotA = sa ? (lotMapLocal[sa.id_loteria] || '') : '';
          const lotB = sb ? (lotMapLocal[sb.id_loteria] || '') : '';
          if (lotA.localeCompare(lotB) !== 0) return lotA.localeCompare(lotB);
          const schA = sa ? sa.nombre : '';
          const schB = sb ? sb.nombre : '';
          if (schA.localeCompare(schB) !== 0) return schA.localeCompare(schB);
          if (a.jugada !== b.jugada) return a.jugada.localeCompare(b.jugada);
          return (a.numero || 0) - (b.numero || 0);
        };

        setNumberLimits(limiteNumeroRows.slice().sort(comparator));
        setLimitedNumbers(limitedRows.slice().sort(comparator));
        } catch (err) {
          console.warn('Error cargando límites por número:', err?.message || err);
          setNumberLimits([]);
          setScheduleMap({});
          setLotteryMap({});
          setLimitedNumbers([]);
        }
      } else {
        setNumberLimits([]);
        setScheduleMap({});
        setLotteryMap({});
        setLimitedNumbers([]);
      }

      // Cargar loterías y horarios del banco actual (filtrado por banco) 
      let bankLotteryIds = []; // Definir fuera del bloque para uso posterior
      try {
        if (effectiveBankId) {
          // Primero obtener las loterías del banco
          const { data: lotsBank, error: lotsBankErr } = await supabase
            .from('loteria')
            .select('id,nombre')
            .eq('id_banco', effectiveBankId);
          if (lotsBankErr) throw lotsBankErr;
          
          bankLotteryIds = (lotsBank || []).map(l => l.id);
          let lotNames = {};
          (lotsBank || []).forEach(l => { lotNames[l.id] = l.nombre; });
          
          if (bankLotteryIds.length > 0) {
            // Luego obtener los horarios de esas loterías
            const { data: horariosBank, error: hBankErr } = await supabase
              .from('horario')
              .select('id,nombre,hora_inicio,hora_fin,id_loteria')
              .in('id_loteria', bankLotteryIds);
            if (hBankErr) throw hBankErr;
            
            const map = {};
            (horariosBank || []).forEach(h => {
              if (!h.id_loteria) return; // ignorar sin lotería
              if (!map[h.id_loteria]) map[h.id_loteria] = { nombre: lotNames[h.id_loteria] || 'Sin Nombre', schedules: [] };
              map[h.id_loteria].schedules.push({ id: h.id, nombre: h.nombre, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin });
            });
            // ordenar por nombre lotería y hora inicio
            Object.values(map).forEach(obj => {
              obj.schedules.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
            });
            const orderedEntries = Object.entries(map).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
            setLotterySchedules(orderedEntries);
          } else {
            setLotterySchedules({});
          }
        } else {
          setLotterySchedules({});
        }
      } catch(e2) {
        // No bloquear si falla
        console.warn('Error cargando loterías/horarios', e2.message);
      }

      // Cargar límites por lotería si hay bankId
      try {
        if (effectiveBankId && bankLotteryIds.length > 0) {
          const { data: limitsData, error: limitsErr } = await supabase
            .from('limite_loteria')
            .select('id_loteria, limites')
            .in('id_loteria', bankLotteryIds);
          
          if (limitsErr) {
            console.warn('Error cargando límites por lotería:', limitsErr.message);
            setLotteryLimits({});
          } else {
            const limitsMap = {};
            (limitsData || []).forEach(item => {
              try {
                // Parsear los límites JSON si es string
                const limits = typeof item.limites === 'string' ? JSON.parse(item.limites) : (item.limites || {});
                limitsMap[item.id_loteria] = limits;
              } catch (parseErr) {
                console.warn('Error parsing limits for lottery', item.id_loteria, parseErr);
                limitsMap[item.id_loteria] = {};
              }
            });
            setLotteryLimits(limitsMap);
          }
        } else {
          setLotteryLimits({});
        }
      } catch(e3) {
        console.warn('Error general cargando límites por lotería', e3.message);
        setLotteryLimits({});
      }
    } catch(e){
      setError(e.message || 'Error cargando configuración');
    } finally {
      setLoading(false);
      setDataLoaded(true); // marcar como cargado
    }
  }, []);

  const open = () => { 
    setVisible(true); 
    // Solo cargar datos si no se han cargado antes
    if (!dataLoaded) {
      loadData(); 
    }
  };
  const close = () => { setVisible(false); };

  const renderContent = () => {
    if (loading) return <ActivityIndicator size="large" color="#2D5016" style={{ marginVertical: 20 }} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;
    
    const lotteryPricesEmpty = !Object.keys(lotteryPrices).length;

    
    // Orden canónico para los tipos de jugada
    const ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];
    
    return (
      <View>
        {/* Mensaje cuando no hay configuración de precios */}
        {lotteryPricesEmpty && (
          <View style={[styles.lotteriesBlock, { borderStyle: 'dashed' }] }>
            <Text style={styles.configName}>Información de Precios no configurada</Text>
            <Text style={styles.infoText}>No se encontró una configuración de precios asignada a tu cuenta. Esto significa que los valores de pago por jugada no están disponibles.</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Pressable onPress={() => loadData()} style={({ pressed }) => [{ padding: 8, backgroundColor: '#2D5016', borderRadius: 8, marginTop: 8 }, pressed && { opacity: 0.8 }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Recargar</Text>
              </Pressable>
              <Pressable onPress={() => { setVisible(false); /* Dejar que el usuario abra configuración manualmente */ }} style={({ pressed }) => [{ padding: 8, backgroundColor: '#E6F3FF', borderRadius: 8, marginTop: 8 }, pressed && { opacity: 0.8 }]}>
                <Text style={{ color: '#2B5F8A', fontWeight: '600' }}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Loterías y Horarios */}
        <View style={styles.lotteriesBlock}>
          <Text style={styles.lotteriesTitle}>Loterías y Horarios</Text>
          {Object.keys(lotterySchedules).length === 0 && (
            <Text style={styles.noLimits}>No hay horarios disponibles.</Text>
          )}
          {Object.entries(lotterySchedules).map(([lotteryId, lot]) => (
            <View key={lot.nombre} style={styles.lotteryCardFull}>
              <Text style={styles.lotteryName}>{lot.nombre}</Text>
              {lot.schedules.map(sch => (
                <Text key={sch.id} style={styles.scheduleItem}>• {sch.nombre}: {sch.hora_inicio?.toString().slice(0,5)} - {sch.hora_fin?.toString().slice(0,5)}</Text>
              ))}
            </View>
          ))}
        </View>
        
        {/* Ganancias por Lotería */}
        <Text style={styles.configName}>Ganancias por Lotería</Text>
        {Object.entries(lotteryPrices).map(([lotteryId, lotteryData]) => {
          const precios = lotteryData.precios || {};
          const orderedEntries = ORDER.filter(k => precios[k]).map(k => [k, precios[k]]);
          
          return (
            <View key={lotteryId} style={styles.lotteryPriceSection}>
              <View style={styles.lotteryHeader}>
                <Text style={styles.lotteryName}>{lotteryData.nombre}</Text>
                <Text style={styles.gainName}>({lotteryData.gainName})</Text>
              </View>
              
              {orderedEntries.length === 0 ? (
                <Text style={styles.noLimits}>Sin precios configurados</Text>
              ) : (
                <View style={styles.grid}>
                  {orderedEntries.map(([tipo, obj]) => {
                    const limited = obj?.limited ?? '-';
                    const regular = obj?.regular ?? '-';
                    const lPct = obj?.listeroPct ?? '-';
                    return (
                      <View key={tipo} style={styles.playCard}>
                        <Text style={styles.playType}>{tipo.charAt(0).toUpperCase()+tipo.slice(1)}</Text>
                        <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Precio regular:</Text> {regular}</Text>
                        <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Precio limitado:</Text> {limited}</Text>
                        <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Porciento listero:</Text> {lPct}%</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        
        {/* Límites por Lotería */}
        <View style={styles.limitsBlock}>
          <Text style={styles.limitsTitle}>Límites por Lotería</Text>
          {Object.keys(lotteryLimits).length === 0 ? (
            <Text style={styles.noLimits}>No hay límites específicos por lotería.</Text>
          ) : (
            Object.entries(lotterySchedules).map(([lotteryId, lot]) => {
              const lotteryLimitsForThis = lotteryLimits[lotteryId] || {};
              const hasLimits = Object.keys(lotteryLimitsForThis).length > 0;
              
              if (!hasLimits) return null;
              
              return (
                <View key={lotteryId} style={styles.lotteryLimitSection}>
                  <Text style={styles.lotteryLimitName}>{lot.nombre}</Text>
                  <View style={styles.limitsGrid}>
                    {['fijo','corrido','posicion','parle','centena','tripleta'].filter(k=> lotteryLimitsForThis[k] !== undefined).map(k => (
                      <View key={k} style={styles.lotteryLimitCard}>
                        <Text style={styles.lotteryLimitPlay}>{k.toUpperCase()}</Text>
                        <Text style={styles.lotteryLimitValue}>{lotteryLimitsForThis[k]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
        
        <View style={styles.limitsBlock}>
          <Text style={styles.limitsTitle}>Límites Específicos por Lotería</Text>
          {!limits || Object.keys(limits).length===0 ? (
            <Text style={styles.noLimits}>No tiene límites específicos por lotería.</Text>
          ) : (() => {
            // Detectar formato: nuevo (por lotería) o antiguo (global)
            const isNewFormat = Object.values(limits).some(val => 
              typeof val === 'object' && val !== null && !Array.isArray(val)
            );

            if (isNewFormat) {
              // Formato nuevo: mostrar por lotería
              return Object.entries(limits).map(([lotteryId, lotteryLimits]) => {
                if (typeof lotteryLimits === 'object' && lotteryLimits !== null) {
                  // Obtener el nombre real de la lotería desde lotterySchedules
                  const lotteryInfo = lotterySchedules[lotteryId];
                  const lotteryName = lotteryInfo?.nombre || `Lotería ${lotteryId}`;
                  
                  // Filtrar y ordenar límites según el orden estándar
                  const orderedLimits = ['fijo','corrido','posicion','parle','centena','tripleta']
                    .filter(k => lotteryLimits[k] !== undefined);
                  
                  if (orderedLimits.length > 0) {
                    return (
                      <View key={lotteryId} style={styles.lotteryLimitSection}>
                        <Text style={styles.lotteryLimitName}>{lotteryName}</Text>
                        <View style={styles.limitsGrid}>
                          {orderedLimits.map(k => (
                            <View key={`${lotteryId}-${k}`} style={styles.limitCard}>
                              <Text style={styles.limitPlay}>{k.toUpperCase()}</Text>
                              <Text style={styles.limitValue}>{lotteryLimits[k]}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  }
                }
                return null;
              });
            } else {
              // Formato antiguo: mostrar como antes (compatibilidad)
              return (
                <View>
                  <Text style={styles.lotteryLimitName}>Límites Globales (Formato Anterior)</Text>
                  <View style={styles.limitsGrid}>
                    {['fijo','corrido','posicion','parle','centena','tripleta'].filter(k=> limits[k] !== undefined).map(k => (
                      <View key={k} style={styles.limitCard}>
                        <Text style={styles.limitPlay}>{k.toUpperCase()}</Text>
                        <Text style={styles.limitValue}>{limits[k]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            }
          })()}
        </View>
        
        <View style={styles.limitsBlock}>
          {/* Números limitados */}
          {loading && <Text style={styles.numLimitsLoading}>Cargando números limitados...</Text>}
          {!loading && numberLimits && (
            <View style={styles.numLimitsSection}>
              <Text style={styles.numLimitsTitle}>Límite de Números</Text>
              {(!numberLimits.length) && (
                <Text style={styles.noLimits}>No hay números limitados.</Text>
              )}
              {numberLimits.length>0 && (
                ['fijo','corrido','posicion','parle','centena','tripleta'].map(j => {
                  const jugadaRows = numberLimits.filter(r => r.jugada === j);
                  if(!jugadaRows.length) return null;
                  // Agrupar por lotería
                  const lotGroups = jugadaRows.reduce((acc,r)=>{
                    const sch = r.id_horario && (scheduleMap[r.id_horario]||{});
                    const lotName = sch.id_loteria ? (lotteryMap[sch.id_loteria] || 'Sin Lotería') : 'Sin Lotería';
                    if(!acc[lotName]) acc[lotName]=[];
                    acc[lotName].push(r);
                    return acc;
                  }, {});
                  const lotNames = Object.keys(lotGroups).sort((a,b)=> a.localeCompare(b));
                  return (
                    <View key={j} style={styles.numGroup}>
                      <Text style={styles.numGroupHeader}>{j.toUpperCase()}</Text>
                      {lotNames.map(lot => (
                        <View key={lot} style={styles.lotteryGroup}>
                          <Text style={styles.lotteryHeader}>{lot}</Text>
                          {lotGroups[lot].slice(0,50).map((r,idx)=>(
                            <Text key={idx} style={styles.numItem}>
                              • {r.numero} → {r.limite}
                              {(() => {
                                const sch = r.id_horario && (scheduleMap[r.id_horario] || {});
                                return sch.nombre ? ` (${sch.nombre})` : '';
                              })()}
                            </Text>
                          ))}
                          {lotGroups[lot].length>50 && <Text style={styles.numOverflow}>… +{lotGroups[lot].length-50} más</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </View>
          )}
          {/* Números limitados (numero_limitado) */}
          {!loading && limitedNumbers && (
            <View style={styles.numLimitsSection}>
              <Text style={styles.numLimitsTitle}>Números Limitados</Text>
              {(!limitedNumbers.length) && (
                <Text style={styles.noLimits}>No hay números limitados.</Text>
              )}
              {limitedNumbers.length>0 && (
                ['fijo','corrido','posicion','parle','centena','tripleta'].map(j => {
                  const jugadaRows = limitedNumbers.filter(r => r.jugada === j);
                  if(!jugadaRows.length) return null;
                  const lotGroups = jugadaRows.reduce((acc,r)=>{
                    const sch = r.id_horario && (scheduleMap[r.id_horario]||{});
                    const lotName = sch.id_loteria ? (lotteryMap[sch.id_loteria] || 'Sin Lotería') : 'Sin Lotería';
                    if(!acc[lotName]) acc[lotName]=[];
                    acc[lotName].push(r);
                    return acc;
                  }, {});
                  const lotNames = Object.keys(lotGroups).sort((a,b)=> a.localeCompare(b));
                  return (
                    <View key={j} style={styles.numGroup}>
                      <Text style={styles.numGroupHeader}>{j.toUpperCase()}</Text>
                      {lotNames.map(lot => (
                        <View key={lot} style={styles.lotteryGroup}>
                          <Text style={styles.lotteryHeader}>{lot}</Text>
                          {lotGroups[lot].slice(0,50).map((r,idx)=>(
                            <Text key={idx} style={styles.numItem}>
                              • {r.numero}
                              {(() => {
                                const sch = r.id_horario && (scheduleMap[r.id_horario] || {});
                                return sch.nombre ? ` (${sch.nombre})` : '';
                              })()}
                            </Text>
                          ))}
                          {lotGroups[lot].length>50 && <Text style={styles.numOverflow}>… +{lotGroups[lot].length-50} más</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={open}
      >
        <Text style={styles.icon}>ℹ️</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]} onPress={close}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#B8D4A8', alignItems: 'center', justifyContent: 'center', elevation: 3,
  },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  icon: { fontSize: 18 },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:16, width:'100%', maxWidth:420, maxHeight:'80%', padding:20 },
  configName: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:12, color:'#2C3E50' },
  lotteriesBlock: { marginBottom:18, backgroundColor:'#FAFCF9', borderWidth:1, borderColor:'#E2E8E5', borderRadius:12, padding:12 },
  lotteriesTitle: { fontSize:16, fontWeight:'700', color:'#2C3E50', marginBottom:8, textAlign:'center' },
  lotteryCardFull: { marginBottom:10, backgroundColor:'#FFFFFF', borderRadius:8, borderWidth:1, borderColor:'#E8EEE7', padding:8 },
  lotteryName: { fontSize:13, fontWeight:'700', color:'#1B3E0F', marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 },
  scheduleItem: { fontSize:11, color:'#34495E', marginBottom:2 },
  limitsSection: { marginTop:8, padding:8, backgroundColor:'#F8F9FA', borderRadius:6, borderWidth:1, borderColor:'#DEE2E6' },
  limitsSubtitle: { fontSize:11, fontWeight:'600', color:'#6C757D', marginBottom:4 },
  limitItem: { fontSize:10, color:'#495057', marginBottom:1 },
  grid: { flexDirection:'row', flexWrap:'wrap', marginHorizontal:-6 },
  playCard: { width:'50%', padding:8, paddingBottom:10, backgroundColor:'#FFFFFF', borderRadius:10, borderWidth:1, borderColor:'#E2E8E5', shadowColor:'#000', shadowOpacity:0.03, shadowOffset:{width:0,height:1}, shadowRadius:2, marginBottom:12, paddingHorizontal:10 },
  playType: { fontSize:14, fontWeight:'700', color:'#2D5016', marginBottom:4 },
  inlineDetail: { fontSize:11, color:'#34495E', marginBottom:2, lineHeight:14 },
  inlineLabel: { fontWeight:'600', color:'#4a5b4f' },
  limitsBlock: { marginTop:16, paddingTop:12, borderTopWidth:1, borderTopColor:'#E2E8E5' },
  limitsTitle: { fontSize:16, fontWeight:'700', color:'#2C3E50', marginBottom:10 },
  noLimits: { fontSize:13, color:'#566573', fontStyle:'italic' },
  limitsGrid: { flexDirection:'row', flexWrap:'wrap', marginHorizontal:-4 },
  limitCard: { width:'33.33%', padding:6, backgroundColor:'#F4F9F2', borderRadius:8, borderWidth:1, borderColor:'#E0E6E0', marginBottom:8, paddingHorizontal:8 },
  effectiveLimitCard: { backgroundColor:'#E8F5E8', borderColor:'#B8D4A8', borderWidth:2 },
  limitPlay: { fontSize:11, fontWeight:'700', color:'#2D5016', marginBottom:2 },
  limitValue: { fontSize:12, fontWeight:'600', color:'#2D5016' },
  numLimitsSection: { marginTop:16 },
  numLimitsTitle: { fontSize:15, fontWeight:'700', color:'#2C3E50', marginBottom:8, marginTop:4 },
  numGroup: { marginBottom:10, backgroundColor:'#FAFCF9', borderWidth:1, borderColor:'#E0E6E0', borderRadius:8, padding:8 },
  numGroupHeader: { fontSize:12, fontWeight:'700', color:'#2D5016', marginBottom:4 },
  numItem: { fontSize:11, color:'#34495E', marginBottom:2 },
  numOverflow: { fontSize:11, color:'#7f8c8d', fontStyle:'italic' },
  lotteryGroup: { marginBottom:6, padding:6, borderRadius:6, backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#E8EEE7' },
  lotteryHeader: { fontSize:11, fontWeight:'700', color:'#1B3E0F', marginBottom:3, textTransform:'uppercase', letterSpacing:0.5 },
  numLimitsLoading: { fontSize:12, color:'#34495E', marginTop:8 },
  closeButton: { marginTop:12, backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center' },
  closeButtonPressed: { opacity:0.8 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
  infoText: { fontSize:14, color:'#34495E', textAlign:'center', marginVertical:12 },
  errorText: { fontSize:14, color:'#C0392B', textAlign:'center', marginVertical:12 },
  // Estilos para límites por lotería
  lotteryLimitSection: { marginBottom:12, backgroundColor:'#F8F4FF', borderWidth:1, borderColor:'#E6DCFA', borderRadius:8, padding:10 },
  lotteryLimitName: { fontSize:13, fontWeight:'700', color:'#4A3D8A', marginBottom:6, textAlign:'center', textTransform:'uppercase', letterSpacing:0.5 },
  lotteryLimitCard: { width:'33.33%', padding:6, backgroundColor:'#F2EEFF', borderRadius:8, borderWidth:1, borderColor:'#D6C8FA', marginBottom:8, paddingHorizontal:8 },
  lotteryLimitPlay: { fontSize:11, fontWeight:'700', color:'#4A3D8A', marginBottom:2 },
  lotteryLimitValue: { fontSize:12, fontWeight:'600', color:'#4A3D8A' },
  // Estilos para precios específicos por lotería
  lotteryPriceSection: { marginBottom:16, backgroundColor:'#F8FBF6', borderWidth:1, borderColor:'#D5E8C8', borderRadius:12, padding:12 },
  lotteryHeader: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:8 },
  gainName: { fontSize:12, color:'#5A6B5D', fontStyle:'italic', marginLeft:6 },
});

export default PricingInfoButton;
