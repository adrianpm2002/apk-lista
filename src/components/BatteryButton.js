import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';

const BatteryButton = ({ onOptionSelect }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState('empty');

  const batteryOptions = [
    { label: 'Vacío', value: 'empty', icon: '🔋' },
    { label: '25%', value: 'quarter', icon: '🔋' },
    { label: '50%', value: 'half', icon: '🔋' },
    { label: '75%', value: 'three_quarter', icon: '🔋' },
    { label: 'Lleno', value: 'full', icon: '🔋' },
  ];

  const handleSelect = (option) => {
    setBatteryLevel(option.value);
    onOptionSelect && onOptionSelect(option);
    setIsVisible(false);
  };

  const getBatteryIcon = () => {
    switch (batteryLevel) {
      case 'empty': return '🪫';
      case 'quarter': return '🔋';
      case 'half': return '🔋';
      case 'three_quarter': return '🔋';
      case 'full': return '🔋';
      default: return '🪫';
    }
  };

  const renderOption = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        pressed && styles.optionPressed
      ]}
      onPress={() => handleSelect(item)}
    >
      <Text style={styles.optionIcon}>{item.icon}</Text>
      <Text style={styles.optionText}>{item.label}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.buttonIcon}>{getBatteryIcon()}</Text>
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
            <Text style={styles.modalTitle}>Nivel de Batería</Text>
            <FlatList
              data={batteryOptions}
              renderItem={renderOption}
              keyExtractor={(item) => item.value}
              style={styles.optionsList}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonIcon: {
    fontSize: 18,
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
    width: '70%',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  optionText: {
    fontSize: 14,
    color: '#2D5016',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  optionPressed: {
    backgroundColor: '#E8F5E8',
    opacity: 0.8,
  },
});

export default BatteryButton;
