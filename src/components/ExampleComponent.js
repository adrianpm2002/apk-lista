import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ExampleComponent = () => (
  <View style={styles.container}>
    <Text>Componente de ejemplo</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
});

export default ExampleComponent;
