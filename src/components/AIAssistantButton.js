/**
 * AI Assistant Button Component
 * 
 * Simple button to open the AI assistant
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const AIAssistantButton = ({ onPress, isDarkMode = false }) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isDarkMode && styles.buttonDark
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>🤖</Text>
      <Text style={[
        styles.text,
        isDarkMode && styles.textDark
      ]}>
        Asistente Claude
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0ea5e9',
    borderRadius: 8,
    marginVertical: 4,
  },
  buttonDark: {
    backgroundColor: '#1e293b',
    borderColor: '#0284c7',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0ea5e9',
    flex: 1,
  },
  textDark: {
    color: '#38bdf8',
  },
});

export default AIAssistantButton;