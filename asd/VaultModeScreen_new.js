import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SideBarToggle } from '../components/SideBar';
import ModeSelector from '../components/ModeSelector';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';

const VaultModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Estados para los inputs de fijos y corridos
  const [numero, setNumero] = useState('');
  const [fijo, setFijo] = useState('');
  const [corrido, setCorrido] = useState('');
  
  // Estados para parles
  const [parleInput, setParleInput] = useState('');
  const [precioParle, setPrecioParle] = useState('');
  const [candadoAbierto, setCandadoAbierto] = useState(true); // true = abierto (precio total), false = cerrado (precio individual)
  
  // Estados para centenas
  const [centenaNumero, setCentenaNumero] = useState('');
  const [centenaPrecio, setCentenaPrecio] = useState('');
  
  // Estado para almacenar las jugadas enviadas
  const [jugadasFijosYCorridos, setJugadasFijosYCorridos] = useState([]);
  const [jugadasParles, setJugadasParles] = useState([]);
  const [jugadasCentenas, setJugadasCentenas] = useState([]);
  
  // Estados para manejar errores y estados de jugadas
  const [jugadasConError, setJugadasConError] = useState(new Set());
  const [jugadasEnviadas, setJugadasEnviadas] = useState(new Set());
  const [jugadasSeleccionadas, setJugadasSeleccionadas] = useState(new Set());
  
  // Función para agregar una jugada de fijos y corridos
  const agregarJugada = () => {
    if (numero && fijo && corrido) {
      const nuevaJugada = {
        numero: numero,
        fijo: fijo,
        corrido: corrido
      };
      setJugadasFijosYCorridos([...jugadasFijosYCorridos, nuevaJugada]);
      // Limpiar inputs
      setNumero('');
      setFijo('');
      setCorrido('');
    }
  };
  
  // Función para manejar el input de parles (auto-espaciado cada 2 dígitos)
  const manejarParleInput = (text) => {
    // Eliminar espacios y caracteres no numéricos
    const numeros = text.replace(/\D/g, '');
    
    // Agregar espacios cada 2 dígitos
    const numerosConEspacios = numeros.replace(/(.{2})/g, '$1 ').trim();
    
    setParleInput(numerosConEspacios);
  };
  
  // Función para agregar parles
  const agregarParle = () => {
    if (parleInput && precioParle) {
      // Extraer números individuales (cada par de dígitos)
      const numerosArray = parleInput.match(/.{1,2}/g) || [];
      const numerosCompletos = numerosArray.filter(num => num.length === 2);
      
      if (numerosCompletos.length > 0) {
        const precio = parseFloat(precioParle);
        const precioIndividual = candadoAbierto ? precio / numerosCompletos.length : precio;
        
        const nuevaJugadaParle = {
          numeros: numerosCompletos,
          precioIndividual: precioIndividual,
          precioTotal: candadoAbierto ? precio : precio * numerosCompletos.length,
          esPrecioTotal: candadoAbierto
        };
        
        setJugadasParles([...jugadasParles, nuevaJugadaParle]);
        // Limpiar inputs
        setParleInput('');
        setPrecioParle('');
      }
    }
  };
  
  // Función para manejar el input de centenas (auto-salto después de 3 dígitos)
  const manejarCentenaNumero = (text) => {
    const numeros = text.replace(/\D/g, '');
    if (numeros.length <= 3) {
      setCentenaNumero(numeros);
    }
  };
  
  // Función para agregar centenas
  const agregarCentena = () => {
    if (centenaNumero.length === 3 && centenaPrecio) {
      const nuevaCentena = {
        numero: centenaNumero,
        precio: parseFloat(centenaPrecio)
      };
      setJugadasCentenas([...jugadasCentenas, nuevaCentena]);
      // Limpiar inputs
      setCentenaNumero('');
      setCentenaPrecio('');
    }
  };
  
  // Función para generar ID único de jugada
  const generarIdJugada = (tipo, index) => `${tipo}-${index}`;
  
  // Función para manejar selección de jugadas (long press)
  const seleccionarJugada = (id) => {
    const nuevasSeleccionadas = new Set(jugadasSeleccionadas);
    if (nuevasSeleccionadas.has(id)) {
      nuevasSeleccionadas.delete(id);
    } else {
      nuevasSeleccionadas.add(id);
    }
    setJugadasSeleccionadas(nuevasSeleccionadas);
  };
  
  // Función para borrar jugadas seleccionadas
  const borrarSeleccionadas = () => {
    // Borrar solo jugadas en negro (no enviadas)
    const nuevasFijosYCorridos = jugadasFijosYCorridos.filter((_, index) => {
      const id = generarIdJugada('fijo', index);
      return !jugadasSeleccionadas.has(id) || jugadasEnviadas.has(id);
    });
    
    const nuevasParles = jugadasParles.filter((_, index) => {
      const id = generarIdJugada('parle', index);
      return !jugadasSeleccionadas.has(id) || jugadasEnviadas.has(id);
    });
    
    const nuevasCentenas = jugadasCentenas.filter((_, index) => {
      const id = generarIdJugada('centena', index);
      return !jugadasSeleccionadas.has(id) || jugadasEnviadas.has(id);
    });
    
    setJugadasFijosYCorridos(nuevasFijosYCorridos);
    setJugadasParles(nuevasParles);
    setJugadasCentenas(nuevasCentenas);
    setJugadasSeleccionadas(new Set());
  };
  
  // Función para borrar todo lo negro
  const borrarTodoNegro = () => {
    // Mantener solo las jugadas enviadas (verdes)
    const nuevasFijosYCorridos = jugadasFijosYCorridos.filter((_, index) => {
      const id = generarIdJugada('fijo', index);
      return jugadasEnviadas.has(id);
    });
    
    const nuevasParles = jugadasParles.filter((_, index) => {
      const id = generarIdJugada('parle', index);
      return jugadasEnviadas.has(id);
    });
    
    const nuevasCentenas = jugadasCentenas.filter((_, index) => {
      const id = generarIdJugada('centena', index);
      return jugadasEnviadas.has(id);
    });
    
    setJugadasFijosYCorridos(nuevasFijosYCorridos);
    setJugadasParles(nuevasParles);
    setJugadasCentenas(nuevasCentenas);
    setJugadasConError(new Set());
    setJugadasSeleccionadas(new Set());
  };
  
  // Función para enviar jugadas
  const enviarJugadas = () => {
    const nuevasEnviadas = new Set(jugadasEnviadas);
    const nuevosErrores = new Set();
    
    // Simular validación (ejemplo: precio mayor a 15000 da error)
    jugadasFijosYCorridos.forEach((jugada, index) => {
      const id = generarIdJugada('fijo', index);
      if (!jugadasEnviadas.has(id)) {
        const precioTotal = parseFloat(jugada.fijo) + parseFloat(jugada.corrido);
        if (precioTotal > 15000) {
          nuevosErrores.add(id);
        } else {
          nuevasEnviadas.add(id);
        }
      }
    });
    
    jugadasParles.forEach((jugada, index) => {
      const id = generarIdJugada('parle', index);
      if (!jugadasEnviadas.has(id)) {
        if (jugada.precioTotal > 15000) {
          nuevosErrores.add(id);
        } else {
          nuevasEnviadas.add(id);
        }
      }
    });
    
    jugadasCentenas.forEach((jugada, index) => {
      const id = generarIdJugada('centena', index);
      if (!jugadasEnviadas.has(id)) {
        if (jugada.precio > 15000) {
          nuevosErrores.add(id);
        } else {
          nuevasEnviadas.add(id);
        }
      }
    });
    
    setJugadasEnviadas(nuevasEnviadas);
    setJugadasConError(nuevosErrores);
    
    // Mostrar alerta si hay errores
    if (nuevosErrores.size > 0) {
      alert(`${nuevosErrores.size} jugada(s) exceden el límite de $15,000. Aparecen en rojo para que puedas eliminarlas.`);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Barra de navegación superior */}
      <View style={styles.headerFloating} pointerEvents="box-none">
        <View style={styles.inlineHeaderRow} pointerEvents="box-none">
          <SideBarToggle inline onToggle={() => setSidebarVisible(s => !s)} />
          <View style={styles.modeSelectorWrapper}>
            <ModeSelector 
              currentMode={currentMode || 'Vault'} 
              onModeChange={onModeChange} 
              isDarkMode={isDarkMode} 
              visibleModes={visibleModes} 
            />
          </View>
          <View style={styles.rightButtonsGroup} pointerEvents="box-none">
            <PricingInfoButton />
            <NotificationsButton />
          </View>
        </View>
      </View>
      
      {/* Grid de 3x3 */}
      <View style={styles.gridContainer}>
        {/* Fila 1 - Encabezados */}
        <View style={styles.headerRow}>
          <View style={[styles.headerCell, isDarkMode && styles.cellDark]}>
            <Text style={[styles.headerText, isDarkMode && styles.cellTextDark]}>
              Fijos y corridos
            </Text>
          </View>
          <View style={[styles.headerCell, isDarkMode && styles.cellDark]}>
            <Text style={[styles.headerText, isDarkMode && styles.cellTextDark]}>
              Parles
            </Text>
          </View>
          <View style={[styles.headerCell, isDarkMode && styles.cellDark]}>
            <Text style={[styles.headerText, isDarkMode && styles.cellTextDark]}>
              Centenas
            </Text>
          </View>
        </View>
        
        {/* Fila 2 - Mostrar jugadas */}
        <View style={styles.contentRow}>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Mostrar jugadas de fijos y corridos */}
            {jugadasFijosYCorridos.map((jugada, index) => {
              const id = generarIdJugada('fijo', index);
              const tieneError = jugadasConError.has(id);
              const estaEnviada = jugadasEnviadas.has(id);
              const estaSeleccionada = jugadasSeleccionadas.has(id);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.jugadaContainer,
                    estaSeleccionada && styles.jugadaSeleccionada
                  ]}
                  onLongPress={() => seleccionarJugada(id)}
                  delayLongPress={500}
                >
                  <Text style={[
                    styles.numeroText, 
                    isDarkMode && styles.cellTextDark,
                    tieneError && styles.textoError,
                    estaEnviada && styles.textoEnviado
                  ]}>
                    {jugada.numero}
                  </Text>
                  <View style={styles.circleContainer}>
                    <View style={[
                      styles.circle,
                      tieneError && styles.circleError,
                      estaEnviada && styles.circleEnviado
                    ]}>
                      <Text style={[
                        styles.circleText,
                        tieneError && styles.textoError,
                        estaEnviada && styles.textoEnviado
                      ]}>{jugada.fijo}</Text>
                    </View>
                    <View style={[
                      styles.circle,
                      tieneError && styles.circleError,
                      estaEnviada && styles.circleEnviado
                    ]}>
                      <Text style={[
                        styles.circleText,
                        tieneError && styles.textoError,
                        estaEnviada && styles.textoEnviado
                      ]}>{jugada.corrido}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Mostrar jugadas de parles */}
            {jugadasParles.map((jugada, index) => {
              const id = generarIdJugada('parle', index);
              const tieneError = jugadasConError.has(id);
              const estaEnviada = jugadasEnviadas.has(id);
              const estaSeleccionada = jugadasSeleccionadas.has(id);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.parleContainer,
                    estaSeleccionada && styles.jugadaSeleccionada
                  ]}
                  onLongPress={() => seleccionarJugada(id)}
                  delayLongPress={500}
                >
                  <View style={styles.numerosParleContainer}>
                    {jugada.numeros.map((num, numIndex) => (
                      <Text key={numIndex} style={[
                        styles.numeroParleText, 
                        isDarkMode && styles.cellTextDark,
                        tieneError && styles.textoError,
                        estaEnviada && styles.textoEnviado
                      ]}>
                        {num}
                      </Text>
                    ))}
                  </View>
                  <View style={[
                    styles.circleOutline,
                    tieneError && styles.circleError,
                    estaEnviada && styles.circleEnviado
                  ]}>
                    <Text style={[
                      styles.circleOutlineText, 
                      isDarkMode && styles.cellTextDark,
                      tieneError && styles.textoError,
                      estaEnviada && styles.textoEnviado
                    ]}>
                      ${jugada.precioIndividual.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Mostrar jugadas de centenas */}
            {jugadasCentenas.map((jugada, index) => {
              const id = generarIdJugada('centena', index);
              const tieneError = jugadasConError.has(id);
              const estaEnviada = jugadasEnviadas.has(id);
              const estaSeleccionada = jugadasSeleccionadas.has(id);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.centenaContainer,
                    estaSeleccionada && styles.jugadaSeleccionada
                  ]}
                  onLongPress={() => seleccionarJugada(id)}
                  delayLongPress={500}
                >
                  <Text style={[
                    styles.numeroCentenaText, 
                    isDarkMode && styles.cellTextDark,
                    tieneError && styles.textoError,
                    estaEnviada && styles.textoEnviado
                  ]}>
                    {jugada.numero}
                  </Text>
                  <View style={[
                    styles.circleOutline,
                    tieneError && styles.circleError,
                    estaEnviada && styles.circleEnviado
                  ]}>
                    <Text style={[
                      styles.circleOutlineText, 
                      isDarkMode && styles.cellTextDark,
                      tieneError && styles.textoError,
                      estaEnviada && styles.textoEnviado
                    ]}>
                      ${jugada.precio.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        {/* Fila 3 - Inputs */}
        <View style={styles.inputRow}>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Inputs para fijos y corridos */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="#"
                placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                value={numero}
                onChangeText={setNumero}
                keyboardType="numeric"
                maxLength={3}
              />
              <TextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="$"
                placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                value={fijo}
                onChangeText={setFijo}
                keyboardType="numeric"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="$"
                placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                value={corrido}
                onChangeText={setCorrido}
                keyboardType="numeric"
                maxLength={2}
              />
              <TouchableOpacity 
                style={[styles.addButton, isDarkMode && styles.addButtonDark]}
                onPress={agregarJugada}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Inputs para parles - horizontales */}
            <View style={styles.inputContainer}>
              <View style={styles.parleInputsHorizontal}>
                <TextInput
                  style={[styles.input, styles.inputHorizontal, isDarkMode && styles.inputDark]}
                  placeholder="#"
                  placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                  value={parleInput}
                  onChangeText={manejarParleInput}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.inputHorizontal, isDarkMode && styles.inputDark]}
                  placeholder="$"
                  placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                  value={precioParle}
                  onChangeText={setPrecioParle}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity 
                style={[styles.addButton, isDarkMode && styles.addButtonDark]}
                onPress={agregarParle}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
              <View style={styles.candadoSection}>
                <TouchableOpacity 
                  style={styles.candadoButton}
                  onPress={() => setCandadoAbierto(!candadoAbierto)}
                >
                  <Text style={styles.candadoText}>
                    {candadoAbierto ? '🔓' : '🔒'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.candadoLabel, isDarkMode && styles.cellTextDark]}>
                  {candadoAbierto ? 'Precio total' : 'Precio individual'}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.cell, isDarkMode && styles.cellDark]}>
            {/* Inputs para centenas - horizontales */}
            <View style={styles.inputContainer}>
              <View style={styles.centenaInputsHorizontal}>
                <TextInput
                  style={[styles.input, styles.inputHorizontal, isDarkMode && styles.inputDark]}
                  placeholder="#"
                  placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                  value={centenaNumero}
                  onChangeText={manejarCentenaNumero}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.input, styles.inputHorizontal, isDarkMode && styles.inputDark]}
                  placeholder="$"
                  placeholderTextColor={isDarkMode ? '#95a5a6' : '#7f8c8d'}
                  value={centenaPrecio}
                  onChangeText={setCentenaPrecio}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity 
                style={[styles.addButton, isDarkMode && styles.addButtonDark]}
                onPress={agregarCentena}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      
      {/* Botones de acción */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={jugadasSeleccionadas.size > 0 ? borrarSeleccionadas : borrarTodoNegro}
        >
          <Text style={styles.actionButtonText}>
            {jugadasSeleccionadas.size > 0 ? 'Eliminar' : 'Borrar'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.sendButton]}
          onPress={enviarJugadas}
        >
          <Text style={styles.actionButtonText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f8ff' 
  },
  containerDark: { 
    backgroundColor: '#2c3e50' 
  },
  headerFloating: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-start', 
    zIndex: 3000, 
    paddingTop: 10, 
    paddingBottom: 10, 
    paddingHorizontal: 12, 
    backgroundColor: 'rgba(255,255,255,0.96)', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E6EA', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 4, 
    elevation: 4 
  },
  inlineHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    flex: 1, 
    paddingTop: 0, 
    minHeight: 44 
  },
  rightButtonsGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginLeft: 'auto', 
    flexWrap: 'wrap' 
  },
  modeSelectorWrapper: { 
    marginLeft: 6, 
    flexShrink: 1 
  },
  gridContainer: {
    flex: 1,
    paddingTop: 80, // Espacio para la barra superior
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    height: 50, // Altura fija pequeña para encabezados
    marginBottom: 10,
  },
  contentRow: {
    flex: 3, // Mayor espacio para mostrar jugadas
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputRow: {
    flex: 2, // Espacio para inputs
    flexDirection: 'row',
  },
  headerCell: {
    flex: 1,
    backgroundColor: '#e3f2fd',
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E6EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    marginBottom: 10,
  },
  cell: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E6EA',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
    padding: 10,
  },
  cellDark: {
    backgroundColor: '#34495e',
    borderColor: '#4a6278',
  },
  cellText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  cellTextDark: {
    color: '#ecf0f1',
  },
  // Estilos para inputs
  inputContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: '90%',
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E6EA',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  inputDark: {
    backgroundColor: '#2c3e50',
    borderColor: '#4a6278',
    color: '#ecf0f1',
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#3498db',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  addButtonDark: {
    backgroundColor: '#2980b9',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Estilos para mostrar jugadas
  jugadaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  numeroText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  circleContainer: {
    flexDirection: 'row',
    gap: 5,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Estilos para parles
  parleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  numerosParleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 5,
  },
  numeroParleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  circleOutline: {
    minWidth: 40,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  circleOutlineText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  parleInput: {
    height: 45,
  },
  precioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    gap: 8,
  },
  precioInput: {
    flex: 1,
    height: 40,
  },
  candadoButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  candadoText: {
    fontSize: 16,
  },
  candadoLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Estilos para header con inputs transparentes
  headerInputsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  headerInputsHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transparentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
    backgroundColor: 'transparent',
  },
  headerCandadoButton: {
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerCandadoText: {
    fontSize: 14,
  },
  // Estilos para inputs horizontales
  parleInputsHorizontal: {
    flexDirection: 'row',
    width: '90%',
    gap: 8,
    marginBottom: 8,
  },
  centenaInputsHorizontal: {
    flexDirection: 'row',
    width: '90%',
    gap: 8,
    marginBottom: 8,
  },
  inputHorizontal: {
    flex: 1,
    height: 40,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  candadoSection: {
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  // Estilos para centenas
  centenaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  numeroCentenaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  // Estilos para estados de jugadas
  jugadaSeleccionada: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    borderWidth: 2,
  },
  textoError: {
    color: '#f44336',
  },
  textoEnviado: {
    color: '#4caf50',
  },
  circleError: {
    borderColor: '#f44336',
  },
  circleEnviado: {
    borderColor: '#4caf50',
  },
  // Estilos para botones de acción
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  sendButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VaultModeScreen;