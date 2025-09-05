// Exportación de PDF para nativo (Expo): usa expo-print y expo-sharing

import { Alert, Platform } from 'react-native';

export async function exportPdf(html) {
  try {
    const { printToFileAsync } = await import('expo-print');
    const { isAvailableAsync, shareAsync } = await import('expo-sharing');
    
    // Configuración para generar el PDF
    const file = await printToFileAsync({ 
      html, 
      base64: false,
      width: 612,
      height: 792,
      margins: {
        left: 20,
        top: 20,
        right: 20,
        bottom: 20,
      }
    });
    
    const canShare = await isAvailableAsync();
    if (canShare) {
      await shareAsync(file.uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: 'Exportar Detalles PDF',
        UTI: 'com.adobe.pdf'
      });
      return true;
    } else {
      // En caso de que sharing no esté disponible, mostrar la ubicación del archivo
      Alert.alert(
        'PDF Exportado', 
        `El archivo PDF se ha generado exitosamente.\n\nUbicación: ${file.uri}`,
        [{ text: 'OK', style: 'default' }]
      );
      return true;
    }
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    Alert.alert(
      'Error de Exportación', 
      `No se pudo generar el PDF. ${error.message || 'Error desconocido'}`,
      [{ text: 'OK', style: 'default' }]
    );
    return false;
  }
}
