import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import LimitedNumbersButton from './LimitedNumbersButton';
import ListerLimitsButton from './ListerLimitsButton';
import PricesButton from './PricesButton';

const TopBar = ({ onOptionSelect }) => {
  const handleOptionSelect = (option) => {
    onOptionSelect && onOptionSelect(option);
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonsContainer}>
        <LimitedNumbersButton onOptionSelect={handleOptionSelect} />
        <ListerLimitsButton onOptionSelect={handleOptionSelect} />
        <PricesButton onOptionSelect={handleOptionSelect} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});

export default TopBar;
