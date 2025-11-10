import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio para encriptación de credenciales offline
 * Usa encriptación XOR simple con Base64 (sin dependencias externas)
 * Compatible con producción en React Native
 */

const DEVICE_KEY_STORAGE = '@device_encryption_key';

/**
 * Generar clave única por dispositivo usando Math.random()
 * Esta clave se genera una sola vez y se guarda en AsyncStorage
 * @returns {Promise<string>} Clave de encriptación en formato hexadecimal
 */
export const generateDeviceKey = async () => {
  try {
    // Intentar obtener clave existente
    const existingKey = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
    if (existingKey) {
      console.log('[Encryption] Using existing device key');
      return existingKey;
    }

    // Generar nueva clave aleatoria (32 bytes = 256 bits)
    // Usar Math.random() + Date.now() para semilla
    const seed = Date.now().toString() + Math.random().toString();
    let key = '';
    
    for (let i = 0; i < 64; i++) { // 64 caracteres hex = 32 bytes
      const randomValue = Math.floor(Math.random() * 256);
      key += randomValue.toString(16).padStart(2, '0');
    }
    
    // Mezclar con hash de la semilla para más entropía
    const seedHash = simpleHash(seed);
    key = xorStrings(key, seedHash);

    // Guardar clave en AsyncStorage
    await AsyncStorage.setItem(DEVICE_KEY_STORAGE, key);
    console.log('[Encryption] Generated and saved new device key');

    return key;
  } catch (error) {
    console.error('[Encryption] Error generating device key:', error);
    throw error;
  }
};

/**
 * Obtener clave de dispositivo (sin generar nueva si no existe)
 * @returns {Promise<string|null>} Clave o null si no existe
 */
export const getDeviceKey = async () => {
  try {
    const key = await AsyncStorage.getItem(DEVICE_KEY_STORAGE);
    return key;
  } catch (error) {
    console.error('[Encryption] Error getting device key:', error);
    return null;
  }
};

/**
 * Encriptar contraseña usando la clave del dispositivo
 * Usa XOR con la clave + Base64 (compatible con React Native en producción)
 * No depende de expo-crypto ni Buffer
 * 
 * @param {string} password - Contraseña en texto plano
 * @param {string} key - Clave de encriptación (opcional, usa clave del dispositivo si no se provee)
 * @returns {Promise<string>} Contraseña encriptada en Base64
 */
export const encryptPassword = async (password, key = null) => {
  try {
    console.log('[Encryption] Iniciando encriptación de contraseña...');
    const encryptionKey = key || await generateDeviceKey();
    console.log('[Encryption] Clave de encriptación obtenida');
    
    // Convertir password y key a arrays de bytes
    console.log('[Encryption] Convirtiendo password a bytes...');
    const passwordBytes = stringToBytes(password);
    console.log('[Encryption] Password bytes:', passwordBytes.length);
    
    const keyBytes = hexToBytes(encryptionKey);
    console.log('[Encryption] Key bytes:', keyBytes.length);

    // XOR simple: repetir la clave si es más corta que el password
    console.log('[Encryption] Aplicando XOR...');
    const encryptedBytes = passwordBytes.map((byte, index) => {
      const keyByte = keyBytes[index % keyBytes.length];
      return byte ^ keyByte;
    });

    // Convertir a Base64
    console.log('[Encryption] Convirtiendo a Base64...');
    const encryptedBase64 = bytesToBase64(encryptedBytes);
    
    console.log('[Encryption] ✅ Password encrypted successfully, length:', encryptedBase64.length);
    return encryptedBase64;
  } catch (error) {
    console.error('[Encryption] Error encrypting password:', error);
    throw error;
  }
};

/**
 * Desencriptar contraseña
 * 
 * @param {string} encryptedPassword - Contraseña encriptada en Base64
 * @param {string} key - Clave de encriptación (opcional, usa clave del dispositivo si no se provee)
 * @returns {Promise<string>} Contraseña en texto plano
 */
export const decryptPassword = async (encryptedPassword, key = null) => {
  try {
    console.log('[Encryption] Iniciando desencriptación de contraseña...');
    const encryptionKey = key || await getDeviceKey();
    
    if (!encryptionKey) {
      console.error('[Encryption] ❌ No se encontró clave de encriptación');
      throw new Error('No encryption key found');
    }
    
    console.log('[Encryption] Clave de encriptación obtenida');

    // Convertir de Base64 a bytes
    console.log('[Encryption] Convirtiendo desde Base64...');
    const encryptedBytes = base64ToBytes(encryptedPassword);
    console.log('[Encryption] Encrypted bytes:', encryptedBytes.length);
    
    const keyBytes = hexToBytes(encryptionKey);

    // XOR para desencriptar (mismo algoritmo que encriptar)
    console.log('[Encryption] Aplicando XOR para desencriptar...');
    const decryptedBytes = encryptedBytes.map((byte, index) => {
      const keyByte = keyBytes[index % keyBytes.length];
      return byte ^ keyByte;
    });

    // Convertir bytes a string
    console.log('[Encryption] Convirtiendo bytes a string...');
    const decryptedPassword = bytesToString(decryptedBytes);
    
    console.log('[Encryption] ✅ Password decrypted successfully');
    return decryptedPassword;
  } catch (error) {
    console.error('[Encryption] Error decrypting password:', error);
    throw error;
  }
};

