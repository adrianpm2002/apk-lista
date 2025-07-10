import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';

const InputField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  multiline = false,
  keyboardType = 'default',
  style,
  inputStyle 
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          inputStyle
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8FA987"
        multiline={multiline}
        keyboardType={keyboardType}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2D5016',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default InputField;
