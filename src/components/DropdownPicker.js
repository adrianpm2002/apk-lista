import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';

const DropdownPicker = ({ 
  label, 
  value, 
  onSelect, 
  options = [], 
  placeholder = "Seleccionar...",
  style,
  hasError = false,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleSelect = (item) => {
    onSelect(item);
    setIsVisible(false);
  };

  const renderOption = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        pressed && styles.optionPressed
      ]}
      onPress={() => handleSelect(item)}
    >
      <Text style={styles.optionText}>{item.label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.dropdown,
          hasError && styles.dropdownError,
          disabled && styles.dropdownDisabled,
          pressed && !disabled && styles.dropdownPressed
        ]}
        onPress={() => !disabled && setIsVisible(true)}
      >
        <Text style={[
          styles.dropdownText,
          !value && styles.placeholder,
          hasError && styles.dropdownTextError
        ]}>
          {value || placeholder}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item) => item.value.toString()}
              style={styles.optionsList}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 6,
    marginLeft: 4,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dropdownText: {
    fontSize: 15,
    color: '#2D5016',
    flex: 1,
  },
  placeholder: {
    color: '#8FA987',
  },
  arrow: {
    fontSize: 12,
    color: '#2D5016',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    maxHeight: 300,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D5016',
    textAlign: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F1E4',
    paddingBottom: 8,
  },
  optionsList: {
    maxHeight: 200,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 15,
    color: '#2D5016',
    textAlign: 'center',
  },
  dropdownPressed: {
    opacity: 0.8,
    borderColor: '#A0C890',
  },
  dropdownError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
  },
  dropdownDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#CCCCCC',
    opacity: 0.6,
  },
  dropdownTextError: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  optionPressed: {
    backgroundColor: '#E8F5E8',
    opacity: 0.9,
  },
});

export default DropdownPicker;
