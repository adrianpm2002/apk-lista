import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, Switch, Platform } from 'react-native';
import { Picker } from '../components/PickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { adminResetPasswordByUsername } from '../utils/adminUtils';

// Orden canónico unificado de jugadas en toda la app
const JUGADA_ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];

const CreateUserScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [users, setUsers] = useState([]);
  const [hierarchicalUsers, setHierarchicalUsers] = useState([]);
  const [expandedCollectors, setExpandedCollectors] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('');
  // Uso actualizado: se guarda id_precio (FK a tabla precio) en profiles; colector asigna configuración válida al listero
  // Ganancias disponibles (tabla precio) y selección (solo colector asigna a listeros)
  const [gainOptions, setGainOptions] = useState([]); // [{id,nombre,precios}]
  const [selectedGainId, setSelectedGainId] = useState(null); // id_precio seleccionado
  const [selectedGainDetail, setSelectedGainDetail] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [updatingUsers, setUpdatingUsers] = useState(new Set()); // Para tracking de actualizaciones
  const [activePlayTypes, setActivePlayTypes] = useState([]); // jugadas activas del banco
  const [enableSpecificLimits, setEnableSpecificLimits] = useState(false); // toggle crear listero
  const [limitsValues, setLimitsValues] = useState({}); // valores ingresados para limites específicos
  // Estado para reset de contraseña (solo admin)
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPassword2, setResetPassword2] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const createHierarchicalStructure = useCallback((userData) => {
    const hierarchical = [];
    const collectors = userData.filter(user => user.role === 'collector');
    const listeros = userData.filter(user => user.role === 'listero');
    const admins = userData.filter(user => user.role === 'admin');
    
    // Agregar admins primero
    admins.forEach(admin => {
      hierarchical.push({
        ...admin,
        type: 'user',
        level: 0
      });
    });
    
    // Agregar collectors con sus listeros
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
    if (userRole === 'collector' && !currentUserId) {
      console.log('[fetchUsers] Collector sin currentUserId aún, esperando...');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, id_banco, id_collector, activo, id_precio, limite_especifico')
      .eq('id_banco', currentBankId)
      .order('role', { ascending: false })
      .order('username');
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    if (userRole === 'collector') {
      console.log('[fetchUsers] Datos crudos banco:', data);
      const onlyListeros = (data || []).filter(u => (u.role === 'listero') && u.id_collector === currentUserId);
      console.log('[fetchUsers] currentUserId:', currentUserId, 'listeros filtrados:', onlyListeros.length);
      // Log de casos donde no se encontró nada
      if (onlyListeros.length === 0) {
        const withCollector = (data || []).filter(u => u.role === 'listero' && !!u.id_collector);
        console.log('[fetchUsers][diagnóstico] Total listeros con id_collector:', withCollector.length);
        const listingCollectorIds = [...new Set(withCollector.map(u => u.id_collector))];
        console.log('[fetchUsers][diagnóstico] id_collector distintos presentes:', listingCollectorIds);
      }
      setUsers(onlyListeros);
      setHierarchicalUsers(onlyListeros.map(u => ({ ...u, type: 'listero', level: 0 })));
      return;
    }
    setUsers(data || []);
    createHierarchicalStructure(data || []);
  }, [currentBankId, userRole, currentUserId, createHierarchicalStructure]);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();
        
        if (data) {
          if (data.role !== 'admin' && data.role !== 'collector') {
            Alert.alert('No Autorizado', 'Solo administradores o colectores autorizados');
            return;
          }
          
          setUserRole(data.role);
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          setCurrentBankId(bankId);
        } else if (error) {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
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
        console.error('Error cargando jugadas activas:', error);
        return;
      }
      const jugadas = data?.jugadas || { fijo:true, corrido:true, posicion:true, parle:true, centena:true, tripleta:true };
      const actives = Object.keys(jugadas).filter(k => jugadas[k]);
      // Ordenar según orden canónico
      actives.sort((a,b) => {
        const ia = JUGADA_ORDER.indexOf(a);
        const ib = JUGADA_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      setActivePlayTypes(actives);
      setLimitsValues(prev => {
        const draft = { ...prev };
        actives.forEach(j => { if (draft[j] === undefined) draft[j] = ''; });
        return draft;
      });
    } catch (e) {
      console.error('Excepción fetchActivePlayTypes:', e);
    }
  }, [currentBankId]);

  // Cargar configuraciones de precio válidas: exactamente mismas jugadas activas
  const fetchValidGains = useCallback(async () => {
    if (!currentBankId) return;
    try {
      const { data, error } = await supabase
        .from('precio')
        .select('id, nombre, precios, id_banco')
        .eq('id_banco', currentBankId);
      if (error) { console.error('Error precio:', error); return; }
      if (userRole === 'collector') {
        const actSet = new Set(activePlayTypes);
        const filtered = (data||[]).filter(cfg => {
          if (!cfg || !cfg.precios || typeof cfg.precios !== 'object') return false;
            const keys = Object.keys(cfg.precios);
            if (keys.length !== actSet.size) return false;
            for (const k of keys) {
              if (!actSet.has(k)) return false;
              const v = cfg.precios[k];
              if (!v || typeof v !== 'object') return false;
              const req = ['limited','regular','listeroPct','collectorPct'];
              for (const r of req) { if (!(r in v)) return false; }
            }
            for (const a of actSet) { if (!(a in cfg.precios)) return false; }
            return true;
        });
        setGainOptions(filtered);
        if (selectedGainId && !filtered.some(f => f.id === selectedGainId)) {
          setSelectedGainId(null);
          setSelectedGainDetail(null);
        }
      } else {
        // Admin: mostrar todas para poder resolver nombres incluso si no encajan exactamente con jugadas activas actuales
        setGainOptions(data || []);
      }
    } catch (e) {
      console.error('Excepción fetchValidGains:', e);
    }
  }, [userRole, currentBankId, activePlayTypes, selectedGainId]);

  useEffect(() => { fetchValidGains(); }, [fetchValidGains]);

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

  const handleCreateOrUpdate = async () => {
    try {
      // Forzar role listero si collector
      const effectiveRole = userRole === 'collector' ? 'listero' : role;

      if (!username || (!isEditing && !password) || !effectiveRole) {
        Alert.alert('Error', 'Todos los campos son obligatorios.');
        return;
      }

      if (username.includes('@')) {
        Alert.alert('Error', 'El nombre de usuario no debe contener "@".');
        return;
      }
      if (userRole !== 'collector' && effectiveRole === 'listero' && !selectedCollector) {
        Alert.alert('Error', 'Debes seleccionar un colector.');
        return;
      }
      if (userRole === 'collector' && effectiveRole === 'listero' && !selectedGainId) {
        // Validación no obligatoria (antes era obligatoria). Se permite continuar sin ganancia.
      }

      const fakeEmail = `${username.toLowerCase()}@example.com`;

  if (isEditing && editingUser) {
    let refreshedAfterEdit = false;
        // 1. Intentar RPC v2, luego RPC antigua, luego update directo
        let updateOk = false;
        let rpcTried = false;
        try {
          rpcTried = true;
          const { data: dataV2, error: errV2 } = await supabase.rpc('update_user_profile_and_auth_v2', {
            user_id: editingUser.id,
            new_username: username,
            new_role: effectiveRole,
            new_assigned_collector: userRole === 'collector' ? currentUserId : (selectedCollector || null),
            new_id_precio: (userRole === 'collector' && effectiveRole === 'listero') ? (selectedGainId || null) : (editingUser.id_precio || null),
            new_activo: editingUser.activo !== undefined ? editingUser.activo : true
          });
          if (errV2) {
            console.warn('RPC v2 fallo, intentando versión legacy:', errV2);
          } else if (dataV2 && typeof dataV2 === 'object' && dataV2.success) {
            updateOk = true;
          } else if (dataV2 && dataV2.success === false) {
            console.warn('RPC v2 devolvió success=false, intentando legacy. Detalle:', dataV2.error);
          }
          if (!updateOk) {
            const { data: dataLegacy, error: errLegacy } = await supabase.rpc('update_user_profile_and_auth', {
              user_id: editingUser.id,
              new_username: username,
              new_role: effectiveRole,
              new_assigned_collector: userRole === 'collector' ? currentUserId : (selectedCollector || null),
              new_id_precio: (userRole === 'collector' && effectiveRole === 'listero') ? (selectedGainId || null) : (editingUser.id_precio || null),
              new_activo: editingUser.activo !== undefined ? editingUser.activo : true
            });
            if (errLegacy) {
              console.warn('RPC legacy fallo, usando update directo:', errLegacy);
            } else if (dataLegacy && typeof dataLegacy === 'object' && dataLegacy.success) {
              updateOk = true;
            }
          }
        } catch (rpcEx) {
          console.warn('Excepción llamando RPC(s), se usará update directo:', rpcEx);
        }
        if (!updateOk) {
          // Fallback update directo
          try {
            const directUpdate = {
              username,
              role: effectiveRole,
              id_collector: userRole === 'collector' ? currentUserId : (selectedCollector || null),
              id_precio: (userRole === 'collector' && effectiveRole === 'listero') ? (selectedGainId || null) : (editingUser.id_precio || null),
              activo: editingUser.activo !== undefined ? editingUser.activo : true
            };
            const { error: upErrFallback } = await supabase
              .from('profiles')
              .update(directUpdate)
              .eq('id', editingUser.id);
            if (upErrFallback) {
              console.error('Fallback update error:', upErrFallback);
              return Alert.alert('Error al actualizar', `Fallo actualización: ${upErrFallback.message}`);
            }
            updateOk = true;
          } catch (fb) {
            console.error('Excepción fallback:', fb);
            return Alert.alert('Error al actualizar', fb.message || 'Fallo general');
          }
        }
        // 2. Aplicar límites específicos si corresponde (independiente de método usado)
        if (updateOk && effectiveRole === 'listero' && userRole !== 'collector') {
          try {
            if (enableSpecificLimits) {
              const limitsObj = {};
              activePlayTypes.forEach(pt => {
                const val = limitsValues[pt];
                if (val && !isNaN(val)) {
                  const num = parseInt(val, 10);
                  if (num > 0) limitsObj[pt] = num;
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
        if (updateOk) {
          // Refresh inmediato para reflejar limite_especifico actualizado antes de cerrar modal
          try {
            await fetchUsers();
            refreshedAfterEdit = true;
          } catch {}
          Alert.alert('Éxito', 'Usuario actualizado correctamente');
        } else if (rpcTried) {
          Alert.alert('Error', 'No se pudo actualizar el usuario (RPC y fallback fallidos)');
          return;
        }
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
          if (effectiveRole === 'collector') {
            id_collector = null;
          } else if (effectiveRole === 'listero') {
            id_collector = userRole === 'collector' ? currentUserId : selectedCollector;
          }

          const insertData = {
             id: newUserId,
             username,
             role: effectiveRole,
             id_banco,
             id_collector,
             id_precio: (userRole === 'collector' && effectiveRole === 'listero') ? (selectedGainId || null) : null,
           }; // sin ganancia

          if (effectiveRole === 'listero' && enableSpecificLimits && userRole !== 'collector') {
            const limitsObj = {};
            activePlayTypes.forEach(pt => {
              const val = limitsValues[pt];
              if (val && !isNaN(val)) {
                const num = parseInt(val, 10);
                if (num > 0) limitsObj[pt] = num;
              }
            });
            if (Object.keys(limitsObj).length > 0) {
              insertData.limite_especifico = limitsObj; // JSONB
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

    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar definitivamente este usuario?')) {
        executeDeletion();
      }
    } else {
      Alert.alert(
        'Eliminar Usuario',
        '¿Eliminar definitivamente este usuario?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: executeDeletion }
        ]
      );
    }
  }, [users, fetchUsers, createHierarchicalStructure]);

  const handleToggleActive = async (userId, currentStatus) => {
    // Permitir a collector solo sobre sus listeros
    if (userRole === 'collector') {
      const target = users.find(u => u.id === userId);
      if (!target || target.role !== 'listero' || target.id_collector !== currentUserId) {
        Alert.alert('Acción no permitida', 'Solo puedes cambiar estado de tus listeros.');
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

    console.log(`handleToggleActive -> userId: ${userId} (${targetUser.role}) -> ${currentStatus} => ${newStatus}`);

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
        console.log(`Colector y ${affectedIds.length - 1} listeros ${action}ados`);
      } else {
        // Actualización simple para listero / admin
        const { error: singleError } = await supabase
          .from('profiles')
          .update({ activo: newStatus })
          .eq('id', userId);
        if (singleError) throw singleError;
        console.log(`Usuario ${action}ado`);
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
          Object.entries(raw).forEach(([k,v]) => { draft[k] = v?.toString?.() || `${v}`; });
          return draft;
        });
      } else {
        setEnableSpecificLimits(false);
      }
      if (userRole === 'collector') {
        const gid = user.id_precio || null;
        setSelectedGainId(gid);
        const detail = gainOptions.find(go => go.id === gid);
        setSelectedGainDetail(detail ? detail.precios : null);
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
    setResetModalVisible(true);
  };

  // Confirmar cambio de contraseña llamando a la Edge Function
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
      
      await adminResetPasswordByUsername(resetTargetUser.username, pwd);
      
      Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
      setResetModalVisible(false);
    } catch (e) {
      console.error('Reset password error:', e);
      let errorMessage = 'No se pudo cambiar la contraseña.';
      
      if (e.message?.includes('CORS') || e.message?.includes('Failed to fetch')) {
        errorMessage = 'Error de configuración del servidor. La función no está disponible.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsResetting(false);
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
    setRole('');
    setSelectedCollector('');
    setSelectedGainId(null);
    setSelectedGainDetail(null);
    setIsEditing(false);
    setEditingUser(null);
    setEnableSpecificLimits(false);
  };

  const renderUserItem = ({ item }) => {
    const isCollector = item.type === 'collector';
    const isListero = item.type === 'listero';
    const isExpanded = expandedCollectors.has(item.id);
    const isUpdating = updatingUsers.has(item.id);
  const parentCollectorInactive = isListero && item.id_collector ? (users.find(u => u.id === item.id_collector)?.activo === false) : false;
  const canToggleActive = userRole !== 'collector' || (userRole === 'collector' && isListero && item.id_collector === currentUserId);
    
    return (
      <View style={[
        styles.userItem,
        isListero && styles.listeroItem
      ]}>
        {isListero && (
          <Text style={styles.listeroConnector}>└─</Text>
        )}
        
        {isCollector && item.hasListeros && (
          <TouchableOpacity 
            onPress={() => toggleCollectorExpansion(item.id)}
            style={styles.expandButton}
          >
            <Text style={styles.expandIcon}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
        )}
        
        <View style={[styles.userInfo, isListero && styles.listeroInfo]}>
          <Text style={[
            styles.userText, 
            !item.activo && styles.userTextInactive,
            isCollector && styles.collectorText,
            isListero && styles.listeroText
          ]}>
            {isCollector && '👑 '}
            {isListero && `   `}
            {item.username} - {item.role === 'collector' ? 'colector' : item.role}
          </Text>
          
          <Text style={[
            styles.userStatus,
            item.activo ? styles.statusActive : styles.statusInactive
          ]}>
            {item.activo ? '● Activo' : '● Inactivo'}
            {isUpdating && ' (Actualizando...)'}
          </Text>
          
          {isListero && (
            <>
              <Text style={styles.userGanancia}>
                {(() => {
                  const gid = item.id_precio;
                  if (!gid) return '💰 Ganancia: no seleccionada';
                  const cfg = gainOptions.find(o => o.id === gid);
                  if (!cfg) return '💰 Ganancia: (inválida)';
                  return `💰 Ganancia: ${cfg.nombre}`;
                })()}
              </Text>
              <Text style={styles.userLimits}>
                {(() => {
                  const raw = item.limite_especifico;
                  if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) return '🛑 Limite: No';
                  let entries = Object.entries(raw).filter(([k]) => activePlayTypes.includes(k));
                  // Ordenar las entradas según orden canónico para visualización consistente
                  entries.sort((a,b) => {
                    const ia = JUGADA_ORDER.indexOf(a[0]);
                    const ib = JUGADA_ORDER.indexOf(b[0]);
                    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                  });
                  if (entries.length === 0) return '🛑 Limite: No';
                  return '🔒 Limite: ' + entries.map(([k,v]) => `${k} ${v}`).join(', ');
                })()}
              </Text>
            </>
          )}
        </View>
        
        <View style={styles.userControls}>
          {parentCollectorInactive ? (
            <View style={[styles.switchContainer, styles.blockedContainer]}>
              <Text style={styles.blockedBadge}>Colector inactivo</Text>
            </View>
          ) : canToggleActive ? (
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>
                {item.activo ? 'Activo' : 'Inactivo'}
              </Text>
              <Switch
                value={item.activo}
                disabled={isUpdating}
                onValueChange={() => {
                  console.log(`Cambiando estado de ${item.username} de ${item.activo} a ${!item.activo}`);
                  handleToggleActive(item.id, item.activo);
                }}
                trackColor={{ false: '#ff6b6b', true: '#51cf66' }}
                thumbColor={item.activo ? '#2b8a3e' : '#e03131'}
              />
            </View>
          ) : (
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>{item.activo ? 'Activo' : 'Inactivo'}</Text>
              <Text style={{ fontSize: 10, color: '#999' }}>Bloqueado</Text>
            </View>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editButton}>
              <Text style={styles.buttonText}>Editar</Text>
            </TouchableOpacity>
            {userRole === 'admin' && (
              <TouchableOpacity
                onPress={() => openResetPasswordModal(item)}
                style={styles.resetButton}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Contraseña</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => handleDelete(item.id)} 
              style={styles.deleteButton}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Gestionar Usuarios</Text>
      </View>

      <View style={styles.content}>
  <Button title={userRole === 'collector' ? 'Crear Listero' : 'Crear Usuario'} onPress={() => { clearForm(); if (userRole==='collector'){ setRole('listero'); setSelectedCollector(currentUserId);} setModalVisible(true); }} />

        {userRole === 'collector' && hierarchicalUsers.length === 0 && (
          <Text style={styles.emptyListText}>No tienes listeros asignados todavía.</Text>
        )}
        <FlatList
          data={hierarchicalUsers}
          keyExtractor={(item) => `${item.id}-${item.type}`}
          renderItem={renderUserItem}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />

        <Modal visible={modalVisible} animationType="slide">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isEditing ? (userRole==='collector' ? 'Editar Listero' : 'Editar Usuario') : (userRole==='collector' ? 'Crear Listero' : 'Crear Usuario')}</Text>

            <TextInput
              placeholder="Nombre de usuario"
              value={username}
              onChangeText={setUsername}
              style={styles.input}
            />

            {!isEditing && (
              <TextInput
                placeholder="Contraseña"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
            )}

            {userRole !== 'collector' && (
              <>
                <Text>Rol:</Text>
                <Picker
                  selectedValue={role}
                  onValueChange={setRole}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecciona un rol" value="" />
                  <Picker.Item label="Colector" value="collector" />
                  <Picker.Item label="Listero" value="listero" />
                </Picker>
              </>
            )}

            {role === 'listero' && userRole !== 'collector' && (
              <>
                <Text>Seleccionar colector:</Text>
                <Picker
                  selectedValue={selectedCollector}
                  onValueChange={setSelectedCollector}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecciona un colector" value="" />
                  {collectors.map((col) => (
                    <Picker.Item key={col.id} label={col.username} value={col.id} />
                  ))}
                </Picker>
                <View style={styles.limitsToggleRow}>
                  <Text style={styles.limitsToggleLabel}>Límites específicos</Text>
                  <Switch value={enableSpecificLimits} onValueChange={setEnableSpecificLimits} />
                </View>
                {enableSpecificLimits && (
                  <View style={styles.limitsContainer}>
                    {activePlayTypes.length === 0 && (
                      <Text style={styles.limitsHint}>No hay jugadas activas.</Text>
                    )}
                    {activePlayTypes.map(pt => (
                      <View key={pt} style={styles.limitInputRow}>
                        <Text style={styles.limitPlayType}>{pt}</Text>
                        <TextInput
                          placeholder="Limite"
                          keyboardType="numeric"
                          value={limitsValues[pt] || ''}
                          onChangeText={val => setLimitsValues(prev => ({ ...prev, [pt]: val.replace(/[^0-9]/g,'') }))}
                          style={styles.limitInput}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {userRole === 'collector' && (role === 'listero' || isEditing) && (
              <>
                <Text style={{ fontWeight:'600' }}>Ganancia:</Text>
                <Picker
                  selectedValue={selectedGainId || ''}
                   onValueChange={(val) => {
                    setSelectedGainId(val || null);
                    const f = gainOptions.find(g => g.id === val);
                     setSelectedGainDetail(f ? f.precios : null);
                   }}
                   style={styles.picker}
                 >
                   <Picker.Item label="Selecciona una ganancia" value="" />
                  {gainOptions.map(g => (
                    <Picker.Item key={g.id} label={g.nombre} value={g.id} />
                  ))}
                  {selectedGainId && !gainOptions.some(g => g.id === selectedGainId) && (
                    <Picker.Item label={`Configuración no válida`} value={selectedGainId} />
                  )}
                </Picker>
                {selectedGainDetail && (
                  <View style={{ borderWidth:1, borderColor:'#ccc', padding:10, borderRadius:6, backgroundColor:'#fff', marginBottom:15 }}>
                    {activePlayTypes.map(pt => {
                       const d = selectedGainDetail[pt];
                       if (!d) return null;
                       return (
                         <Text key={pt} style={{ fontSize:12, marginBottom:4 }}>
                           <Text style={{ fontWeight:'700', color:'#1d6fd1' }}>{pt.toUpperCase()}</Text>: regular {d.regular}, limitado {d.limited}, listero% {d.listeroPct}, colector% {d.collectorPct}
                         </Text>
                       );
                     })}
                  </View>
                )}
               </>
             )}

            <Button title={isEditing ? 'Guardar Cambios' : (userRole==='collector' ? 'Crear Listero' : 'Crear Usuario')} onPress={handleCreateOrUpdate} />
            <Button title="Cancelar" color="grey" onPress={() => setModalVisible(false)} />
          </View>
        </Modal>

        {/* Modal para cambiar contraseña (solo admin) */}
        <Modal visible={resetModalVisible} animationType="fade">
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <Text style={{ marginBottom: 8 }}>Usuario: {resetTargetUser?.username}</Text>
            <TextInput
              placeholder="Nueva contraseña"
              secureTextEntry
              value={resetPassword}
              onChangeText={setResetPassword}
              style={styles.input}
            />
            <TextInput
              placeholder="Confirmar contraseña"
              secureTextEntry
              value={resetPassword2}
              onChangeText={setResetPassword2}
              style={styles.input}
            />
            <Button title={isResetting ? 'Actualizando…' : 'Actualizar'} disabled={isResetting} onPress={handleConfirmResetPassword} />
            <Button title="Cancelar" color="grey" onPress={() => setResetModalVisible(false)} />
          </View>
        </Modal>
      </View>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
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
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
    position: 'absolute',
    top: 0,
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
    marginTop: 100,
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 15,
    backgroundColor: '#fff',
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
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#3498db',
    padding: 8,
    borderRadius: 5,
    marginRight: 10,
  },
  resetButton: {
    backgroundColor: '#6c5ce7',
    padding: 8,
    borderRadius: 5,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 5,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FDF5',
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
  emptyListText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#7f8c8d',
    fontSize: 14,
    fontStyle: 'italic'
  }
});
