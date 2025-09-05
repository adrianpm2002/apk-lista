// ================================
// BACKUP DE ESTILOS ORIGINALES
// Fecha: 4 de septiembre de 2025
// ================================

import { StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const createShadowStyle = ({ color = '#000', offsetX = 0, offsetY = 2, opacity = 0.1, radius = 4, elevation = 2 } = {}) => ({
  shadowColor: color,
  shadowOffset: { width: offsetX, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: elevation,
});

// ESTILOS ORIGINALES GUARDADOS
const originalStyles = StyleSheet.create({
  filtersPanel:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#E1E8E3', borderRadius:10, padding:8, margin:8 },
  filtersPanelDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  panelLabel:{ fontSize:11, fontWeight:'700', color:'#2D5016', marginTop:4, marginBottom:4 },
  panelLabelDark:{ color:'#ECF0F1' },
  chipsRow:{ flexDirection:'row', flexWrap:'wrap', marginBottom:6 },
  filterChip:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#B8D4A8', borderRadius:20, paddingHorizontal:10, paddingVertical:6, marginRight:6, marginBottom:6 },
  filterChipDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  filterChipActive:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60' },
  filterChipActiveDark:{ backgroundColor:'#5D6D7E', borderColor:'#27AE60' },
  filterChipText:{ fontSize:12, color:'#2D5016', fontWeight:'500' },
  filterChipTextDark:{ color:'#ECF0F1' },
  filterChipTextActive:{ fontWeight:'700', color:'#27AE60' },
  dateSection:{ flexDirection:'row', alignItems:'center', gap:8, marginTop:6 },
  dateSectionCompact:{ flexDirection:'row', alignItems:'center', marginTop:6 },
  dateButton:{ backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#E1E8E3', borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  dateButtonDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  dateButtonText:{ color:'#2C3E50', fontWeight:'600' },
  dateButtonTextDark:{ color:'#ECF0F1' },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 70,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 2,
      elevation: 4,
    }),
  },
  headerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginRight: 16,
  },
  headerTitleDark: {
    color: '#ecf0f1',
  },
  sidebarButton: {
    marginLeft: 4,
    marginBottom: 4,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  filterButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  filterButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  filterButtonText: {
    color: '#495057',
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#ecf0f1',
  },
  exportButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonDark: {
    backgroundColor: '#229954',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginTop: 70,
  },
  tabsContainerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#27AE60',
  },
  activeTabDark: {
    borderBottomColor: '#2ecc71',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#adb5bd',
  },
  activeTabText: {
    color: '#27AE60',
    fontWeight: '600',
  },
  // Resto de estilos...
});

export { originalStyles, createShadowStyle };
