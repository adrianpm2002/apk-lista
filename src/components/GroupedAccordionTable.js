import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

// columns: [{ key, title, flex, type: 'currency'|'number'|'date'|'text', align }]
// groups: Array<{ id, title, rows: any[], summary?: Record<string,number|string> }>
// onRowPress?: (row) => void
export default function GroupedAccordionTable({
  title,
  groups = [],
  columns = [],
  defaultExpanded = false,
  maxHeight = 360,
  formatCurrency = true,
  onRowPress,
}){
  const [expanded, setExpanded] = useState(()=> new Set(defaultExpanded ? groups.map(g=>g.id) : []));

  const toggle = (id) => {
    setExpanded(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const formatMoney = (v) => {
    if(!formatCurrency) return v;
    const n = Number(v||0);
    if (Number.isNaN(n)) return v;
    return new Intl.NumberFormat('es-DO', { style:'currency', currency:'DOP', maximumFractionDigits:0 }).format(n);
  };

  const formatDate = (value) => {
    try{ return new Date(value).toLocaleDateString('es-DO'); } catch{ return value; }
  };

  const formatValue = (value, col) => {
    switch(col.type){
      case 'currency': return formatMoney(value);
      case 'number': return new Intl.NumberFormat('es-DO').format(Number(value||0));
      case 'date': return formatDate(value);
      default: return String(value ?? '-');
    }
  };

  const totals = useMemo(()=>{
    const t = {};
    columns.forEach(c=>{
      if(['currency','number'].includes(c.type)){
        t[c.key] = groups.reduce((acc, g)=> acc + g.rows.reduce((s,r)=> s + (Number(r[c.key])||0), 0), 0);
      }
    });
    return t;
  },[groups, columns]);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <ScrollView style={{ maxHeight }}>
        {groups.map(group => {
          const isOpen = expanded.has(group.id);
          const groupTotals = columns.reduce((acc,c)=>{
            if(['currency','number'].includes(c.type)){
              acc[c.key] = group.rows.reduce((s,r)=> s + (Number(r[c.key])||0), 0);
            }
            return acc;
          }, {});
          return (
            <View key={group.id} style={styles.group}>
              <TouchableOpacity style={styles.groupHeader} onPress={()=> toggle(group.id)}>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {isOpen ? '▾' : '▸'} {group.title}
                </Text>
                <View style={styles.groupSummary}>
                  {columns.map(col => (
                    <Text key={col.key} style={styles.groupSummaryText}>
                      {['currency','number'].includes(col.type) ? formatValue(groupTotals[col.key], col) : ''}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.table}>
                  <View style={[styles.row, styles.headerRow]}>
                    {columns.map(col => (
                      <View key={col.key} style={[styles.cell, { flex: col.flex || 1 }] }>
                        <Text style={styles.headerText}>{col.title}</Text>
                      </View>
                    ))}
                  </View>
                  {group.rows.map((r, idx) => (
                    <TouchableOpacity key={idx} style={[styles.row, idx%2===0 && styles.evenRow]} onPress={()=> onRowPress && onRowPress(r)} disabled={!onRowPress}>
                      {columns.map(col => (
                        <View key={col.key} style={[styles.cell, { flex: col.flex || 1 }]}>
                          <Text style={styles.dataText} numberOfLines={2}>{formatValue(r[col.key], col)}</Text>
                        </View>
                      ))}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Totales globales */}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Totales</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
          {columns.map(col => (
            <View key={col.key} style={{ marginRight:12, marginBottom:6 }}>
              <Text style={styles.footerKey}>{col.title}:</Text>
              <Text style={styles.footerVal}>{totals[col.key] !== undefined ? formatValue(totals[col.key], col) : '-'}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor:'#fff', borderRadius:12, padding:12, margin:8, elevation:2 },
  title: { fontSize:18, fontWeight:'600', color:'#2c3e50', textAlign:'center', marginBottom:8 },
  group: { marginBottom:12, borderRadius:8, borderWidth:1, borderColor:'#e9ecef' },
  groupHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:12, paddingVertical:10, backgroundColor:'#f8f9fa', borderTopLeftRadius:8, borderTopRightRadius:8 },
  groupTitle: { fontSize:15, fontWeight:'600', color:'#2c3e50', flex:1 },
  groupSummary: { flexDirection:'row', flexWrap:'wrap', justifyContent:'flex-end' },
  groupSummaryText: { marginLeft:10, color:'#495057', fontSize:12 },
  table: { paddingHorizontal:8, paddingBottom:8 },
  row: { flexDirection:'row', borderBottomWidth:1, borderBottomColor:'#e9ecef' },
  headerRow: { backgroundColor:'#f1f3f5' },
  cell: { paddingHorizontal:8, paddingVertical:6, justifyContent:'center' },
  headerText: { fontSize:12, fontWeight:'700', color:'#495057' },
  dataText: { fontSize:12, color:'#212529' },
  evenRow: { backgroundColor:'#fafafa' },
  footer: { marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:'#e9ecef' },
  footerTitle: { fontSize:14, fontWeight:'700', color:'#2c3e50', marginBottom:6 },
  footerKey: { fontSize:12, color:'#495057' },
  footerVal: { fontSize:13, fontWeight:'700', color:'#2c3e50' },
});
