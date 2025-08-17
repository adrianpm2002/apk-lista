import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import { supabase } from '../supabaseClient';

const ChangePasswordModal = ({ visible, onClose, isDarkMode }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // {type: 'error'|'success', message: string}

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setStatus(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onClose();
    }
  };

  const handleChangePassword = async () => {
    try {
      if (isLoading) return;

      setStatus(null);

      // Validaciones
      if (!newPassword || newPassword.length < 6) {
        setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
        return;
      }

      if (newPassword !== confirmPassword) {
        setStatus({ type: 'error', message: 'Las contraseñas no coinciden' });
        return;
      }

      setIsLoading(true);

      // Cambiar contraseña usando Supabase Auth
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) {
        setStatus({ 
          type: 'error', 
          message: error.message || 'Error al actualizar la contraseña' 
        });
      } else {
        setStatus({ 
          type: 'success', 
          message: 'Contraseña actualizada correctamente' 
        });
        
        // Cerrar modal después de 2 segundos si fue exitoso
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setStatus({ 
        type: 'error', 
        message: error.message || 'Error inesperado' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.container,
          isDarkMode && styles.containerDark
        ]}>
          <Text style={[
            styles.title,
            isDarkMode && styles.titleDark
          ]}>
            Cambiar Contraseña
          </Text>

          <TextInput
            secureTextEntry
            placeholder="Nueva contraseña"
            placeholderTextColor={isDarkMode ? "#95a5a6" : "#7f8c8d"}
            value={newPassword}
            onChangeText={setNewPassword}
            style={[
              styles.input,
              isDarkMode && styles.inputDark
            ]}
            editable={!isLoading}
          />

          <TextInput
            secureTextEntry
            placeholder="Confirmar contraseña"
            placeholderTextColor={isDarkMode ? "#95a5a6" : "#7f8c8d"}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={[
              styles.input,
              isDarkMode && styles.inputDark
            ]}
            editable={!isLoading}
          />

          {status && (
            <Text style={[
              styles.statusText,
              status.type === 'error' ? styles.statusError : styles.statusSuccess
            ]}>
              {status.message}
            </Text>
          )}

          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.button,
                styles.cancelButton,
                isLoading && styles.buttonDisabled
              ]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.saveButton,
                isLoading && styles.buttonDisabled
              ]}
              onPress={handleChangePassword}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Guardando...' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  containerDark: {
    backgroundColor: '#2c3e50',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 24,
  },
  titleDark: {
    color: '#ecf0f1',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 16,
  },
  inputDark: {
    backgroundColor: '#34495e',
    borderColor: '#5d6d7e',
    color: '#ecf0f1',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statusError: {
    color: '#e74c3c',
  },
  statusSuccess: {
    color: '#27ae60',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#3498db',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChangePasswordModal;
