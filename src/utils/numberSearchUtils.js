/**
 * Utilidades para búsqueda de números considerando formas canónicas
 * de parle (4 dígitos) y tripleta (6 dígitos)
 */

/**
 * Genera todas las variantes de un número considerando su forma canónica
 * @param {string} searchTerm - Término de búsqueda (solo números)
 * @returns {string[]} Array con todas las variantes posibles
 */
export const generateNumberVariants = (searchTerm) => {
  const digits = searchTerm.replace(/[^0-9]/g, '');
  
  if (!digits) return [];
  
  // Parle: 4 dígitos - 2 variantes (invertir pares)
  if (digits.length === 4) {
    const a = digits.slice(0, 2);
    const b = digits.slice(2, 4);
    return [
      digits,    // 1234
      b + a      // 3412
    ];
  }
  
  // Tripleta: 6 dígitos - 6 permutaciones (todas las combinaciones de 3 pares)
  if (digits.length === 6) {
    const p1 = digits.slice(0, 2);
    const p2 = digits.slice(2, 4);
    const p3 = digits.slice(4, 6);
    
    // Generar las 6 permutaciones de los 3 pares
    return [
      p1 + p2 + p3,  // 123456
      p1 + p3 + p2,  // 125634
      p2 + p1 + p3,  // 341256
      p2 + p3 + p1,  // 345612
      p3 + p1 + p2,  // 561234
      p3 + p2 + p1   // 563412
    ];
  }
  
  // Para otros casos (2, 3, 5 dígitos, etc.) búsqueda exacta
  return [digits];
};

/**
 * Verifica si un número coincide con el término de búsqueda considerando variantes canónicas
 * @param {string} numero - Número a verificar
 * @param {string} searchTerm - Término de búsqueda
 * @returns {boolean} true si coincide con alguna variante
 */
export const matchesSearchTerm = (numero, searchTerm) => {
  if (!searchTerm) return true;
  
  const cleanSearch = searchTerm.replace(/[^0-9]/g, '');
  if (!cleanSearch) return true;
  
  const cleanNumero = (numero || '').replace(/[^0-9]/g, '');
  if (!cleanNumero) return false;
  
  // Generar todas las variantes del término de búsqueda
  const variants = generateNumberVariants(cleanSearch);
  
  // Verificar si el número coincide con alguna variante
  return variants.some(variant => cleanNumero === variant);
};

/**
 * Formatea el input permitiendo solo números
 * @param {string} text - Texto a formatear
 * @returns {string} Solo los dígitos numéricos
 */
export const formatNumberInput = (text) => {
  return text.replace(/[^0-9]/g, '');
};
