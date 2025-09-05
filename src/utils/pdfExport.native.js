// Exportación de PDF para nativo (Expo): usa expo-print y expo-sharing

import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function exportPdf(html) {
  console.log('pdfExport.native: Iniciando exportación...');
  console.log('Platform.OS:', Platform.OS);
  
  try {
    console.log('Verificando módulos...');
    console.log('Print:', Print);
    console.log('Sharing:', Sharing);
    console.log('Print.printToFileAsync:', Print.printToFileAsync);
    console.log('Sharing.shareAsync:', Sharing.shareAsync);
    
    if (!Print.printToFileAsync) {
      throw new Error('printToFileAsync no está disponible en expo-print');
    }
    
    console.log('HTML recibido, longitud:', html.length);
    
    // Configuración para generar el PDF
    console.log('Generando PDF...');
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
    
    console.log('PDF generado:', file.uri);
    
    const canShare = await Sharing.isAvailableAsync();
    console.log('Sharing disponible:', canShare);
    
    if (canShare) {
      console.log('Compartiendo archivo...');
      await Sharing.shareAsync(file.uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: 'Exportar Detalles PDF',
        UTI: 'com.adobe.pdf'
      });
      console.log('Archivo compartido exitosamente');
      return true;
    } else {
      // En caso de que sharing no esté disponible, mostrar la ubicación del archivo
      console.log('Sharing no disponible, mostrando ubicación');
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
