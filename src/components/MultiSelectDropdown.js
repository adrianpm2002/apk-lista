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

const MultiSelectDropdown = ({ 
  label, 
  selectedValues = [], 
  onSelect, 
  options = [], 
  placeholder = "Seleccionar opciones",
  isDarkMode = false,
  hasError = false,
  errorMessage = ""
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
          isDarkMode && styles.optionDark,
          selected && isDarkMode && styles.optionSelectedDark,
          pressed && styles.optionPressed
        ]}
        onPress={() => handleSelect(item.value)}
      >
        <View style={styles.optionContent}>
          <Text style={[
            styles.optionText,
            selected && styles.optionTextSelected,
            isDarkMode && styles.optionTextDark,
            selected && isDarkMode && styles.optionTextSelectedDark
          ]}>
            {item.label}
          </Text>
          {selected && (
            <Text style={[
              styles.checkmark,
              isDarkMode && styles.checkmarkDark
            ]}>
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
        <Text style={[styles.label, isDarkMode && styles.labelDark]}>
          {label}
        </Text>
      )}
      
      <Pressable
        style={({ pressed }) => [
          styles.dropdown,
          isDarkMode && styles.dropdownDark,
          hasError && styles.dropdownError,
          pressed && styles.dropdownPressed
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={[
          styles.dropdownText,
          selectedValues.length === 0 && styles.placeholderText,
          isDarkMode && styles.dropdownTextDark,
          selectedValues.length === 0 && isDarkMode && styles.placeholderTextDark,
          hasError && styles.dropdownTextError
        ]}>
          {hasError && errorMessage ? errorMessage : getSelectedLabels()}
        </Text>
        <Text style={[styles.arrow, isDarkMode && styles.arrowDark]}>▼</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setIsVisible(false); }}
      >
        <Pressable style={styles.overlay} onPress={() => { setIsVisible(false); }}>
          <View style={[styles.modal, isDarkMode && styles.modalDark]}>
            <View style={[styles.header, isDarkMode && styles.headerDark]}>
              <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
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
            <View style={[styles.footerBar, isDarkMode && styles.footerBarDark]}>
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
  labelDark: {
    color: '#ECF0F1',
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
  dropdownDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
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
  dropdownTextDark: {
    color: '#ECF0F1',
  },
  placeholderText: {
    color: '#95A5A6',
  },
  placeholderTextDark: {
    color: '#7F8C8D',
  },
  arrow: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  arrowDark: {
    color: '#BDC3C7',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalDark: {
    backgroundColor: '#2C3E50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECF0F1',
  },
  headerDark: {
    borderBottomColor: '#34495E',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  headerTitleDark: {
    color: '#ECF0F1',
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
  footerBarDark:{
    borderTopColor:'#34495E'
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
  optionDark: {
    borderBottomColor: '#34495E',
  },
  optionSelected: {
    backgroundColor: '#E8F6F3',
  },
  optionSelectedDark: {
    backgroundColor: '#1ABC9C',
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
  optionTextDark: {
    color: '#ECF0F1',
  },
  optionTextSelected: {
    color: '#16A085',
    fontWeight: '600',
  },
  optionTextSelectedDark: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#16A085',
    fontWeight: 'bold',
  },
  checkmarkDark: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ECF0F1',
  },
  footerDark: {
    borderTopColor: '#34495E',
  },
  footerText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  footerTextDark: {
    color: '#BDC3C7',
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