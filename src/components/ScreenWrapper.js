import React from 'react';
import { View, StyleSheet } from 'react-native';
import CacheStatusIndicator from './CacheStatusIndicator';

const ScreenWrapper = ({ children, showCacheStatus = false, isDarkMode = false }) => {
  return (
    <View style={styles.container}>
      {children}
      {showCacheStatus && (
        <CacheStatusIndicator 
          isDarkMode={isDarkMode} 
          showDetails={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
