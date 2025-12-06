import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useOfflineSafe } from '../contexts/OfflineContext';
import { useNavigation } from '@react-navigation/native';

/**
 * FASE 9: Banner de conexión offline/online
 * 
 * Características:
 * - Banner naranja al perder conexión (auto-dismiss 3s)
 * - Banner verde al recuperar conexión (permanece con botón)
 * - Navega al Registro Offline para sincronizar
 */

const ConnectionBanner = () => {
  const navigation = useNavigation();
  const offlineContext = useOfflineSafe();
  
  const [showBanner, setShowBanner] = useState(false);
  const [bannerType, setBannerType] = useState(null); // 'offline' | 'online'
  const [pendingCount, setPendingCount] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-100));

  const isOnline = offlineContext?.isOnline ?? true;
  const pendingPlays = offlineContext?.pendingPlays || [];

  // Detectar cambios de conexión
  useEffect(() => {
    // Ignorar si no hay context
    if (!offlineContext) return;// PASO 9.1: Banner offline al perder conexión
    if (!isOnline) {
      // Solo mostrar si no estamos ya mostrando el banner offline
      if (bannerType !== 'offline') {setBannerType('offline');
        setShowBanner(true);
        showBannerWithAnimation();
        
        // Auto-dismiss después de 3 segundos
        const timer = setTimeout(() => {hideBannerWithAnimation();
        }, 3000);

        return () => clearTimeout(timer);
      }
    }

    // PASO 9.2: Banner online al recuperar conexión
    if (isOnline) {
      // Solo mostrar banner de recuperación si hay jugadas pendientes
      if (pendingPlays.length > 0 && bannerType !== 'online') {setBannerType('online');
        setPendingCount(pendingPlays.length);
        setShowBanner(true);
        showBannerWithAnimation();
      } 
      // Si no hay pendientes, ocultar cualquier banner
      else if (pendingPlays.length === 0 && showBanner) {hideBannerWithAnimation();
      }
    }

  }, [isOnline, pendingPlays.length]);

  const showBannerWithAnimation = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const hideBannerWithAnimation = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
      setBannerType(null);
    });
  };

  // PASO 9.3: Navegar y sincronizar
  const handleSyncPress = () => {
    hideBannerWithAnimation();
    // Navegar al Registro Offline
    navigation.navigate('OfflinePlayRegistry');
  };

  const handleDismiss = () => {
    hideBannerWithAnimation();
  };

  if (!showBanner || !bannerType) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.banner,
        bannerType === 'offline' ? styles.bannerOffline : styles.bannerOnline,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.bannerContent}>
        {/* Icono */}
        <Text style={styles.bannerIcon}>
          {bannerType === 'offline' ? '📴' : '📶'}
        </Text>

        {/* Mensaje */}
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>
            {bannerType === 'offline' 
              ? 'Sin conexión' 
              : 'Conexión recuperada'}
          </Text>
          <Text style={styles.bannerSubtitle}>
            {bannerType === 'offline' 
              ? 'Modo offline activado' 
              : `${pendingCount} jugada(s) pendiente(s)`}
          </Text>
        </View>

        {/* Botones */}
        <View style={styles.bannerActions}>
          {bannerType === 'online' ? (
            <>
              <Pressable 
                style={styles.bannerButton}
                onPress={handleSyncPress}
              >
                <Text style={styles.bannerButtonText}>Sincronizar</Text>
              </Pressable>
              <Pressable 
                style={styles.dismissButton}
                onPress={handleDismiss}
              >
                <Text style={styles.dismissButtonText}>✕</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 40, // Mover hacia abajo para evitar barra de notificaciones
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bannerOffline: {
    backgroundColor: '#FF9800',
  },
  bannerOnline: {
    backgroundColor: '#4CAF50',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44, // Altura similar al ModeSelector
  },
  bannerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  bannerButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 6,
  },
  dismissButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ConnectionBanner;
