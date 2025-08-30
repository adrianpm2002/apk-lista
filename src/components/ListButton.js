import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ListButton = ({ isDarkMode = false, currentMode = 'Visual' }) => {
  const navigation = useNavigation();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        isDarkMode && styles.buttonDark
      ]}
  onPress={() => navigation.navigate('SavedPlays', { isDarkMode, originMode: currentMode })}
    >
      <Text style={styles.buttonIcon}>📄</Text>
    </Pressable>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

export default ListButton;
