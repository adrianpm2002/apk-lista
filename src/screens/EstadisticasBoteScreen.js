import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { supabase } from '../supabaseClient';
import SideBarWrapper from '../components/SideBarWrapper';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerWrapper from '../components/DateTimePickerWrapper';
import FeedbackBanner from '../components/FeedbackBanner';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const createShadowStyle = (offsetX, offsetY, radius, opacity) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: radius,
  };
};

const EstadisticasBoteScreen = ({ navigation }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // Filtros de fecha
  const [fechaDesde, setFechaDesde] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [fechaHasta, setFechaHasta] = useState(new Date());
  const [showDesde, setShowDesde] = useState(false);
  const [showHasta, setShowHasta] = useState(false);

  // Estados de expansión
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedLoterias, setExpandedLoterias] = useState({});
  const [expandedHorarios, setExpandedHorarios] = useState({});

  // Feedback
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState('success');

  // Deshabilitar banners en esta pantalla
  const showFeedback = () => {}; // Función vacía para evitar que se muestren banners

  // Obtener usuario actual
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setUserRole(profileData.role);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  // Cargar estadísticas
  const fetchEstadisticas = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const fechaDesdeISO = fechaDesde.toISOString();
      const fechaHastaISO = new Date(fechaHasta.setHours(23, 59, 59, 999)).toISOString();

      let query = supabase
        .from('estadisticas_bote')
        .select('*')
        .gte('fecha_jugada', fechaDesdeISO)
        .lte('fecha_jugada', fechaHastaISO)
        .order('fecha_jugada', { ascending: false });

      // Filtrar por rol
      if (userRole === 'listero') {
        query = query.eq('id_listero', currentUserId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[EstadisticasBote] Error cargando estadísticas:', error);
        showFeedback('Error al cargar estadísticas', 'error');
        return;
      }

      setEstadisticas(data || []);
    } catch (error) {
      console.error('[EstadisticasBote] Error en fetchEstadisticas:', error);
      showFeedback('Error al cargar estadísticas', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, fechaDesde, fechaHasta, userRole]);

  useEffect(() => {
    if (currentUserId && userRole) {
      fetchEstadisticas();
    }
  }, [currentUserId, userRole, fetchEstadisticas]);

  // Agrupar datos por fecha > lotería > horario
  const groupedData = useMemo(() => {
    const grouped = {};

    estadisticas.forEach((stat) => {
      const fecha = new Date(stat.fecha_jugada).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      if (!grouped[fecha]) {
        grouped[fecha] = {};
      }

      const loteria = stat.nombre_loteria || 'Sin lotería';
      if (!grouped[fecha][loteria]) {
        grouped[fecha][loteria] = {};
      }

      const horario = stat.nombre_horario || 'Sin horario';
      if (!grouped[fecha][loteria][horario]) {
        grouped[fecha][loteria][horario] = [];
      }

      grouped[fecha][loteria][horario].push(stat);
    });

    return grouped;
  }, [estadisticas]);

  // Calcular totales por horario
  const calcularTotalesHorario = (jugadas) => {
    const totalMonto = jugadas.reduce((sum, j) => sum + (j.monto || 0), 0);
    const totalGanancia = jugadas.reduce((sum, j) => sum + (parseFloat(j.ganancia_listero) || 0), 0);
    const totalPagar = jugadas.reduce((sum, j) => sum + (j.monto_a_pagar || 0), 0);
    return { totalMonto, totalGanancia, totalPagar };
  };

  // Calcular totales por lotería
  const calcularTotalesLoteria = (horarios) => {
    let totalMonto = 0;
    let totalGanancia = 0;
    let totalPagar = 0;

    Object.values(horarios).forEach((jugadas) => {
      const totales = calcularTotalesHorario(jugadas);
      totalMonto += totales.totalMonto;
      totalGanancia += totales.totalGanancia;
      totalPagar += totales.totalPagar;
    });

    return { totalMonto, totalGanancia, totalPagar };
  };

  // Calcular totales por fecha
  const calcularTotalesFecha = (loterias) => {
    let totalMonto = 0;
    let totalGanancia = 0;
    let totalPagar = 0;

    Object.values(loterias).forEach((horarios) => {
      const totales = calcularTotalesLoteria(horarios);
      totalMonto += totales.totalMonto;
      totalGanancia += totales.totalGanancia;
      totalPagar += totales.totalPagar;
    });

    return { totalMonto, totalGanancia, totalPagar };
  };

  // Toggle expansión
  const toggleDate = (fecha) => {
    setExpandedDates((prev) => ({ ...prev, [fecha]: !prev[fecha] }));
  };

  const toggleLoteria = (key) => {
    setExpandedLoterias((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHorario = (key) => {
    setExpandedHorarios((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Renderizar jugada individual
  const renderJugada = (jugada, index) => {
    const gano = jugada.monto_a_pagar > 0;
    
    return (
      <View key={`jugada-${index}-${jugada.numero || Math.random()}`} style={styles.jugadaCard}>
        <View style={styles.jugadaRow}>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>Número</Text>
            <Text style={styles.jugadaValue}>{jugada.numero}</Text>
          </View>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>Tipo</Text>
            <Text style={styles.jugadaValue}>{jugada.tipo_jugada}</Text>
          </View>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>Monto</Text>
            <Text style={styles.jugadaValue}>${jugada.monto?.toFixed(2)}</Text>
          </View>
        </View>
        
        <View style={styles.jugadaRow}>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>Ganancia</Text>
            <Text style={[styles.jugadaValue, styles.gananciaText]}>
              ${parseFloat(jugada.ganancia_listero || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>Resultado</Text>
            <Text style={[styles.jugadaValue, gano ? styles.ganoText : styles.perdioText]}>
              {gano ? 'Ganó' : 'Perdió'}
            </Text>
          </View>
          <View style={styles.jugadaCol}>
            <Text style={styles.jugadaLabel}>A Pagar</Text>
            <Text style={styles.jugadaValue}>${jugada.monto_a_pagar?.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Renderizar horario con jugadas
  const renderHorario = (fecha, loteria, horario, jugadas) => {
    const key = `${fecha}-${loteria}-${horario}`;
    const isExpanded = expandedHorarios[key];
    const totales = calcularTotalesHorario(jugadas);

    return (
      <View key={key} style={styles.horarioContainer}>
        <TouchableOpacity
          style={styles.horarioHeader}
          onPress={() => toggleHorario(key)}
        >
          <View style={styles.horarioHeaderLeft}>
            <Text style={styles.horarioIcon}>{isExpanded ? '▼' : '▶'}</Text>
            <Text style={styles.horarioName}>{horario}</Text>
            <Text style={styles.horarioCount}>({jugadas.length})</Text>
          </View>
          <View style={styles.horarioHeaderRight}>
            <Text style={styles.horarioTotal}>
              ${totales.totalGanancia.toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.jugadasContainer}>
            {jugadas.map((jugada, idx) => renderJugada(jugada, idx))}
            
            <View style={styles.totalesCard}>
              <Text style={styles.totalesTitle}>Totales del Horario</Text>
              <View style={styles.totalesRow}>
                <Text style={styles.totalesLabel}>Total Apostado:</Text>
                <Text style={styles.totalesValue}>${totales.totalMonto.toFixed(2)}</Text>
              </View>
              <View style={styles.totalesRow}>
                <Text style={styles.totalesLabel}>Total Ganancia:</Text>
                <Text style={[styles.totalesValue, styles.gananciaText]}>
                  ${totales.totalGanancia.toFixed(2)}
                </Text>
              </View>
              <View style={styles.totalesRow}>
                <Text style={styles.totalesLabel}>Total a Pagar:</Text>
                <Text style={styles.totalesValue}>${totales.totalPagar.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Renderizar lotería con horarios
  const renderLoteria = (fecha, loteria, horarios) => {
    const key = `${fecha}-${loteria}`;
    const isExpanded = expandedLoterias[key];
    const totales = calcularTotalesLoteria(horarios);
    const totalJugadas = Object.values(horarios).reduce((sum, jugadas) => sum + jugadas.length, 0);

    return (
      <View key={key} style={styles.loteriaContainer}>
        <TouchableOpacity
          style={styles.loteriaHeader}
          onPress={() => toggleLoteria(key)}
        >
          <View style={styles.loteriaHeaderLeft}>
            <Text style={styles.loteriaIcon}>{isExpanded ? '▼' : '▶'}</Text>
            <Text style={styles.loteriaName}>{loteria}</Text>
            <Text style={styles.loteriaCount}>({totalJugadas})</Text>
          </View>
          <View style={styles.loteriaHeaderRight}>
            <Text style={styles.loteriaTotal}>
              ${totales.totalGanancia.toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.horariosContainer}>
            {Object.entries(horarios).map(([horario, jugadas]) =>
              renderHorario(fecha, loteria, horario, jugadas)
            )}
          </View>
        )}
      </View>
    );
  };

  // Renderizar fecha con loterías
  const renderFecha = ({ item: fecha }) => {
    const loterias = groupedData[fecha];
    const totales = calcularTotalesFecha(loterias);
    const totalJugadas = Object.values(loterias).reduce((sum, horarios) => {
      return sum + Object.values(horarios).reduce((s, jugadas) => s + jugadas.length, 0);
    }, 0);

    return (
      <View style={styles.fechaContainer}>
        <View style={styles.fechaHeader}>
          <View style={styles.fechaHeaderLeft}>
            <Text style={styles.fechaTitle}>{fecha}</Text>
            <Text style={styles.fechaCount}>({totalJugadas} jugadas)</Text>
          </View>
          <View style={styles.fechaHeaderRight}>
            <Text style={styles.fechaGanancia}>
              Ganancia: ${totales.totalGanancia.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.loteriasContainer}>
          {Object.entries(loterias).map(([loteria, horarios]) =>
            renderLoteria(fecha, loteria, horarios)
          )}
        </View>
      </View>
    );
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    Alert.alert('Exportar PDF', 'Función de exportación en desarrollo');
  };

  // Rediseñar el filtro de fecha para hacerlo más profesional
  const renderFiltroFechaProfesional = () => (
    <View style={styles.filtroProfesional}>
      <TouchableOpacity onPress={() => setShowDesde(true)}>
        <Text style={styles.fechaTexto}>{fechaDesde.toLocaleDateString()}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowHasta(true)}>
        <Text style={styles.fechaTexto}>{fechaHasta.toLocaleDateString()}</Text>
      </TouchableOpacity>
      {showDesde && (
        <DateTimePickerWrapper
          value={fechaDesde}
          onChange={(date) => {
            setFechaDesde(date);
            setShowDesde(false);
          }}
          mode="date"
          display="calendar"
        />
      )}
      {showHasta && (
        <DateTimePickerWrapper
          value={fechaHasta}
          onChange={(date) => {
            setFechaHasta(date);
            setShowHasta(false);
          }}
          mode="date"
          display="calendar"
        />
      )}
    </View>
  );

  // Corregir filtros de lotería y horario
  const renderFiltrosAdicionales = () => (
    <View style={styles.filtrosAdicionales}>
      <DropdownPicker
        items={loteriasDisponibles.map((loteria) => ({ label: loteria.nombre, value: loteria.id }))}
        onChangeItem={(item) => setLoteriaSeleccionada(item.value)}
        placeholder="Seleccionar Lotería"
      />
      <DropdownPicker
        items={horariosDisponibles.map((horario) => ({ label: horario.nombre, value: horario.id }))}
        onChangeItem={(item) => setHorarioSeleccionado(item.value)}
        placeholder="Seleccionar Horario"
      />
    </View>
  );

  const fechas = Object.keys(groupedData);

  return (
    <>
      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSidebarVisible(true)} style={{ marginRight: 12 }}>
            <Ionicons name="menu" size={24} color="#2C3E50" />
          </Pressable>
          <Text style={styles.title}>Estadísticas de Bote</Text>
          <TouchableOpacity style={styles.pdfButton} onPress={handleExportPDF}>
            <Text style={styles.pdfButtonText}>📄 PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Filtros de fecha */}
        <View style={styles.filtersContainer}>
          {renderFiltroFechaProfesional()}
          <TouchableOpacity style={styles.filterButton} onPress={fetchEstadisticas}>
            <Text style={styles.filterButtonText}>Filtrar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#27AE60" />
            <Text style={styles.loadingText}>Cargando estadísticas...</Text>
          </View>
        ) : fechas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No hay estadísticas para el período seleccionado
            </Text>
          </View>
        ) : (
          <FlatList
            data={fechas}
            renderItem={renderFecha}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
          />
        )}

        <FeedbackBanner
          visible={feedbackVisible}
          message={feedbackMessage}
          type={feedbackType}
          onDismiss={() => setFeedbackVisible(false)}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    ...createShadowStyle(0, 1, 2, 0.1),
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
  },
  pdfButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    gap: 10,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  filterButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  filterButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#7F8C8D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
  },
  fechaContainer: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    ...createShadowStyle(0, 1, 3, 0.1),
  },
  fechaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#3498DB',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  fechaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fechaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fechaCount: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  fechaHeaderRight: {
    alignItems: 'flex-end',
  },
  fechaGanancia: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loteriasContainer: {
    padding: 6,
  },
  loteriaContainer: {
    marginBottom: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    overflow: 'hidden',
  },
  loteriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#27AE60',
  },
  loteriaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loteriaIcon: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  loteriaName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loteriaCount: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  loteriaHeaderRight: {
    alignItems: 'flex-end',
  },
  loteriaTotal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  horariosContainer: {
    padding: 6,
  },
  horarioContainer: {
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  horarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#E9ECEF',
  },
  horarioHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  horarioIcon: {
    fontSize: 9,
    color: '#495057',
  },
  horarioName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
  },
  horarioCount: {
    fontSize: 9,
    color: '#7F8C8D',
  },
  horarioHeaderRight: {
    alignItems: 'flex-end',
  },
  horarioTotal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#27AE60',
  },
  jugadasContainer: {
    padding: 6,
  },
  jugadaCard: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    marginBottom: 6,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
  },
  jugadaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  jugadaCol: {
    flex: 1,
  },
  jugadaLabel: {
    fontSize: 9,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  jugadaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2C3E50',
  },
  gananciaText: {
    color: '#27AE60',
  },
  ganoText: {
    color: '#27AE60',
    fontWeight: '700',
  },
  perdioText: {
    color: '#E74C3C',
  },
  totalesCard: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  totalesTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 6,
  },
  totalesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalesLabel: {
    fontSize: 10,
    color: '#495057',
  },
  totalesValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2C3E50',
  },
  totalesFechaCard: {
    backgroundColor: '#D1F2EB',
    padding: 10,
    margin: 6,
    borderRadius: 6,
  },
  totalesFechaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  dropdownMinimalista: {
    padding: 8,
    backgroundColor: '#F1F1F1',
    borderRadius: 4,
    marginTop: 4,
  },
  filtroMinimalista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    marginBottom: 12,
  },
  filtrosAdicionales: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filtroMinimalistaCompacto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    marginBottom: 12,
  },
  filtroProfesional: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    marginBottom: 12,
  },
  fechaTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
});

export default EstadisticasBoteScreen;
