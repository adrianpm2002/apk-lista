import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import LimitedNumbersButton from './LimitedNumbersButton';
import ListerLimitsButton from './ListerLimitsButton';
import PricesButton from './PricesButton';

const TopBar = ({ onOptionSelect }) => {
  const { width } = useWindowDimensions();
  const isSmall = width <= 360; // móviles pequeños

  const handleOptionSelect = (option) => {
    onOptionSelect && onOptionSelect(option);
  };

  return (
    <View style={[styles.container, isSmall && styles.containerSmall]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.buttonsContainer,
          styles.buttonsScrollContent,
        ]}
      >
        <LimitedNumbersButton onOptionSelect={handleOptionSelect} />
        <ListerLimitsButton onOptionSelect={handleOptionSelect} />
        <PricesButton onOptionSelect={handleOptionSelect} />
      </ScrollView>
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
  containerSmall: {
    paddingTop: 24,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});

export default TopBar;
