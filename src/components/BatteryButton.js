import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import CapacityModal from './CapacityModal';

const BatteryButton = ({ onOptionSelect, selectedLotteries, lotteryOptions, onLotteryError }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handlePress = () => {
    // Validar que haya exactamente una lotería seleccionada
    if (!selectedLotteries || selectedLotteries.length === 0) {
      onLotteryError && onLotteryError(true, 'Selecciona una lotería');
      return;
    }
    
    if (selectedLotteries.length > 1) {
      onLotteryError && onLotteryError(true, 'Selecciona solo una lotería');
      return;
    }

    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  return (
    <View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={handlePress}
      >
        <Text style={styles.icon}>🔋</Text>
      </Pressable>

      <CapacityModal
        isVisible={isModalVisible}
        onClose={handleCloseModal}
        selectedLottery={
          selectedLotteries && selectedLotteries.length === 1 && lotteryOptions
            ? lotteryOptions.find(opt => opt.value === selectedLotteries[0])?.label || null
            : null
        }
      />
    </View>
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
  icon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

export default BatteryButton;
