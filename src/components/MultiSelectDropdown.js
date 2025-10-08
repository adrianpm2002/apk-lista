import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { createShadowStyle, shadowPresets } from '../utils/shadowUtils';

const MultiSelectDropdown = ({ 
  label, 
  selectedValues = [], 
  onSelect, 
  options = [], 
  placeholder = "Seleccionar opciones",
  hasError = false,
  errorMessage = "",
  dropdownStyle = {} // Nuevo prop para estilos personalizados
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleSelect = (optionValue) => {
    let newSelectedValues;
    
    if (selectedValues.includes(optionValue)) {
      // Si ya está seleccionado, lo removemos
      newSelectedValues = selectedValues.filter(value => value !== optionValue);
    } else {
      // Si no está seleccionado, lo agregamos
      newSelectedValues = [...selectedValues, optionValue];
    }
    
    onSelect && onSelect(newSelectedValues);
  };

  const getSelectedLabels = () => {
    if (selectedValues.length === 0) return placeholder;
    
    const selectedLabels = selectedValues.map(value => {
      const option = options.find(opt => opt.value === value);
      return option ? option.label : value;
    });
    
    if (selectedLabels.length === 1) {
      return selectedLabels[0];
    } else if (selectedLabels.length === 2) {
      return selectedLabels.join(' y ');
    } else {
      return `${selectedLabels[0]} y ${selectedLabels.length - 1} más`;
    }
  };

  const isSelected = (optionValue) => selectedValues.includes(optionValue);

  const renderOption = ({ item }) => {
    const selected = isSelected(item.value);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.option,
          selected && styles.optionSelected,
          pressed && styles.optionPressed
        ]}
        onPress={() => handleSelect(item.value)}
      >
        <View style={styles.optionContent}>
          <Text style={[
            styles.optionText,
            selected && styles.optionTextSelected
          ]}>
            {item.label}
          </Text>
          {selected && (
            <Text style={styles.checkmark}>
              ✓
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
        </Text>
      )}
      
      <Pressable
        style={({ pressed }) => [
          styles.dropdown,
          hasError && styles.dropdownError,
          pressed && styles.dropdownPressed,
          dropdownStyle // Aplicar estilos personalizados
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={[
          styles.dropdownText,
          selectedValues.length === 0 && styles.placeholderText,
          hasError && styles.dropdownTextError
        ]}>
          {hasError && errorMessage ? errorMessage : getSelectedLabels()}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setIsVisible(false); }}
      >
        <Pressable style={styles.overlay} onPress={() => { setIsVisible(false); }}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                Seleccionar {label || 'Opciones'}
              </Text>
            </View>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item) => item.value}
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.footerBar}>
              <Pressable
                style={({ pressed }) => [styles.clearButtonInline, pressed && styles.clearButtonPressed]}
                onPress={() => onSelect && onSelect([])}
              >
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.acceptButton, pressed && styles.acceptButtonPressed]}
                onPress={() => setIsVisible(false)}
              >
                <Text style={styles.acceptButtonText}>Aceptar</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  dropdown: {
    borderWidth: 1.5,
    borderColor: '#D5DBDB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  dropdownPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  dropdownError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
  },
  dropdownTextError: {
    color: '#E74C3C',
    fontWeight: '500',
  },
  dropdownText: {
    fontSize: 16,
    color: '#2C3E50',
    flex: 1,
  },
  placeholderText: {
    color: '#95A5A6',
  },
  arrow: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
    ...createShadowStyle(shadowPresets.modal),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerBar:{
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    padding:12,
    borderTopWidth:1,
    borderTopColor:'#ECF0F1'
  },
  clearButtonInline:{
    paddingHorizontal:14,
    paddingVertical:8,
    backgroundColor:'#E74C3C',
    borderRadius:6,
  },
  acceptButton:{
    paddingHorizontal:16,
    paddingVertical:8,
    backgroundColor:'#2E7D32',
    borderRadius:6,
  },
  acceptButtonPressed:{
    opacity:0.85,
    transform:[{scale:0.97}]
  },
  acceptButtonText:{
    color:'#FFFFFF',
    fontSize:14,
    fontWeight:'600'
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  optionSelected: {
    backgroundColor: '#E8F6F3',
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#2C3E50',
    flex: 1,
  },
  optionTextSelected: {
    color: '#16A085',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#16A085',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  footerText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E74C3C',
    borderRadius: 6,
  },
  clearButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MultiSelectDropdown;