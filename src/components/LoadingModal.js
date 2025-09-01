import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';

const LoadingModal = ({ visible, message = 'Cargando datos...' }) => {
  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 200,
  },
  message: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

export default LoadingModal;
