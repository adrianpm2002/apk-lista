import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import CapacityModal from './CapacityModal';
import useCapacityData from '../hooks/useCapacityData';
import AnimatedModalWrapper from './AnimatedModalWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const BatteryButton = ({ onOptionSelect, selectedLotteries, selectedSchedules, selectedPlayTypes, lotteryOptions, scheduleOptionsMap, getScheduleLabel, playTypeLabels, bankId, onLotteryError, icon='🔋', animationProps }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { capacityData, loading, error, refresh } = useCapacityData(bankId, { includeClosed:false, hideZero:true });

  const handlePress = async () => {
    await refresh();
    setIsModalVisible(true);
  };

  // Animación ahora delegada a AnimatedModalWrapper

  const handleCloseModal = () => { setIsModalVisible(false); };

  return (
    <View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={handlePress}
      >
        <Text style={styles.icon}>{icon}</Text>
      </Pressable>
      <AnimatedModalWrapper visible={isModalVisible} {...animationProps}>
        <CapacityModal
          isVisible={isModalVisible}
          onClose={handleCloseModal}
          selectedLottery={null}
          capacityData={capacityData}
          loading={loading}
          error={error}
          getScheduleLabel={getScheduleLabel}
          playTypeLabels={playTypeLabels}
        />
      </AnimatedModalWrapper>
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
    ...createShadowStyle({
      color: '#2D5016',
      offsetY: 2,
      opacity: 0.1,
      radius: 3,
      elevation: 3,
    }),
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
