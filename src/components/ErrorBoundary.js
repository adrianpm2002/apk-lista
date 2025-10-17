import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Actualizar el estado para mostrar la UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error
    console.error('🔴 ErrorBoundary caught an error:', error);
    console.error('🔴 Error info:', errorInfo);
    console.error('🔴 Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo
    });

    // También mostrar Alert para errores críticos
    Alert.alert(
      '⚠️ Error Detectado',
      `${error.toString()}\n\nRevisa los detalles en pantalla.`,
      [
        { 
          text: 'Ver Detalles', 
          onPress: () => console.log('Error details:', error, errorInfo) 
        },
        { 
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  }

  resetError = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback cuando hay un error
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>⚠️ Error Detectado</Text>
            <Text style={styles.subtitle}>
              La aplicación encontró un error. Los detalles se muestran abajo:
            </Text>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>Error:</Text>
              <Text style={styles.errorText}>
                {this.state.error?.toString()}
              </Text>
            </View>

            {this.state.error?.message && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Mensaje:</Text>
                <Text style={styles.errorText}>
                  {this.state.error.message}
                </Text>
              </View>
            )}

            {this.state.error?.stack && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Stack Trace:</Text>
                <Text style={styles.stackText}>
                  {this.state.error.stack}
                </Text>
              </View>
            )}

            {this.state.errorInfo?.componentStack && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Component Stack:</Text>
                <Text style={styles.stackText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={this.resetError}
            >
              <Text style={styles.buttonText}>Intentar de Nuevo</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#ff6b6b',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  errorSection: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