/**
 * Generar hash simple de una cadena (para verificación)
 * @param {string} text - Texto a hashear
 * @returns {Promise<string>} Hash en formato hexadecimal
 */
export const generateHash = async (text) => {
  try {
    const hash = simpleHash(text);
    return hash;
  } catch (error) {
    console.error('[Encryption] Error generating hash:', error);
    throw error;
  }
};

/**
 * Verificar si un texto coincide con un hash
 * @param {string} text - Texto a verificar
 * @param {string} hash - Hash esperado
 * @returns {Promise<boolean>} true si coincide
 */
export const verifyHash = async (text, hash) => {
  try {
    const textHash = await generateHash(text);
    return textHash === hash;
  } catch (error) {
    console.error('[Encryption] Error verifying hash:', error);
    return false;
  }
};

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Convertir string a array de bytes (UTF-8)
 */
const stringToBytes = (str) => {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode < 0xd800 || charCode >= 0xe000) {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    } else {
      i++;
      const surrogate = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (surrogate >> 18),
        0x80 | ((surrogate >> 12) & 0x3f),
        0x80 | ((surrogate >> 6) & 0x3f),
        0x80 | (surrogate & 0x3f)
      );
    }
  }
  return bytes;
};

/**
 * Convertir array de bytes a string (UTF-8)
 */
const bytesToString = (bytes) => {
  let str = '';
  let i = 0;
  
  while (i < bytes.length) {
    const byte = bytes[i++];
    
    if (byte < 0x80) {
      str += String.fromCharCode(byte);
    } else if (byte < 0xe0) {
      str += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (byte < 0xf0) {
      str += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    } else {
      const codePoint = ((byte & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const surrogate = codePoint - 0x10000;
      str += String.fromCharCode(0xd800 + (surrogate >> 10), 0xdc00 + (surrogate & 0x3ff));
    }
  }
  
  return str;
};

/**
 * Convertir hexadecimal a array de bytes
 */
const hexToBytes = (hex) => {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
};

/**
 * Convertir array de bytes a Base64 (sin usar Buffer)
 */
const bytesToBase64 = (bytes) => {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    const byte2 = i < bytes.length ? bytes[i++] : 0;
    const byte3 = i < bytes.length ? bytes[i++] : 0;
    
    const encoded1 = byte1 >> 2;
    const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
    const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
    const encoded4 = byte3 & 0x3f;
    
    result += base64Chars[encoded1];
    result += base64Chars[encoded2];
    result += i - 1 < bytes.length ? base64Chars[encoded3] : '=';
    result += i < bytes.length ? base64Chars[encoded4] : '=';
  }
  
  return result;
};

/**
 * Convertir Base64 a array de bytes (sin usar Buffer)
 */
const base64ToBytes = (base64) => {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  
  // Eliminar padding
  base64 = base64.replace(/=/g, '');
  
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = base64Chars.indexOf(base64[i]);
    const encoded2 = base64Chars.indexOf(base64[i + 1]);
    const encoded3 = base64Chars.indexOf(base64[i + 2]);
    const encoded4 = base64Chars.indexOf(base64[i + 3]);
    
    bytes.push((encoded1 << 2) | (encoded2 >> 4));
    
    if (encoded3 !== -1) {
      bytes.push(((encoded2 & 0x0f) << 4) | (encoded3 >> 2));
    }
    
    if (encoded4 !== -1) {
      bytes.push(((encoded3 & 0x03) << 6) | encoded4);
    }
  }
  
  return bytes;
};

/**
 * Hash simple usando algoritmo DJB2
 * @param {string} str - String a hashear
 * @returns {string} Hash en formato hexadecimal
 */
const simpleHash = (str) => {
  let hash = 5381;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convertir a hex de 64 caracteres (repetir para tener longitud consistente)
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return (hexHash + hexHash + hexHash + hexHash + hexHash + hexHash + hexHash + hexHash).substring(0, 64);
};

/**
 * XOR entre dos strings hexadecimales
 * @param {string} str1 - String hex 1
 * @param {string} str2 - String hex 2
 * @returns {string} Resultado del XOR en hex
 */
const xorStrings = (str1, str2) => {
  let result = '';
  const maxLen = Math.max(str1.length, str2.length);
  
  for (let i = 0; i < maxLen; i++) {
    const char1 = parseInt(str1[i % str1.length] || '0', 16);
    const char2 = parseInt(str2[i % str2.length] || '0', 16);
    result += (char1 ^ char2).toString(16);
  }
  
  return result.substring(0, 64); // Mantener longitud consistente
};

export default {
  generateDeviceKey,
  getDeviceKey,
  encryptPassword,
  decryptPassword,
  generateHash,
  verifyHash,
};
