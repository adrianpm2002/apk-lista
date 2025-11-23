import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, FlatList, TouchableOpacity, Switch, Platform, ScrollView, BackHandler } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { adminResetPasswordByUsername } from '../utils/adminUtils';
import { createShadowStyle } from '../utils/shadowUtils';

// Orden canónico unificado de jugadas en toda la app
const JUGADA_ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];

// Componente Button personalizado para evitar warnings de pointerEvents
const CustomButton = ({ title, onPress, disabled = false, color = '#007AFF', style }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      {
        backgroundColor: disabled ? '#ccc' : color,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 6,
        marginVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
      },
      style
    ]}
  >
    <Text style={{
      color: disabled ? '#999' : '#fff',
      fontSize: 16,
      fontWeight: '600'
    }}>
      {title}
    </Text>
  </TouchableOpacity>
);

const CreateUserScreen = ({ navigation, onModeVisibilityChange }) => {
  // Estados locales
  const [userRole, setUserRole] = useState(null);
  
  const [users, setUsers] = useState([]);
  const [hierarchicalUsers, setHierarchicalUsers] = useState([]);
  const [expandedCollectors, setExpandedCollectors] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('');
  // Estados específicos para gestión de clientes (listero)
  const [balanceModalVisible, setBalanceModalVisible] = useState(false);
  const [balanceTargetClient, setBalanceTargetClient] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  // Uso actualizado: se guarda id_precio como JSONB con {loteria_id: ganancia_id, loteria_nombre: nombre} en profiles
  // Ganancias disponibles (tabla precio) y selección (solo colector asigna a listeros)
  const [gainOptions, setGainOptions] = useState([]); // [{id,nombre,precios}] - todas las configuraciones para resolución de nombres
  const [validGainOptions, setValidGainOptions] = useState([]); // [{id,nombre,precios}] - solo configuraciones válidas para modal
  const [availableLotteries, setAvailableLotteries] = useState([]); // [{id, nombre}]
  const [selectedLotteryGains, setSelectedLotteryGains] = useState({}); // {lotteryId: gainId}
  const [selectedGainDetail, setSelectedGainDetail] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [updatingUsers, setUpdatingUsers] = useState(new Set()); // Para tracking de actualizaciones
  const [activePlayTypes, setActivePlayTypes] = useState([]); // jugadas activas del banco
  const [enableSpecificLimits, setEnableSpecificLimits] = useState(false); // toggle crear listero
  const [limitsValues, setLimitsValues] = useState({}); // valores ingresados para limites específicos por lotería: {lotteryId: {playType: value}}
  const [lotteryActivePlayTypes, setLotteryActivePlayTypes] = useState({}); // jugadas activas por lotería: {lotteryId: [jugadas]}
  // Estado para reset de contraseña (solo admin)
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPassword2, setResetPassword2] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPassword2, setShowResetPassword2] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Estado para modal de ganancia
  const [gainModalVisible, setGainModalVisible] = useState(false);
  const [gainTargetUser, setGainTargetUser] = useState(null);

  // Función para obtener el perfil del usuario actual
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data: profile } = await supabase.from('profiles').select('role, id_banco').eq('id', user.id).single();
        if (profile) {
          if (profile.role !== 'admin' && profile.role !== 'collector' && profile.role !== 'listero') {
            Alert.alert('No Autorizado', 'Solo administradores, colectores o listeros autorizados');
            return;
          }
          
          setUserRole(profile.role);
          const bankId = profile.role === 'admin' ? user.id : profile.id_banco;
          setCurrentBankId(bankId);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const createHierarchicalStructure = useCallback((userData) => {
    const hierarchical = [];
    const collectors = userData.filter(user => user.role === 'collector');
    const listeros = userData.filter(user => user.role === 'listero');
    
    // Solo procesar collectors y listeros - ignorar administradores
    collectors.forEach(collector => {
      const collectorListeros = listeros.filter(listero => listero.id_collector === collector.id);
      
      hierarchical.push({
        ...collector,
        type: 'collector',
        level: 0,
        hasListeros: collectorListeros.length > 0,
        isExpanded: expandedCollectors.has(collector.id)
      });
      
      if (expandedCollectors.has(collector.id)) {
        collectorListeros.forEach(listero => {
          hierarchical.push({
            ...listero,
            type: 'listero',
            level: 1,
            parentCollector: collector.username
          });
        });
      }
    });
    
    // Agregar listeros sin collector asignado O cuyo collector no está en la lista (fallback)
    const orphanListeros = listeros.filter(listero => !listero.id_collector || !collectors.some(c => c.id === listero.id_collector));
    orphanListeros.forEach(listero => {
      hierarchical.push({
        ...listero,
        type: 'listero',
        level: collectors.some(c => c.id === listero.id_collector) ? 1 : 0
      });
    });
    
    setHierarchicalUsers(hierarchical);
  }, [expandedCollectors]);

  const fetchUsers = useCallback(async () => {
    if (!currentBankId) return;
    if ((userRole === 'collector' || userRole === 'listero') && !currentUserId) {
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, id_banco, id_collector, activo, id_precio, limite_especifico, balance, lister_id')
      .eq('id_banco', currentBankId)
      .order('role', { ascending: false })
      .order('username');
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    if (userRole === 'collector') {
      const onlyListeros = (data || []).filter(u => (u.role === 'listero') && u.id_collector === currentUserId);
      setUsers(onlyListeros);
      setHierarchicalUsers(onlyListeros.map(u => ({ ...u, type: 'listero', level: 0 })));
      return;
    }
    
    if (userRole === 'listero') {
      // Solo mostrar clientes del listero actual
      const onlyClients = (data || []).filter(u => (u.role === 'client') && u.lister_id === currentUserId);
      setUsers(onlyClients);
      setHierarchicalUsers(onlyClients.map(u => ({ ...u, type: 'client', level: 0 })));
      return;
    }
    
    // Filtrar administradores - solo mostrar colectores y listeros
    const filteredData = (data || []).filter(u => u.role !== 'admin');
    setUsers(filteredData);
    createHierarchicalStructure(filteredData);
  }, [currentBankId, userRole, currentUserId, createHierarchicalStructure]);

  useEffect(() => {
    const timeoutId = setTimeout(fetchUserProfile, 10);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (currentBankId) {
      fetchUsers();
      fetchActivePlayTypes();
    }
  }, [currentBankId, fetchUsers]);

  // Asegurar recarga cuando se determina el rol (collector) después de haber seteado bankId
  useEffect(() => {
    if (currentBankId) {
      fetchUsers();
    }
  }, [userRole, currentBankId, currentUserId, fetchUsers]);

  const fetchActivePlayTypes = useCallback(async () => {
    if (!currentBankId) return;
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', currentBankId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') { // ignorar no rows
        return;
      }
      
      let actives = [];
      const jugadas = data?.jugadas || {};
      
      // Formato nuevo: { "uuid-loteria-1": { fijo: true, ... }, "uuid-loteria-2": { ... } }
      // Crear unión de todas las jugadas activas en cualquier lotería
      const allActivePlayTypes = new Set();
      Object.values(jugadas).forEach(lotteryJugadas => {
        if (lotteryJugadas && typeof lotteryJugadas === 'object') {
          Object.entries(lotteryJugadas).forEach(([jugada, isActive]) => {
            if (isActive) {
              allActivePlayTypes.add(jugada);
            }
          });
        }
      });
      actives = Array.from(allActivePlayTypes);
      
      // Si no hay jugadas configuradas, usar todas como activas (fallback)
      if (actives.length === 0) {
        actives = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];
      }
      
      // Ordenar según orden canónico
      actives.sort((a,b) => {
        const ia = JUGADA_ORDER.indexOf(a);
        const ib = JUGADA_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      setActivePlayTypes(actives);
      
      // Inicializar límites por lotería y jugada
      setLimitsValues(prev => {
        const draft = { ...prev };
        
        // Para cada lotería disponible
        availableLotteries.forEach(lottery => {
          if (!draft[lottery.id]) {
            draft[lottery.id] = {};
          }
          
          // Para cada jugada activa
          actives.forEach(playType => {
            if (draft[lottery.id][playType] === undefined) {
              draft[lottery.id][playType] = '';
            }
          });
        });
        
        return draft;
      });
    } catch (e) {
      console.error('Excepción fetchActivePlayTypes:', e);
    }
  }, [currentBankId]);

  // Cargar configuraciones de precio disponibles (sin filtro estricto por jugadas activas)
  const fetchValidGains = useCallback(async () => {
    if (!currentBankId) return;
    try {
      const { data, error } = await supabase
        .from('precio')
        .select(`
          id, 
          nombre, 
          precios, 
          id_banco, 
          id_loteria,
          loteria:id_loteria(nombre)
        `)
        .eq('id_banco', currentBankId);
      if (error) { 
        return; 
      }
      
      // Procesar datos para incluir el nombre de la lotería
      const processedData = (data || []).map(cfg => ({
        ...cfg,
        loteriaNombre: cfg.loteria?.nombre || 'Lotería desconocida'
      }));
      
      // Filtrar configuraciones que tengan estructura válida
      const filtered = processedData.filter(cfg => {
        if (!cfg || !cfg.precios || typeof cfg.precios !== 'object') return false;
        
        // Verificar que al menos tenga alguna jugada configurada correctamente
        const keys = Object.keys(cfg.precios);
        return keys.some(k => {
          const v = cfg.precios[k];
          if (!v || typeof v !== 'object') return false;
          const req = ['limited','regular','listeroPct','collectorPct'];
          return req.every(r => r in v);
        });
      });
      
      // Tanto admin como collector pueden usar todas las configuraciones válidas
      setGainOptions(filtered);
      setValidGainOptions(filtered);
    } catch (e) {
      // Error silencioso para producción
    }
  }, [userRole, currentBankId]);

  useEffect(() => { fetchValidGains(); }, [fetchValidGains]);

  // Función helper para obtener jugadas activas por lotería específica
  const getActivePlayTypesForLottery = useCallback(async (lotteryId) => {
    if (!currentBankId || !lotteryId) return [];
    
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', currentBankId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') return [];
      
      const jugadas = data?.jugadas || {};
      
      // Formato nuevo: usar jugadas específicas de esta lotería
      const lotteryJugadas = jugadas[lotteryId] || {};
      const actives = Object.keys(lotteryJugadas).filter(k => lotteryJugadas[k]);
      
      // Ordenar según orden canónico
      actives.sort((a,b) => {
        const ia = JUGADA_ORDER.indexOf(a);
        const ib = JUGADA_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      
      return actives;
    } catch (e) {
      return [];
    }
  }, [currentBankId]);

  // Cargar jugadas activas por lotería cuando se habilitan límites específicos
  useEffect(() => {
    if (enableSpecificLimits && availableLotteries.length > 0) {
      const loadLotteryActivePlayTypes = async () => {
        const lotteryPlayTypes = {};
        for (const lottery of availableLotteries) {
          const actives = await getActivePlayTypesForLottery(lottery.id);
          lotteryPlayTypes[lottery.id] = actives;
        }
        setLotteryActivePlayTypes(lotteryPlayTypes);
      };
      loadLotteryActivePlayTypes();
    }
  }, [enableSpecificLimits, availableLotteries, getActivePlayTypesForLottery]);

  // Función auxiliar para determinar si una ganancia es válida según las jugadas activas de la lotería específica
  const isGainValidForLottery = useCallback(async (gainId, lotteryId) => {
    const gain = gainOptions.find(g => g.id === gainId && g.id_loteria === lotteryId);
    if (!gain || !gain.precios || typeof gain.precios !== 'object') return false;
    
    // Obtener jugadas activas específicas para esta lotería
    const lotteryActivePlayTypes = await getActivePlayTypesForLottery(lotteryId);
    if (lotteryActivePlayTypes.length === 0) return false;
    
    const actSet = new Set(lotteryActivePlayTypes);
    const keys = Object.keys(gain.precios);
    
    // Verificar que la ganancia tenga exactamente las mismas jugadas que están activas en la lotería
    if (keys.length !== actSet.size) return false;
    
    for (const k of keys) {
      if (!actSet.has(k)) return false;
      const v = gain.precios[k];
      if (!v || typeof v !== 'object') return false;
      const req = ['limited','regular','listeroPct','collectorPct'];
      for (const r of req) { if (!(r in v)) return false; }
    }
    
    for (const a of actSet) { if (!(a in gain.precios)) return false; }
    
    return true;
  }, [gainOptions, getActivePlayTypesForLottery]);

  // Cargar loterías disponibles para el banco
  const fetchAvailableLotteries = useCallback(async () => {
    if (!currentBankId) return;
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', currentBankId)
        .order('nombre', { ascending: true });
      
      if (error) {
        console.error('Error loading lotteries:', error);
        return;
      }
      
      setAvailableLotteries(data || []);
    } catch (e) {
      console.error('Excepción fetchAvailableLotteries:', e);
    }
  }, [currentBankId]);

  useEffect(() => { fetchAvailableLotteries(); }, [fetchAvailableLotteries]);

  // Recrear estructura jerárquica cuando cambien los usuarios
  useEffect(() => {
    if (users.length === 0) return;
    if (userRole === 'collector') {
      // Para collector, la lista es plana de sus listeros; reflejar cambios (ej. activo) inmediatamente
      setHierarchicalUsers(users.map(u => ({ ...u, type: 'listero', level: 0 })));
    } else {
      createHierarchicalStructure(users);
    }
  }, [users, createHierarchicalStructure, userRole]);

  // ========== ANDROID BACK HANDLER ==========
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Cerrar Aplicación',
          '¿Estás seguro de que quieres salir?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; // Prevenir navegación hacia atrás
      });

      return () => backHandler.remove();
    }
  }, []);

  const handleCreateOrUpdate = async () => {
    try {
      // Forzar role según el tipo de usuario
      let effectiveRole = role;
      if (userRole === 'collector') {
        effectiveRole = 'listero';
      } else if (userRole === 'listero') {
        effectiveRole = 'client';
      }

      if (!username || (!isEditing && !password) || !effectiveRole) {
        Alert.alert('Error', 'Todos los campos son obligatorios.');
        return;
      }

      if (username.includes('@')) {
        Alert.alert('Error', 'El nombre de usuario no debe contener "@".');
        return;
      }
      
      // Validaciones específicas por rol
      if (userRole !== 'collector' && userRole !== 'listero' && effectiveRole === 'listero' && !selectedCollector) {
        Alert.alert('Error', 'Debes seleccionar un colector.');
        return;
      }
      
      // Validación de balance para clientes (listero creando cliente)
      if (effectiveRole === 'client' && !isEditing && !balanceAmount) {
        Alert.alert('Error', 'Debes asignar un balance inicial al cliente.');
        return;
      }

      const fakeEmail = `${username.toLowerCase()}@example.com`;

      if (isEditing && editingUser) {
        let refreshedAfterEdit = false;
        // Usar método directo de actualización (más confiable)
        try {
          const directUpdate = {
            username,
            role: effectiveRole,
            id_collector: userRole === 'collector' ? currentUserId : (selectedCollector || null),
            id_precio: ((userRole === 'collector' || userRole === 'admin') && effectiveRole === 'listero') ? buildGainsData() : (editingUser.id_precio || null),
            activo: editingUser.activo !== undefined ? editingUser.activo : true
          };
          
          // Si es cliente, añadir lister_id
          if (effectiveRole === 'client') {
            directUpdate.lister_id = userRole === 'listero' ? currentUserId : editingUser.lister_id;
          }
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update(directUpdate)
            .eq('id', editingUser.id);
          if (updateError) {
            console.error('Update error:', updateError);
            return Alert.alert('Error al actualizar', `Error: ${updateError.message}`);
          }
        } catch (error) {
          console.error('Error updating user:', error);
          return Alert.alert('Error al actualizar', 'Error general de actualización');
        }
        // 2. Aplicar límites específicos si corresponde
        if (effectiveRole === 'listero' && userRole !== 'collector') {
          try {
            if (enableSpecificLimits) {
              const limitsObj = {};
              
              // Procesar límites por lotería
              Object.entries(limitsValues).forEach(([lotteryId, lotteryLimits]) => {
                const lotteryLimitsObj = {};
                
                Object.entries(lotteryLimits || {}).forEach(([playType, value]) => {
                  if (value && !isNaN(value)) {
                    const num = parseInt(value, 10);
                    if (num > 0) lotteryLimitsObj[playType] = num;
                  }
                });
                
                if (Object.keys(lotteryLimitsObj).length > 0) {
                  limitsObj[lotteryId] = lotteryLimitsObj;
                }
              });
              
              const { error: upErr } = await supabase
                .from('profiles')
                .update({ limite_especifico: Object.keys(limitsObj).length ? limitsObj : null })
                .eq('id', editingUser.id);
              if (upErr) console.error('Error actualizando limites especificos:', upErr);
            } else {
              const { error: clearErr } = await supabase
                .from('profiles')
                .update({ limite_especifico: null })
                .eq('id', editingUser.id);
              if (clearErr) console.error('Error limpiando limites especificos:', clearErr);
            }
          } catch (ee) {
            console.error('Excepción límites específicos edición:', ee);
          }
        }
        // Refresh inmediato para reflejar cambios
        try {
          await fetchUsers();
          refreshedAfterEdit = true;
        } catch {}
        Alert.alert('Éxito', 'Usuario actualizado correctamente');
      } else {
        // Verificar si ya existe un usuario con ese username
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username);

        if (checkError) {
          console.error('Check Error:', checkError);
          return Alert.alert('Error', 'Error al verificar usuario existente');
        }

        if (existingUsers && existingUsers.length > 0) {
          return Alert.alert('Error', 'Ya existe un usuario con ese nombre. Por favor elige otro nombre.');
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
        });

        if (signUpError) {
          console.error('SignUp Error:', signUpError);
          if (signUpError.message.includes('User already registered')) {
            return Alert.alert('Error', 'Ya existe un usuario con ese nombre. Por favor elige otro nombre.');
          }
          return Alert.alert('Error al registrar', signUpError.message);
        }

        const newUserId = signUpData.user?.id;

        if (newUserId) {
          let id_banco = currentBankId;
          let id_collector = null;
          let lister_id = null;
          
          if (effectiveRole === 'collector') {
            id_collector = null;
          } else if (effectiveRole === 'listero') {
            id_collector = userRole === 'collector' ? currentUserId : selectedCollector;
          } else if (effectiveRole === 'client') {
            // Los clientes tienen lister_id (el listero que los crea)
            lister_id = currentUserId;
          }

          const insertData = {
             id: newUserId,
             username,
             role: effectiveRole,
             id_banco,
             id_collector,
             lister_id,
             id_precio: ((userRole === 'collector' || userRole === 'admin') && effectiveRole === 'listero') ? buildGainsData() : null,
             balance: effectiveRole === 'client' ? parseFloat(balanceAmount) || 0 : null,
           };


          if (effectiveRole === 'listero' && enableSpecificLimits && userRole !== 'collector') {
            const limitsObj = {};
            
            // Procesar límites por lotería
            Object.entries(limitsValues).forEach(([lotteryId, lotteryLimits]) => {
              const lotteryLimitsObj = {};
              
              Object.entries(lotteryLimits || {}).forEach(([playType, value]) => {
                if (value && !isNaN(value)) {
                  const num = parseInt(value, 10);
                  if (num > 0) lotteryLimitsObj[playType] = num;
                }
              });
              
              if (Object.keys(lotteryLimitsObj).length > 0) {
                limitsObj[lotteryId] = lotteryLimitsObj;
              }
            });
            
            if (Object.keys(limitsObj).length > 0) {
              insertData.limite_especifico = limitsObj; // JSONB por lotería
            }
          }

          const { error: insertError } = await supabase
            .from('profiles')
            .insert(insertData, { returning: 'minimal' });

          if (insertError) {
            console.error('Insert Error:', insertError);
            await supabase.auth.admin.deleteUser(newUserId);
            return Alert.alert('Error al guardar perfil', insertError.message);
          }

          Alert.alert('Éxito', 'Usuario creado');
        }
      }

      setModalVisible(false);
      clearForm();
      // Evitar doble fetch si ya se hizo refresh tras edición
      if (!(isEditing && editingUser)) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Unexpected Error:', error);
      Alert.alert('Error inesperado', error.message || 'Ocurrió un problema inesperado.');
    }
  };

  const handleDelete = useCallback((id) => {
    // Verificar permisos según rol
    if (userRole === 'listero') {
      const target = users.find(u => u.id === id);
      if (!target || target.role !== 'client' || target.lister_id !== currentUserId) {
        Alert.alert('Acción no permitida', 'Solo puedes eliminar tus propios clientes.');
        return;
      }
    }
    
    const executeDeletion = async () => {
      // Eliminación optimista local
      setUsers(prev => {
        const toDelete = prev.find(u => u.id === id);
        const filtered = prev.filter(u => u.id !== id);
        // Si era colector y el backend también elimina/ajusta listeros, dejamos que fetch sincronice.
        // Si no, esos listeros quedarán como huérfanos tras fetch si siguen existiendo.
        return filtered;
      });
      // Si estaba expandido quitarlo
      setExpandedCollectors(prev => {
        if (prev.has(id)) {
          const n = new Set(prev);
            n.delete(id);
            return n;
        }
        return prev;
      });
      // Recalcular estructura rápidamente con el estado actualizado (esperar siguiente tick)
      setTimeout(() => {
        createHierarchicalStructure(
          (prevUsersRef => prevUsersRef)(users.filter(u => u.id !== id))
        );
      }, 0);

      try {
        const { data, error } = await supabase.rpc('delete_user_complete', { user_id: id });
        if (error) throw error;
        if (data && data.success === false) {
          throw new Error(data.message || data.error || 'Fallo al eliminar');
        }
      } catch (e) {
        console.error('Delete Error:', e);
        Alert.alert('Error', e.message || 'No se pudo eliminar. Refrescando.');
        // Re-sincronizar lista real
      } finally {
        fetchUsers();
      }
    };

    const userType = userRole === 'listero' ? 'cliente' : 'usuario';
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar definitivamente este ${userType}?`)) {
        executeDeletion();
      }
    } else {
      Alert.alert(
        `Eliminar ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
        `¿Eliminar definitivamente este ${userType}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: executeDeletion }
        ]
      );
    }
  }, [users, fetchUsers, createHierarchicalStructure, userRole, currentUserId]);

  // Función para abrir modal de recarga de balance
  const openBalanceModal = (client) => {
    if (userRole !== 'listero') return;
    setBalanceTargetClient(client);
    setBalanceAmount('');
    setBalanceModalVisible(true);
  };

  // Función para recargar balance de un cliente
  const handleRechargeBalance = async () => {
    if (!balanceTargetClient || !balanceAmount) {
      Alert.alert('Error', 'Debe ingresar una cantidad válida.');
      return;
    }

    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'La cantidad debe ser un número positivo.');
      return;
    }

    setIsAddingBalance(true);
    try {
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', balanceTargetClient.id)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = parseFloat(currentProfile.balance) || 0;
      const newBalance = currentBalance + amount;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', balanceTargetClient.id);

      if (updateError) throw updateError;

      Alert.alert('Éxito', `Se ha recargado $${amount.toFixed(2)} al cliente ${balanceTargetClient.username}. Nuevo balance: $${newBalance.toFixed(2)}`);
      setBalanceModalVisible(false);
      setBalanceAmount('');
      fetchUsers();
    } catch (error) {
      console.error('Error recargando balance:', error);
      Alert.alert('Error', 'No se pudo recargar el balance del cliente.');
    } finally {
      setIsAddingBalance(false);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    // Permitir a collector solo sobre sus listeros
    if (userRole === 'collector') {
      const target = users.find(u => u.id === userId);
      if (!target || target.role !== 'listero' || target.id_collector !== currentUserId) {
        Alert.alert('Acción no permitida', 'Solo puedes cambiar estado de tus listeros.');
        return;
      }
    }
    
    // Permitir a listero solo sobre sus clientes
    if (userRole === 'listero') {
      const target = users.find(u => u.id === userId);
      if (!target || target.role !== 'client' || target.lister_id !== currentUserId) {
        Alert.alert('Acción no permitida', 'Solo puedes cambiar estado de tus clientes.');
        return;
      }
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newStatus = !currentStatus;
    const action = newStatus ? 'activar' : 'desactivar';
    const isCollector = targetUser.role === 'collector';
    const isListero = targetUser.role === 'listero';

    // Bloqueo: no permitir activar listero si su colector está inactivo
    if (isListero && newStatus) {
      const parentCollector = users.find(u => u.id === targetUser.id_collector);
      if (parentCollector && parentCollector.activo === false) {
        Alert.alert('Acción no permitida', 'No puedes activar un listero cuyo colector está inactivo.');
        return;
      }
    }

    // IDs afectados (cascade si colector)
    let affectedIds = [userId];
    if (isCollector) {
      const collectorListeros = users.filter(u => u.id_collector === userId && u.role === 'listero');
      affectedIds = [userId, ...collectorListeros.map(l => l.id)];
    }

    // Marcar todos como en actualización
    setUpdatingUsers(prev => new Set([...prev, ...affectedIds]));

    // Actualización local optimista
    setUsers(prev => {
      const updated = prev.map(u => (
        affectedIds.includes(u.id) ? { ...u, activo: newStatus } : u
      ));
      // Si collector, también actualizar hierarchicalUsers inmediatamente
      if (userRole === 'collector') {
        setHierarchicalUsers(updated.map(u => ({ ...u, type: 'listero', level: 0 })));
      }
      return updated;
    });

    try {
      if (isCollector) {
        // Actualizar colector y listeros vinculados en cascada
        const { error: cascadeError } = await supabase
          .from('profiles')
          .update({ activo: newStatus })
          .in('id', affectedIds);

        if (cascadeError) throw cascadeError;
      } else {
        // Actualización simple para listero / admin
        const { error: singleError } = await supabase
          .from('profiles')
          .update({ activo: newStatus })
          .eq('id', userId);
        if (singleError) throw singleError;
      }
    } catch (err) {
      console.error('Error toggle activo:', err);
      Alert.alert('Error', `No se pudo ${action} el usuario: ${err.message}`);
      // Revertir local
      setUsers(prev => {
        const reverted = prev.map(u => (
          affectedIds.includes(u.id) ? { ...u, activo: currentStatus } : u
        ));
        if (userRole === 'collector') {
          setHierarchicalUsers(reverted.map(u => ({ ...u, type: 'listero', level: 0 })));
        }
        return reverted;
      });
      fetchUsers();
    } finally {
      // Limpiar updating set
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        affectedIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const toggleCollectorExpansion = (collectorId) => {
    const newExpanded = new Set(expandedCollectors);
    if (newExpanded.has(collectorId)) {
      newExpanded.delete(collectorId);
    } else {
      newExpanded.add(collectorId);
    }
    setExpandedCollectors(newExpanded);
    // Solo recrear estructura si hay datos
    if (users.length > 0) {
      createHierarchicalStructure(users);
    }
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    setEditingUser(user);
    setUsername(user.username);
    
    if (userRole === 'collector') {
      setRole('listero');
      setSelectedCollector(currentUserId);
    } else if (userRole === 'listero') {
      setRole('client');
      setBalanceAmount(''); // No se usa en edición, solo en creación
    } else {
      setRole(user.role);
      setSelectedCollector(user.id_collector || '');
    }
    if (user.role === 'listero') {
      const raw = user.limite_especifico;
      if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
        setEnableSpecificLimits(userRole === 'collector' ? false : true);
        setLimitsValues(prev => {
          const draft = { ...prev };
          
          // Detectar formato: nuevo (por lotería) o antiguo (global)
          const isNewFormat = Object.values(raw).some(val => 
            typeof val === 'object' && val !== null && !Array.isArray(val)
          );
          
          if (isNewFormat) {
            // Formato nuevo: {lotteryId: {playType: value}}
            Object.entries(raw).forEach(([lotteryId, lotteryLimits]) => {
              if (typeof lotteryLimits === 'object' && lotteryLimits !== null) {
                draft[lotteryId] = {};
                Object.entries(lotteryLimits).forEach(([playType, value]) => {
                  draft[lotteryId][playType] = value?.toString?.() || `${value}`;
                });
              }
            });
          } else {
            // Formato antiguo: {playType: value} - migrar a primera lotería disponible
            if (availableLotteries.length > 0) {
              const firstLotteryId = availableLotteries[0].id;
              draft[firstLotteryId] = {};
              Object.entries(raw).forEach(([playType, value]) => {
                draft[firstLotteryId][playType] = value?.toString?.() || `${value}`;
              });
            }
          }
          
          return draft;
        });
      } else {
        setEnableSpecificLimits(false);
      }
      if (userRole === 'collector' || userRole === 'admin') {
        // Inicializar selecciones por lotería desde el id_precio (formato JSONB)
        const initialSelections = {};
        if (user.id_precio && typeof user.id_precio === 'object') {
          Object.keys(user.id_precio).forEach(key => {
            if (key.endsWith('_id')) {
              const cleanLotteryId = key.replace('_id', '');
              initialSelections[cleanLotteryId] = user.id_precio[key];
            }
          });
        }
        setSelectedLotteryGains(initialSelections);
      }
    } else {
      setEnableSpecificLimits(false);
    }
    setModalVisible(true);
  };

  // Abrir modal de cambio de contraseña (solo admin)
  const openResetPasswordModal = (user) => {
    if (userRole !== 'admin') return;
    setResetTargetUser(user);
    setResetPassword('');
    setResetPassword2('');
    setShowResetPassword(false);
    setShowResetPassword2(false);
    setResetModalVisible(true);
  };

  // Abrir modal de asignación de ganancia (colector y admin)
  const openGainModal = (user) => {
    if (userRole !== 'collector' && userRole !== 'admin') return;
    setGainTargetUser(user);
    
    // Inicializar selecciones por lotería desde el id_precio (formato JSONB)
    const initialSelections = {};
    if (user.id_precio && typeof user.id_precio === 'object') {
      // Formato nuevo: {loteria_id: ganancia_id, ...}
      Object.keys(user.id_precio).forEach(key => {
        if (key.endsWith('_id')) {
          const cleanLotteryId = key.replace('_id', '');
          initialSelections[cleanLotteryId] = user.id_precio[key];
        }
      });
    }
    setSelectedLotteryGains(initialSelections);
    setGainModalVisible(true);
  };

  // Abrir modal de ganancia para nuevo usuario
  const openGainModalForNewUser = () => {
    setGainTargetUser(null); // No hay usuario objetivo, es para creación
    // Las selecciones ya están en selectedLotteryGains
    setGainModalVisible(true);
  };

  // Manejar selección de ganancia para una lotería específica
  const handleLotteryGainSelection = (lotteryId, gainId) => {
    setSelectedLotteryGains(prev => {
      const newState = {
        ...prev,
        [lotteryId]: gainId || null
      };
      return newState;
    });
  };

  // Convertir selecciones de lotería-ganancia al formato JSONB
  const buildGainsData = () => {
    const gainsData = {};
    for (const [lotteryId, gainId] of Object.entries(selectedLotteryGains)) {
      if (gainId) {
        const lottery = availableLotteries.find(l => l.id === lotteryId);
        if (lottery) {
          gainsData[`${lotteryId}_id`] = gainId;
          gainsData[`${lotteryId}_nombre`] = lottery.nombre;
        }
      }
    }
    return Object.keys(gainsData).length > 0 ? gainsData : null;
  };

  // Confirmar cambio de contraseña usando método directo simplificado
  const handleConfirmResetPassword = async () => {
    try {
      if (!resetTargetUser) return;
      const pwd = (resetPassword || '').trim();
      const pwd2 = (resetPassword2 || '').trim();
      if (pwd.length < 6) {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (pwd !== pwd2) {
        Alert.alert('Error', 'Las contraseñas no coinciden.');
        return;
      }
      setIsResetting(true);
      
      // Usar función simplificada que cambia directamente en Supabase Auth
      const result = await adminResetPasswordByUsername(resetTargetUser.username, pwd);
      
      Alert.alert(
        'Contraseña Actualizada', 
        `Se ha cambiado exitosamente la contraseña para ${resetTargetUser.username}.\n\nEl usuario puede usar la nueva contraseña inmediatamente.`
      );
      setResetModalVisible(false);
    } catch (e) {
      console.error('Reset password error:', e);
      let errorMessage = 'No se pudo cambiar la contraseña.';
      
      if (e.message) {
        errorMessage = e.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsResetting(false);
      setResetPassword('');
      setResetPassword2('');
      setShowResetPassword(false);
      setShowResetPassword2(false);
    }
  };

  // Función para asignar ganancia a listero
  const handleAssignGain = async () => {
    // Si no hay usuario objetivo, solo cerrar el modal (es para nuevo usuario)
    if (!gainTargetUser) {
      setGainModalVisible(false);
      return;
    }

    try {
      // Construir el objeto JSONB con el formato: {loteria_id: ganancia_id, loteria_nombre: nombre}
      const gainsData = {};
      
      for (const [lotteryId, gainId] of Object.entries(selectedLotteryGains)) {
        if (gainId) {
          const lottery = availableLotteries.find(l => l.id === lotteryId);
          if (lottery) {
            gainsData[`${lotteryId}_id`] = gainId;
            gainsData[`${lotteryId}_nombre`] = lottery.nombre;
          }
        }
      }

      // Si no hay ganancias, establecer como null para quitar todas las ganancias
      const finalGainsData = Object.keys(gainsData).length > 0 ? gainsData : null;

      const { data, error } = await supabase
        .from('profiles')
        .update({ id_precio: finalGainsData })
        .eq('id', gainTargetUser.id)
        .select('id_precio');

      if (error) {
        throw error;
      }

      const message = finalGainsData ? 'Ganancias asignadas correctamente' : 'Ganancias removidas correctamente';
      Alert.alert('Éxito', message);
      setGainModalVisible(false);
      setSelectedLotteryGains({});
      fetchUsers();
    } catch (error) {
      console.error('Error asignando ganancias:', error);
      Alert.alert('Error', 'No se pudieron asignar las ganancias');
    }
  };

  // Optimizar filtros con useMemo
  const collectors = useMemo(() => 
    users.filter(u => u.role === 'collector'), 
    [users]
  );

  const clearForm = () => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setRole('');
    setSelectedCollector('');
    setSelectedLotteryGains({});
    setSelectedGainDetail(null);
    setIsEditing(false);
    setEditingUser(null);
    setEnableSpecificLimits(false);
    setBalanceAmount('');
  };

  // Función para obtener el texto de las ganancias seleccionadas
  const getSelectedGainsText = (useValidOnly = false) => {
    const hasAnySelection = Object.values(selectedLotteryGains).some(gainId => gainId);
    if (!hasAnySelection) {
      return 'Seleccionar Ganancias por Lotería';
    }

    const selectedItems = [];
    const invalidItems = [];
    
    // Usar validGainOptions para el modal, gainOptions para resolución de nombres históricos
    const optionsToUse = useValidOnly ? validGainOptions : gainOptions;
    
    for (const [lotteryId, gainId] of Object.entries(selectedLotteryGains)) {
      if (gainId) {
        const lottery = availableLotteries.find(l => l.id === lotteryId);
        const gain = optionsToUse.find(g => g.id === gainId && g.id_loteria === lotteryId);
        
        if (lottery && gain) {
          // Para el modal (useValidOnly=true), las ganancias ya están filtradas como válidas
          // Para la lista (useValidOnly=false), verificar validez específica por lotería
          if (useValidOnly) {
            selectedItems.push(`${lottery.nombre}: ${gain.nombre}`);
          } else {
            // Para la lista, simplemente mostrar la ganancia sin validación en tiempo real
            // La validación se hace al momento de asignar/guardar
            selectedItems.push(`${lottery.nombre}: ${gain.nombre}`);
          }
        } else if (lottery) {
          invalidItems.push(`${lottery.nombre}: Ganancia inválida`);
        }
      }
    }

    const allItems = [...selectedItems, ...invalidItems];

    if (allItems.length === 0) return 'Seleccionar Ganancias por Lotería';
    if (allItems.length === 1) return allItems[0];
    if (allItems.length <= 2) return allItems.join(', ');
    return `${allItems.length} loterías configuradas`;
  };

  const renderUserItem = ({ item }) => {
    const isAdmin = item.type === 'user' && item.role === 'admin';
    const isCollector = item.type === 'collector';
    const isListero = item.type === 'listero';
    const isExpanded = expandedCollectors.has(item.id);
    const isUpdating = updatingUsers.has(item.id);
    const parentCollectorInactive = isListero && item.id_collector ? (users.find(u => u.id === item.id_collector)?.activo === false) : false;
    const canToggleActive = userRole !== 'collector' || (userRole === 'collector' && isListero && item.id_collector === currentUserId);
    
    // No renderizar administradores
    if (isAdmin || item.role === 'admin') {
      return null;
    }
    
    // Collector card
    if (isCollector) {
      return (
        <View style={[styles.userCard, styles.collectorCard, { backgroundColor: '#fff' }]}>
          <TouchableOpacity 
            style={styles.collectorHeader}
            onPress={() => toggleCollectorExpansion(item.id)}
          >
            <View style={styles.userNameContainer}>
              <Text 
                style={[styles.username, { color: '#2c3e50' }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                📊 {item.username}
              </Text>
              <Text style={[styles.userRole, { color: '#3498db' }]}>
                Colector • {item.activo ? 'Habilitado' : 'Deshabilitado'}
              </Text>
            </View>
            <Text style={[styles.expandIcon, { color: '#7f8c8d' }]}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {userRole === 'admin' && (
            <View style={styles.buttonRow}>
              <View style={styles.toggleContainer}>
                <Switch
                  style={styles.toggleSwitch}
                  value={item.activo}
                  onValueChange={() => handleToggleActive(item.id, item.activo)}
                  trackColor={{ false: '#e74c3c', true: '#27ae60' }}
                  thumbColor={item.activo ? '#fff' : '#fff'}
                />
                <Text style={styles.toggleLabel}>
                  {item.activo ? 'ON' : 'OFF'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => openResetPasswordModal(item)}
              >
                <Text style={styles.buttonText}>Contraseña</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    
    // Listero card
    if (isListero) {
      const isOrphan = item.level === 0; // Listero sin colector asignado
      
      return (
        <View style={[
          styles.userCard,
          isOrphan ? styles.orphanListeroCard : styles.listeroCard,
          { backgroundColor: isOrphan ? '#e9ecef' : '#f8f9fa' }
        ]}>
          <View style={styles.userNameContainer}>
            <Text 
              style={[styles.listeroName, { color: '#2c3e50' }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {isOrphan ? '🔗' : '└── 📝'} {item.username}
            </Text>
            <Text style={[styles.userRole, { color: isOrphan ? '#f39c12' : '#6c757d' }]}>
              Listero • {item.activo ? 'Habilitado' : 'Deshabilitado'}
            </Text>
            
            {/* Información adicional del listero */}
            <Text style={[styles.userDetails, { color: '#7f8c8d' }]}>
              {(() => {
                const gainsData = item.id_precio;
                if (!gainsData || typeof gainsData !== 'object') return '💰 Sin ganancias configuradas';
                
                const lotteryGainPairs = [];
                
                // Obtener todos los IDs de lotería únicos
                const lotteryIds = new Set();
                Object.keys(gainsData).forEach(key => {
                  if (key.endsWith('_id')) {
                    const lotteryId = key.replace('_id', '');
                    lotteryIds.add(lotteryId);
                  }
                });
                
                // Para cada lotería, obtener su nombre y el nombre de la ganancia
                lotteryIds.forEach(lotteryId => {
                  const lotteryName = gainsData[`${lotteryId}_nombre`];
                  const gainId = gainsData[`${lotteryId}_id`];
                  
                  if (lotteryName && gainId) {
                    // Buscar el nombre de la ganancia en gainOptions, filtrando por lotería específica
                    const gain = gainOptions.find(g => g.id === gainId && g.id_loteria === lotteryId);
                    let gainName;
                    
                    if (gain) {
                      gainName = gain.nombre;
                    } else {
                      // Si no se encuentra con lotería específica, intentar solo por ID como fallback
                      const fallbackGain = gainOptions.find(g => g.id === gainId);
                      gainName = fallbackGain ? fallbackGain.nombre : 'Ganancia no encontrada';
                    }
                    
                    lotteryGainPairs.push(`${lotteryName}: ${gainName}`);
                  }
                });
                
                if (lotteryGainPairs.length === 0) return '💰 Sin ganancias configuradas';
                if (lotteryGainPairs.length === 1) return `💰 ${lotteryGainPairs[0]}`;
                if (lotteryGainPairs.length <= 3) return `💰 ${lotteryGainPairs.join(' | ')}`;
                return `💰 ${lotteryGainPairs.length} ganancias configuradas`;
              })()}
            </Text>
            
            <Text style={[styles.userDetails, { color: '#7f8c8d' }]}>
              {(() => {
                const raw = item.limite_especifico;
                if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) return '🛑 Sin límites específicos';
                
                // Detectar formato: nuevo (por lotería) o antiguo (global)
                const isNewFormat = Object.values(raw).some(val => 
                  typeof val === 'object' && val !== null && !Array.isArray(val)
                );
                
                if (isNewFormat) {
                  // Formato nuevo: {lotteryId: {playType: value}}
                  const lotteryLimitPairs = [];
                  
                  Object.entries(raw).forEach(([lotteryId, lotteryLimits]) => {
                    if (typeof lotteryLimits === 'object' && lotteryLimits !== null) {
                      // Obtener nombre de la lotería
                      const lottery = availableLotteries.find(l => l.id === lotteryId);
                      const lotteryName = lottery ? lottery.nombre : `Lotería ${lotteryId}`;
                      
                      // Filtrar solo jugadas activas y ordenar
                      let entries = Object.entries(lotteryLimits).filter(([k]) => activePlayTypes.includes(k));
                      entries.sort((a,b) => {
                        const ia = JUGADA_ORDER.indexOf(a[0]);
                        const ib = JUGADA_ORDER.indexOf(b[0]);
                        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                      });
                      
                      if (entries.length > 0) {
                        const limitsText = entries.map(([k,v]) => `${k}: ${v}`).join(', ');
                        lotteryLimitPairs.push(`${lotteryName}: ${limitsText}`);
                      }
                    }
                  });
                  
                  if (lotteryLimitPairs.length === 0) return '🛑 Sin límites específicos';
                  if (lotteryLimitPairs.length === 1) return `🔒 ${lotteryLimitPairs[0]}`;
                  if (lotteryLimitPairs.length <= 3) return `🔒 ${lotteryLimitPairs.join(' | ')}`;
                  return `🔒 ${lotteryLimitPairs.length} loterías con límites`;
                } else {
                  // Formato antiguo: {playType: value} - mostrar como antes
                  let entries = Object.entries(raw).filter(([k]) => activePlayTypes.includes(k));
                  entries.sort((a,b) => {
                    const ia = JUGADA_ORDER.indexOf(a[0]);
                    const ib = JUGADA_ORDER.indexOf(b[0]);
                    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                  });
                  if (entries.length === 0) return '🛑 Sin límites específicos';
                  return '🔒 ' + entries.map(([k,v]) => `${k}: ${v}`).join(', ');
                }
              })()}
            </Text>
          </View>
          
          {canToggleActive && (
            <View style={styles.buttonRow}>
              <View style={styles.toggleContainer}>
                <Switch
                  style={styles.toggleSwitch}
                  value={item.activo}
                  onValueChange={() => handleToggleActive(item.id, item.activo)}
                  trackColor={{ false: '#e74c3c', true: '#27ae60' }}
                  thumbColor={item.activo ? '#fff' : '#fff'}
                />
                <Text style={styles.toggleLabel}>
                  {item.activo ? 'ON' : 'OFF'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              
              {(userRole === 'collector' || userRole === 'admin') && (
                <TouchableOpacity
                  style={styles.gainButton}
                  onPress={() => openGainModal(item)}
                >
                  <Text style={styles.buttonText}>Ganancia</Text>
                </TouchableOpacity>
              )}
              
              {userRole === 'admin' && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => openResetPasswordModal(item)}
                >
                  <Text style={styles.buttonText}>Contraseña</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    
    // Client card (para listeros)
    const isClient = item.type === 'client' || item.role === 'client';
    if (isClient) {
      return (
        <View style={[styles.userCard, styles.clientCard, { backgroundColor: '#f0f8ff' }]}>
          <View style={styles.userNameContainer}>
            <Text 
              style={[styles.username, { color: '#2c3e50' }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              👤 {item.username}
            </Text>
            <Text style={[styles.userRole, { color: '#5dade2' }]}>
              Cliente • {item.activo ? 'Habilitado' : 'Deshabilitado'}
            </Text>
            
            {/* Balance del cliente */}
            <Text style={[styles.userDetails, { color: '#27ae60', fontWeight: 'bold', fontSize: 14 }]}>
              💰 Balance: ${parseFloat(item.balance || 0).toFixed(2)}
            </Text>
          </View>
          
          {userRole === 'listero' && (
            <View style={styles.buttonRow}>
              <View style={styles.toggleContainer}>
                <Switch
                  style={styles.toggleSwitch}
                  value={item.activo}
                  onValueChange={() => handleToggleActive(item.id, item.activo)}
                  trackColor={{ false: '#e74c3c', true: '#27ae60' }}
                  thumbColor={item.activo ? '#fff' : '#fff'}
                />
                <Text style={styles.toggleLabel}>
                  {item.activo ? 'ON' : 'OFF'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.rechargeButton}
                onPress={() => openBalanceModal(item)}
              >
                <Text style={styles.buttonText}>Recargar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>
          {userRole === 'listero' ? 'Clientes' : 'Usuarios'}
        </Text>
      </View>

      <View style={styles.content}>
  <CustomButton 
    title={userRole === 'collector' ? 'Crear Listero' : (userRole === 'listero' ? 'Crear Cliente' : 'Crear Usuario')} 
    onPress={() => { 
      clearForm(); 
      if (userRole==='collector'){ 
        setRole('listero'); 
        setSelectedCollector(currentUserId);
      } else if (userRole === 'listero') {
        setRole('client');
      }
      setModalVisible(true); 
    }} 
  />

        {userRole === 'collector' && hierarchicalUsers.length === 0 && (
          <Text style={styles.emptyListText}>No tienes listeros asignados todavía.</Text>
        )}
        
        {userRole === 'listero' && hierarchicalUsers.length === 0 && (
          <Text style={styles.emptyListText}>No tienes clientes todavía.</Text>
        )}
        
        {/* Mostrar usuarios según rol */}
        <FlatList
          data={hierarchicalUsers}
          keyExtractor={(item) => `${item.id}-${item.type}`}
          renderItem={renderUserItem}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />

        <Modal visible={modalVisible} animationType="slide">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isEditing 
                ? (userRole==='collector' ? 'Editar Listero' : (userRole === 'listero' ? 'Editar Cliente' : 'Editar Usuario'))
                : (userRole==='collector' ? 'Crear Listero' : (userRole === 'listero' ? 'Crear Cliente' : 'Crear Usuario'))
              }
            </Text>

            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <TextInput
                placeholder="Nombre de usuario"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                placeholderTextColor="#95a5a6"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {!isEditing && (
                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Contraseña"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    style={styles.passwordInput}
                    placeholderTextColor="#95a5a6"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggleButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Campo de balance inicial para clientes (listero creando cliente) */}
              {userRole === 'listero' && !isEditing && (
                <TextInput
                  placeholder="Balance inicial (ej: 100.00)"
                  keyboardType="decimal-pad"
                  value={balanceAmount}
                  onChangeText={setBalanceAmount}
                  style={styles.input}
                  placeholderTextColor="#95a5a6"
                />
              )}

              {userRole !== 'collector' && userRole !== 'listero' && (
                <>
                  <DropdownPicker
                    label="Rol"
                    value={role ? (role === 'collector' ? 'Colector' : 'Listero') : ''}
                    onSelect={(item) => setRole(item.value)}
                    options={[
                      { label: 'Colector', value: 'collector' },
                      { label: 'Listero', value: 'listero' }
                    ]}
                    placeholder="Selecciona un rol"
                    style={{ marginBottom: 15 }}
                  />
                </>
              )}

              {role === 'listero' && userRole !== 'collector' && (
                <>
                  <DropdownPicker
                    label="Seleccionar colector"
                    value={selectedCollector ? collectors.find(col => col.id === selectedCollector)?.username || '' : ''}
                    onSelect={(item) => setSelectedCollector(item.value)}
                    options={collectors.map(col => ({ label: col.username, value: col.id }))}
                    placeholder="Selecciona un colector"
                    style={{ marginBottom: 15 }}
                  />

                  {/* Botón para seleccionar ganancias por lotería */}
                  <TouchableOpacity
                    style={[styles.gainSelectionButton, { backgroundColor: '#3498db' }]}
                    onPress={openGainModalForNewUser}
                  >
                    <Text style={[styles.gainSelectionButtonText, { color: '#fff' }]}>
                      {getSelectedGainsText(true)}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.limitsToggleRow}>
                    <Text style={styles.limitsToggleLabel}>Límites específicos</Text>
                    <Switch value={enableSpecificLimits} onValueChange={setEnableSpecificLimits} />
                  </View>
                  {enableSpecificLimits && (
                    <View style={styles.limitsContainer}>
                      {availableLotteries.length === 0 && (
                        <Text style={styles.limitsHint}>No hay loterías disponibles.</Text>
                      )}
                      {activePlayTypes.length === 0 && (
                        <Text style={styles.limitsHint}>No hay jugadas activas.</Text>
                      )}
                      {availableLotteries.map(lottery => {
                        const lotteryPlayTypes = lotteryActivePlayTypes[lottery.id] || [];
                        return (
                          <View key={lottery.id} style={styles.lotteryLimitsSection}>
                            <Text style={styles.lotteryLimitsTitle}>{lottery.nombre}</Text>
                            {lotteryPlayTypes.length === 0 && (
                              <Text style={styles.limitsHint}>No hay jugadas activas para esta lotería.</Text>
                            )}
                            {lotteryPlayTypes.map(playType => (
                              <View key={`${lottery.id}-${playType}`} style={styles.limitInputRow}>
                                <Text style={styles.limitPlayType}>{playType}</Text>
                                <TextInput
                                  placeholder="Límite"
                                  keyboardType="numeric"
                                  value={limitsValues[lottery.id]?.[playType] || ''}
                                  onChangeText={val => setLimitsValues(prev => ({
                                    ...prev,
                                    [lottery.id]: {
                                      ...(prev[lottery.id] || {}),
                                      [playType]: val.replace(/[^0-9]/g,'')
                                    }
                                  }))}
                                  style={styles.limitInput}
                                />
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Botón de ganancias para colector cuando crea listero */}
              {userRole === 'collector' && (
                <TouchableOpacity
                  style={[styles.gainSelectionButton, { backgroundColor: '#3498db', marginBottom: 15 }]}
                  onPress={openGainModalForNewUser}
                >
                  <Text style={[styles.gainSelectionButtonText, { color: '#fff' }]}>
                    {getSelectedGainsText(true)}
                  </Text>
                </TouchableOpacity>
              )}

              <CustomButton 
                title={isEditing 
                  ? 'Guardar Cambios' 
                  : (userRole==='collector' ? 'Crear Listero' : (userRole === 'listero' ? 'Crear Cliente' : 'Crear Usuario'))
                } 
                onPress={handleCreateOrUpdate} 
              />
              <CustomButton title="Cancelar" color="#666" onPress={() => setModalVisible(false)} />
            </ScrollView>
          </View>
        </Modal>

        {/* Modal para cambiar contraseña (solo admin) */}
        <Modal visible={resetModalVisible} animationType="fade">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={{ marginBottom: 8 }}>Usuario: {resetTargetUser?.username}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Nueva contraseña"
                  secureTextEntry={!showResetPassword}
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  style={styles.passwordInput}
                  placeholderTextColor="#95a5a6"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggleButton}
                  onPress={() => setShowResetPassword(!showResetPassword)}
                >
                  <Text style={styles.passwordToggleText}>
                    {showResetPassword ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Confirmar contraseña"
                  secureTextEntry={!showResetPassword2}
                  value={resetPassword2}
                  onChangeText={setResetPassword2}
                  style={styles.passwordInput}
                  placeholderTextColor="#95a5a6"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggleButton}
                  onPress={() => setShowResetPassword2(!showResetPassword2)}
                >
                  <Text style={styles.passwordToggleText}>
                    {showResetPassword2 ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>
              <CustomButton title={isResetting ? 'Actualizando…' : 'Actualizar'} disabled={isResetting} onPress={handleConfirmResetPassword} />
              <CustomButton title="Cancelar" color="#666" onPress={() => {
                setResetModalVisible(false);
                setShowResetPassword(false);
                setShowResetPassword2(false);
              }} />
            </ScrollView>
          </View>
        </Modal>

        {/* Modal para asignar ganancia (solo colector) */}
        <Modal visible={gainModalVisible} animationType="fade">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Asignar Ganancias por Lotería</Text>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={{ marginBottom: 16, fontWeight: '600' }}>Usuario: {gainTargetUser?.username}</Text>
              
              {availableLotteries.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                  No hay loterías disponibles
                </Text>
              ) : (
                availableLotteries.map(lottery => (
                  <View key={lottery.id} style={{ marginBottom: 20 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 8, fontSize: 16 }}>
                      {lottery.nombre}
                    </Text>
                    <DropdownPicker
                      label="Seleccionar Ganancia"
                      value={(() => {
                        const gainId = selectedLotteryGains[lottery.id];
                        if (!gainId) return "";
                        const selectedGain = validGainOptions.find(g => g.id === gainId && g.id_loteria === lottery.id);
                        return selectedGain ? selectedGain.nombre : "";
                      })()}
                      onSelect={(selectedItem) => {
                        const gainId = selectedItem.value;
                        handleLotteryGainSelection(lottery.id, gainId === "" ? null : gainId);
                      }}
                      options={[
                        { id: "none", label: 'Sin ganancia', value: "" },
                        ...validGainOptions
                          .filter(gain => gain.id_loteria === lottery.id)
                          .map(gain => ({
                            id: gain.id,
                            label: gain.nombre,
                            value: gain.id
                          }))
                      ]}
                      placeholder="Selecciona una ganancia..."
                    />
                  </View>
                ))
              )}
              
              <View style={{ marginTop: 20 }}>
                <CustomButton 
                  title={gainTargetUser ? "Asignar Ganancias" : "Confirmar Selección"} 
                  onPress={handleAssignGain} 
                />
                <CustomButton 
                  title="Cancelar" 
                  color="#666" 
                  onPress={() => {
                    setGainModalVisible(false);
                    setSelectedLotteryGains({});
                  }} 
                />
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal para recargar balance (solo listero) */}
        <Modal visible={balanceModalVisible} animationType="fade">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Recargar Balance</Text>
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={{ marginBottom: 8, fontSize: 16 }}>Cliente: {balanceTargetClient?.username}</Text>
              <Text style={{ marginBottom: 16, fontSize: 14, color: '#27ae60', fontWeight: 'bold' }}>
                Balance actual: ${parseFloat(balanceTargetClient?.balance || 0).toFixed(2)}
              </Text>
              
              <TextInput
                placeholder="Cantidad a recargar (ej: 50.00)"
                keyboardType="decimal-pad"
                value={balanceAmount}
                onChangeText={setBalanceAmount}
                style={styles.input}
                placeholderTextColor="#95a5a6"
              />
              
              <CustomButton 
                title={isAddingBalance ? 'Recargando...' : 'Recargar Balance'} 
                disabled={isAddingBalance}
                onPress={handleRechargeBalance} 
              />
              <CustomButton 
                title="Cancelar" 
                color="#666" 
                onPress={() => {
                  setBalanceModalVisible(false);
                  setBalanceAmount('');
                }} 
              />
            </ScrollView>
          </View>
        </Modal>
      </View>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

export default CreateUserScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  customHeader: {
    height: 70,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 2,
      elevation: 4,
    }),
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sidebarButton: {
    marginRight: 16,
    marginLeft: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: 110,
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#2C3E50',
    ...Platform.select({
      android: {
        textAlignVertical: 'center',
        includeFontPadding: false,
      },
    }),
  },
  userItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 2,
  },
  listeroItem: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#3498db',
    backgroundColor: '#f8f9fa',
  },
  listeroConnector: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  listeroInfo: {
    paddingLeft: 10,
  },
  expandButton: {
    marginRight: 8,
    padding: 4,
  },
  expandIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  userText: { 
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  userTextInactive: {
    color: '#95a5a6',
    textDecorationLine: 'line-through',
  },
  collectorText: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  listeroText: {
    color: '#7f8c8d',
    fontWeight: '400',
  },
  userStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusActive: {
    color: '#27ae60',
  },
  statusInactive: {
    color: '#e74c3c',
  },
  userGanancia: {
    fontSize: 12,
    marginTop: 2,
    color: '#f39c12',
    fontWeight: '600',
  },
  userLimits: {
    fontSize: 11,
    marginTop: 2,
    color: '#8e44ad',
    fontWeight: '600',
  },
  userControls: {
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  blockedContainer: {
    backgroundColor: '#fff5f5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  blockedBadge: {
    color: '#e03131',
    fontSize: 11,
    fontWeight: '600',
  },
  switchLabel: {
    fontSize: 12,
    marginRight: 8,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  buttonRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f39c12',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#9b59b6',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gainButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#27ae60',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rechargeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#3498db',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  toggleContainer: {
    alignItems: 'center',
    marginRight: 8,
  },
  toggleSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  toggleLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  modalContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FDF5',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40, // Espacio extra para que los botones sean visibles
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  limitsToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  limitsToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  limitsContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    marginBottom: 15,
    backgroundColor: '#fafafa',
  },
  limitsHint: {
    fontSize: 12,
    color: '#7f8c8c',
    fontStyle: 'italic',
  },
  limitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  limitPlayType: {
    width: 70,
    fontSize: 13,
    fontWeight: '600',
    color: '#34495e',
  },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  lotteryLimitsSection: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  lotteryLimitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyListText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#7f8c8d',
    fontSize: 14,
    fontStyle: 'italic'
  },

  // Nuevos estilos para layout expandible mejorado
  userCard: {
    backgroundColor: '#fff',
    padding: Platform.OS === 'android' ? 16 : 15,
    marginBottom: 10,
    marginHorizontal: Platform.OS === 'android' ? 2 : 0,
    borderRadius: 12,
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  collectorCard: {
    backgroundColor: '#fff',
    marginBottom: 10,
    marginHorizontal: Platform.OS === 'android' ? 2 : 0,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  collectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'android' ? 16 : 15,
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  listeroCard: {
    backgroundColor: '#f8f9fa',
    marginLeft: 20,
    marginRight: 5,
    marginBottom: 5,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  listeroName: {
    fontSize: Platform.OS === 'android' ? 16 : 16,
    fontWeight: '600',
    lineHeight: Platform.OS === 'android' ? 22 : 24,
    marginBottom: 2,
  },
  listeroActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },
  smallActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  smallActionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  orphanListeroCard: {
    backgroundColor: '#e9ecef',
    padding: Platform.OS === 'android' ? 16 : 15,
    marginBottom: 10,
    marginHorizontal: Platform.OS === 'android' ? 2 : 0,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  clientCard: {
    backgroundColor: '#f0f8ff',
    padding: Platform.OS === 'android' ? 16 : 15,
    marginBottom: 10,
    marginHorizontal: Platform.OS === 'android' ? 2 : 0,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#5dade2',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  userNameContainer: {
    width: '100%',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: Platform.OS === 'android' ? 1.5 : 1,
    borderBottomColor: Platform.OS === 'android' ? '#e8e8e8' : '#f0f0f0',
  },
  username: {
    fontSize: Platform.OS === 'android' ? 18 : 18,
    fontWeight: 'bold',
    lineHeight: Platform.OS === 'android' ? 24 : 26,
    flexWrap: 'wrap',
    textAlign: 'left',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  userDetails: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  gainSelectionButton: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gainSelectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#2C3E50',
    ...Platform.select({
      android: {
        textAlignVertical: 'center',
        includeFontPadding: false,
      },
    }),
  },
  passwordToggleButton: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  passwordToggleText: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
  },
});

