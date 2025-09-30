// Exportación de PDF para nativo (Expo): usa expo-print y expo-sharing

import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function exportPdf(html) {
  try {
    
    if (!Print.printToFileAsync) {
      throw new Error('printToFileAsync no está disponible en expo-print');
    }
    
    // Configuración para generar el PDF
    const file = await Print.printToFileAsync({ 
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
    
    const canShare = await Sharing.isAvailableAsync();
    
    if (canShare) {
      await Sharing.shareAsync(file.uri, { 
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
    console.error('Error en pdfExport.native:', error);
    console.error('Stack trace:', error.stack);
    Alert.alert(
      'Error de Exportación', 
      `No se pudo generar el PDF.\n\nError: ${error.message || 'Error desconocido'}\n\nDetalles: ${error.code || 'Sin código'}`,
      [{ text: 'OK', style: 'default' }]
    );
    return false;
  }
}
