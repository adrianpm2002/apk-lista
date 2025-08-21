import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useOffline } from '../context/OfflineContext';

const ListButton = ({ isDarkMode = false }) => {
  const navigation = useNavigation();
  const { pendingCount } = useOffline();
  const hasPending = (pendingCount || 0) > 0;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        isDarkMode && styles.buttonDark
      ]}
      onPress={() => navigation.navigate('SavedPlays', { isDarkMode })}
    >
      <Text style={styles.buttonIcon}>📄</Text>
      {hasPending && <View style={styles.orangeDot} />}
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
  orangeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E67E22',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});

export default ListButton;
