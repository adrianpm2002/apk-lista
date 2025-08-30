import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, TextInput, ScrollView, FlatList } from 'react-native';

const CapacityModal = ({ isVisible, onClose, selectedLottery, capacityData = [], loading=false, error=null, getScheduleLabel, playTypeLabels }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('capacity');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lotteryFilter, setLotteryFilter] = useState(null); // id único o null (todas)
  const [scheduleFilter, setScheduleFilter] = useState(null); // id único o null
  const [playTypeFilter, setPlayTypeFilter] = useState(null); // jugada única o null

  useEffect(()=>{
    if(!isVisible){
      setSearchTerm(''); setSortBy('capacity'); setShowSearch(false);
      setLotteryFilter(null); setScheduleFilter(null); setPlayTypeFilter(null);
    }
  },[isVisible]);

  const filteredRaw = capacityData; // sin filtros externos

  const lotteryOptions = useMemo(()=>{
    const map = new Map();
    capacityData.forEach(r=>{ if(r.loteriaId) map.set(r.loteriaId, r.loteriaNombre); });
    return Array.from(map.entries()).map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label));
  },[capacityData]);

  const scheduleOptions = useMemo(()=>{
    const map = new Map();
    capacityData.forEach(r=>{
      if (!lotteryFilter || lotteryFilter===r.loteriaId) {
        const key = r.horarioId+"|"+r.horarioNombre;
        map.set(key, { id: r.horarioId, label: r.horarioNombre });
      }
    });
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label));
  },[capacityData, lotteryFilter]);

  const internallyFiltered = useMemo(()=> filteredRaw.filter(r => {
    if (lotteryFilter && lotteryFilter!==r.loteriaId) return false;
    if (scheduleFilter && scheduleFilter!==r.horarioId) return false;
    if (playTypeFilter && playTypeFilter!==r.jugada) return false;
    return true;
  }),[filteredRaw, lotteryFilter, scheduleFilter, playTypeFilter]);

  const filteredData = internallyFiltered.filter(item => !searchTerm || item.numero?.includes?.(searchTerm));

  const sortedData = [...filteredData].sort((a,b)=>{
    if(sortBy==='capacity') return b.porcentaje - a.porcentaje;
    return parseInt(a.numero) - parseInt(b.numero);
  });

  const getCapacityColor = (pct) => pct>=80? '#E74C3C' : pct>=60? '#F39C12' : pct>=40? '#F1C40F' : '#27AE60';

  const renderCapacityItem = ({ item }) => (
    <View style={styles.capacityItem}>
      <View style={styles.numberContainer}><Text style={styles.numberText}>{item.numero}</Text></View>
      <View style={styles.capacityInfo}>
        <View style={styles.capacityBar}>
          <View style={[styles.capacityFill,{width:`${item.porcentaje}%`,backgroundColor:getCapacityColor(item.porcentaje)}]} />
        </View>
        <Text style={styles.capacityText}>${item.usado.toLocaleString()} / ${item.limite?.toLocaleString?.()||'—'}</Text>
        <Text style={styles.metaText}><Text style={styles.metaStrong}>{item.loteriaNombre}</Text> · <Text style={styles.metaStrong}>{item.horarioNombre}</Text> · <Text style={styles.metaJug}>{(playTypeLabels[item.jugada]||item.jugada).toUpperCase()}</Text></Text>
      </View>
    </View>
  );

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Capacidad</Text>
            <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>✕</Text></Pressable>
          </View>
          <View style={styles.toolbarRow}>
            <Pressable style={styles.iconButton} onPress={()=>setShowSearch(s=>!s)}><Text style={styles.iconButtonText}>🔍</Text></Pressable>
            <Pressable style={styles.iconButton} onPress={()=>setShowFilters(f=>!f)}>
              <Text style={styles.iconButtonText}>⚙️</Text>
            </Pressable>
          </View>
          {showFilters && (
            <View style={styles.filtersPanel}>
              {/* Loterías */}
              <View style={styles.filterSection}>
                <View style={styles.chipsWrap}>
                  <Pressable onPress={()=>{setLotteryFilter(null); setScheduleFilter(null);}} style={[styles.filterChip, !lotteryFilter && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, !lotteryFilter && styles.filterChipTextActive]}>Todas</Text>
                  </Pressable>
                  {lotteryOptions.map(opt=>{
                    const active = lotteryFilter===opt.id;
                    return (
                      <Pressable key={opt.id} onPress={()=>{setLotteryFilter(active? null : opt.id); setScheduleFilter(null);}} style={[styles.filterChip, active && styles.filterChipActive]}>
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {/* Horarios solo si hay lotería seleccionada */}
              {lotteryFilter && (
                <View style={styles.filterSection}>
                  <View style={styles.chipsWrap}>
                    <Pressable onPress={()=>setScheduleFilter(null)} style={[styles.filterChip, !scheduleFilter && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, !scheduleFilter && styles.filterChipTextActive]}>Todos</Text>
                    </Pressable>
                    {scheduleOptions.map(opt=>{
                      const active = scheduleFilter===opt.id;
                      return (
                        <Pressable key={opt.id} onPress={()=>setScheduleFilter(active? null : opt.id)} style={[styles.filterChip, active && styles.filterChipActive]}>
                          <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              {/* Jugadas: debajo de horarios si hay lotería, si no inmediatamente después de loterías */}
              <View style={styles.filterSection}>
                <View style={styles.chipsWrap}>
                  <Pressable onPress={()=>setPlayTypeFilter(null)} style={[styles.filterChip, !playTypeFilter && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, !playTypeFilter && styles.filterChipTextActive]}>Todas</Text>
                  </Pressable>
                  {[...new Set(capacityData.map(r=>r.jugada))].sort().map(j=>{
                    const active = playTypeFilter===j;
                    return (
                      <Pressable key={j} onPress={()=>setPlayTypeFilter(active? null : j)} style={[styles.filterChip, active && styles.filterChipActive]}>
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{(playTypeLabels[j]||j).toUpperCase()}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
          {showSearch && (
            <View style={styles.searchContainer}>
              <TextInput style={styles.searchInput} placeholder="Buscar número..." value={searchTerm} onChangeText={setSearchTerm} keyboardType="number-pad" />
            </View>
          )}
          <View style={styles.sortContainer}>
            <Pressable style={[styles.sortButton, sortBy==='capacity' && styles.sortButtonActive]} onPress={()=>setSortBy('capacity')}>
              <Text style={[styles.sortButtonText, sortBy==='capacity' && styles.sortButtonTextActive]}>Capacidad</Text>
            </Pressable>
            <Pressable style={[styles.sortButton, sortBy==='numeric' && styles.sortButtonActive]} onPress={()=>setSortBy('numeric')}>
              <Text style={[styles.sortButtonText, sortBy==='numeric' && styles.sortButtonTextActive]}>Numérico</Text>
            </Pressable>
          </View>
          {loading ? (
            <Text style={styles.loadingText}>Cargando...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : sortedData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Ningún número con capacidad usada</Text>
            </View>
          ) : (
            <FlatList
              data={sortedData}
              keyExtractor={(item,idx)=>item.loteriaId+"-"+item.horarioId+"-"+item.jugada+"-"+item.numero+"-"+idx}
              renderItem={renderCapacityItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// Estilos definitivos
const styles = StyleSheet.create({
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  modalContainer:{ width:'90%', height:'80%', backgroundColor:'#FFFFFF', borderRadius:16, padding:14 },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12, paddingBottom:8, borderBottomWidth:1, borderBottomColor:'#E0E0E0' },
  title:{ fontSize:16, fontWeight:'bold', color:'#2C3E50' },
  closeButton:{ width:24, height:24, borderRadius:12, backgroundColor:'#E74C3C', justifyContent:'center', alignItems:'center' },
  closeText:{ color:'#FFFFFF', fontSize:12, fontWeight:'bold' },
  toolbarRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 },
  iconButton:{ width:34, height:34, borderRadius:8, backgroundColor:'#ECF0F1', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#D5DBDB' },
  iconButtonText:{ fontSize:16 },
  filtersScroll:{ flex:1 },
  filtersScrollContent:{ flexDirection:'row', alignItems:'center' },
  filterGroup:{ flexDirection:'row', alignItems:'center', gap:4, marginRight:12 },
  filterChip:{ paddingHorizontal:10, paddingVertical:5, backgroundColor:'#FFFFFF', borderRadius:20, borderWidth:1, borderColor:'#D5DBDB' },
  filterChipActive:{ backgroundColor:'#3498DB', borderColor:'#3498DB' },
  filterChipText:{ fontSize:11, color:'#2C3E50', fontWeight:'600' },
  filterChipTextActive:{ color:'#FFFFFF' },
  chipsWrap:{ flexDirection:'row', flexWrap:'wrap', gap:6 },
  searchContainer:{ marginBottom:8 },
  searchInput:{ borderWidth:1, borderColor:'#D5DBDB', borderRadius:6, paddingHorizontal:8, paddingVertical:6, fontSize:13 },
  sortContainer:{ flexDirection:'row', marginBottom:8, gap:6 },
  sortButton:{ flex:1, paddingVertical:4, paddingHorizontal:6, borderRadius:4, borderWidth:1, borderColor:'#D5DBDB', backgroundColor:'#FFFFFF', alignItems:'center' },
  sortButtonActive:{ backgroundColor:'#3498DB', borderColor:'#3498DB' },
  sortButtonText:{ fontSize:12, color:'#2C3E50', fontWeight:'500' },
  sortButtonTextActive:{ color:'#FFFFFF' },
  list:{ flex:1 },
  capacityItem:{ flexDirection:'row', alignItems:'center', paddingVertical:6, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:'#F0F0F0' },
  numberContainer:{ width:44, height:34, borderRadius:6, backgroundColor:'#ECF0F1', justifyContent:'center', alignItems:'center', marginRight:8 },
  numberText:{ fontSize:15, fontWeight:'bold', color:'#2C3E50' },
  capacityInfo:{ flex:1 },
  capacityBar:{ height:6, backgroundColor:'#ECF0F1', borderRadius:3, marginBottom:3, overflow:'hidden' },
  capacityFill:{ height:'100%', borderRadius:3 },
  capacityText:{ fontSize:11, fontWeight:'700', color:'#2C3E50', marginBottom:1 },
  metaText:{ fontSize:10, color:'#34495E' },
  metaStrong:{ fontWeight:'600', color:'#2C3E50' },
  metaJug:{ fontWeight:'700', color:'#8E44AD' },
  loadingText:{ textAlign:'center', marginTop:20, color:'#2C3E50' },
  errorText:{ textAlign:'center', marginTop:20, color:'#E74C3C' },
  emptyContainer:{ flex:1, justifyContent:'center', alignItems:'center' },
  emptyText:{ textAlign:'center', marginTop:20, color:'#7F8C8D', fontWeight:'600' },
});

export default CapacityModal;
