// Exportación de PDF para nativo (Expo): usa expo-print y expo-sharing

import { Alert } from 'react-native';

export async function exportPdf(html) {
  try {
    const { printToFileAsync } = await import('expo-print');
    const { isAvailableAsync, shareAsync } = await import('expo-sharing');
    const file = await printToFileAsync({ html, base64: false });
    const canShare = await isAvailableAsync();
    if (canShare) {
      await shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar Detalles' });
      return true;
    }
    Alert.alert('Exportado', `PDF generado en: ${file.uri}`);
    return true;
  } catch (e) {
    return false;
  }
}
