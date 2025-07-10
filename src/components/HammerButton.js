import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';

const HammerButton = ({ onOptionSelect }) => {
  const [isVisible, setIsVisible] = useState(false);

  const hammerOptions = [
    { label: 'Opción 1', value: 'option1', icon: '⚒️' },
    { label: 'Opción 2', value: 'option2', icon: '🔨' },
    { label: 'Opción 3', value: 'option3', icon: '⚡' },
    { label: 'Opción 4', value: 'option4', icon: '🔧' },
  ];

  const handleSelect = (option) => {
    onOptionSelect && onOptionSelect(option);
    setIsVisible(false);
  };

  const renderOption = ({ item }) => (
    <TouchableOpacity
      style={styles.option}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.optionIcon}>{item.icon}</Text>
      <Text style={styles.optionText}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setIsVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonIcon}>🔨</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setIsVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Herramientas</Text>
            <FlatList
              data={hammerOptions}
              renderItem={renderOption}
              keyExtractor={(item) => item.value}
              style={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
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
});

export default HammerButton;
