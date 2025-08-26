/**
 * AI Assistant Component
 * 
 * A floating AI assistant that can help users with lottery data analysis
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAI } from '../hooks/useAI';

const AIAssistant = ({ visible, onClose, isDarkMode = false }) => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const { loading, error, chatAssistant, clearError } = useAI();

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');
    
    // Add user message to conversation
    const newConversation = [
      ...conversation,
      { role: 'user', content: userMessage, timestamp: new Date() }
    ];
    setConversation(newConversation);

    try {
      const response = await chatAssistant(userMessage, {
        conversationHistory: conversation.slice(-5), // Last 5 messages for context
      });

      // Add AI response to conversation
      setConversation(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: response.content, 
          timestamp: new Date() 
        }
      ]);
    } catch (err) {
      Alert.alert(
        'Error',
        'No se pudo procesar tu mensaje. Verifica tu conexión y configuración de API.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  };

  const clearConversation = () => {
    setConversation([]);
    clearError();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, isDarkMode && styles.headerDark]}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            🤖 Asistente IA Claude Sonnet 4
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.clearButton, isDarkMode && styles.clearButtonDark]}
              onPress={clearConversation}
            >
              <Text style={[styles.clearButtonText, isDarkMode && styles.clearButtonTextDark]}>
                Limpiar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeButton, isDarkMode && styles.closeButtonDark]}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, isDarkMode && styles.closeButtonTextDark]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.errorDismiss}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Conversation */}
        <ScrollView 
          style={[styles.conversation, isDarkMode && styles.conversationDark]}
          contentContainerStyle={styles.conversationContent}
        >
          {conversation.length === 0 && (
            <View style={styles.welcomeContainer}>
              <Text style={[styles.welcomeText, isDarkMode && styles.welcomeTextDark]}>
                👋 ¡Hola! Soy tu asistente IA especializado en loterías.
              </Text>
              <Text style={[styles.welcomeSubtext, isDarkMode && styles.welcomeSubtextDark]}>
                Puedo ayudarte con análisis de datos, reportes y preguntas sobre el sistema.
              </Text>
            </View>
          )}

          {conversation.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageContainer,
                msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                isDarkMode && (msg.role === 'user' ? styles.userMessageDark : styles.assistantMessageDark)
              ]}
            >
              <Text style={[
                styles.messageText,
                isDarkMode && styles.messageTextDark,
                msg.role === 'user' && styles.userMessageText
              ]}>
                {msg.content}
              </Text>
              <Text style={[styles.timestamp, isDarkMode && styles.timestampDark]}>
                {formatTime(msg.timestamp)}
              </Text>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageContainer, styles.assistantMessage]}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.messageText, styles.loadingText]}>
                Claude está escribiendo...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
          <TextInput
            style={[styles.textInput, isDarkMode && styles.textInputDark]}
            value={message}
            onChangeText={setMessage}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={isDarkMode ? '#888' : '#999'}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!message.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  headerDark: {
    backgroundColor: '#2a2a2a',
    borderBottomColor: '#404040',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  titleDark: {
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6c757d',
    borderRadius: 6,
  },
  clearButtonDark: {
    backgroundColor: '#495057',
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  clearButtonTextDark: {
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonDark: {
    backgroundColor: '#c82333',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButtonTextDark: {
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#721c24',
    flex: 1,
    fontSize: 14,
  },
  errorDismiss: {
    color: '#721c24',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  conversation: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  conversationDark: {
    backgroundColor: '#1a1a1a',
  },
  conversationContent: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeTextDark: {
    color: '#fff',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  welcomeSubtextDark: {
    color: '#ccc',
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  userMessageDark: {
    backgroundColor: '#0056b3',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f3f4',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  assistantMessageDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
  },
  messageTextDark: {
    color: '#fff',
  },
  userMessageText: {
    color: '#fff',
  },
  loadingText: {
    fontStyle: 'italic',
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampDark: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    alignItems: 'flex-end',
  },
  inputContainerDark: {
    backgroundColor: '#2a2a2a',
    borderTopColor: '#404040',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    maxHeight: 100,
    fontSize: 15,
    color: '#333',
  },
  textInputDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#404040',
    color: '#fff',
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default AIAssistant;