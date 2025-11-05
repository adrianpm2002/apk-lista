import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio para encriptación de credenciales offline
 * Usa expo-crypto para generar claves y encriptar datos sensibles
 */

const DEVICE_KEY_STORAGE = '@device_encryption_key';
const ENCRYPTION_ALGORITHM = 'AES-256-CBC';

/**
 * Generar clave única por dispositivo
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

    // Generar nueva clave aleatoria (32 bytes = 256 bits para AES-256)
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const key = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

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
 * Usa un approach simple: XOR con la clave + Base64
 * (Para producción, considerar usar expo-crypto con AES real o react-native-aes-crypto)
 * 
 * @param {string} password - Contraseña en texto plano
 * @param {string} key - Clave de encriptación (opcional, usa clave del dispositivo si no se provee)
 * @returns {Promise<string>} Contraseña encriptada en Base64
 */
export const encryptPassword = async (password, key = null) => {
  try {
    const encryptionKey = key || await generateDeviceKey();
    
    // Convertir password y key a arrays de bytes
    const passwordBytes = stringToBytes(password);
    const keyBytes = hexToBytes(encryptionKey);

    // XOR simple: repetir la clave si es más corta que el password
    const encryptedBytes = passwordBytes.map((byte, index) => {
      const keyByte = keyBytes[index % keyBytes.length];
      return byte ^ keyByte;
    });

    // Convertir a Base64
    const encryptedBase64 = bytesToBase64(encryptedBytes);
    
    console.log('[Encryption] Password encrypted successfully');
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
    const encryptionKey = key || await getDeviceKey();
    
    if (!encryptionKey) {
      throw new Error('No encryption key found');
    }

    // Convertir de Base64 a bytes
    const encryptedBytes = base64ToBytes(encryptedPassword);
    const keyBytes = hexToBytes(encryptionKey);

    // XOR para desencriptar (mismo algoritmo que encriptar)
    const decryptedBytes = encryptedBytes.map((byte, index) => {
      const keyByte = keyBytes[index % keyBytes.length];
      return byte ^ keyByte;
    });

    // Convertir bytes a string
    const decryptedPassword = bytesToString(decryptedBytes);
    
    console.log('[Encryption] Password decrypted successfully');
    return decryptedPassword;
  } catch (error) {
    console.error('[Encryption] Error decrypting password:', error);
    throw error;
  }
};

/**
 * Generar hash de una cadena (para verificación)
 * @param {string} text - Texto a hashear
 * @returns {Promise<string>} Hash en formato hexadecimal
 */
export const generateHash = async (text) => {
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      text
    );
    return digest;
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
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
};

/**
 * Convertir array de bytes a string (UTF-8)
 */
const bytesToString = (bytes) => {
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
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
 * Convertir array de bytes a Base64
 */
const bytesToBase64 = (bytes) => {
  if (Platform.OS === 'web') {
    // En web, usar btoa
    const binary = String.fromCharCode.apply(null, bytes);
    return btoa(binary);
  } else {
    // En nativo, usar Buffer (disponible via react-native polyfills)
    const buffer = Buffer.from(bytes);
    return buffer.toString('base64');
  }
};

/**
 * Convertir Base64 a array de bytes
 */
const base64ToBytes = (base64) => {
  if (Platform.OS === 'web') {
    // En web, usar atob
    const binary = atob(base64);
    return Array.from(binary).map(char => char.charCodeAt(0));
  } else {
    // En nativo, usar Buffer
    const buffer = Buffer.from(base64, 'base64');
    return Array.from(buffer);
  }
};

export default {
  generateDeviceKey,
  getDeviceKey,
  encryptPassword,
  decryptPassword,
  generateHash,
  verifyHash,
};
