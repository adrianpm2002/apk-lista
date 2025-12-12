/**
 * Obtener timestamp actual en zona horaria de La Habana, Cuba
 * Formato: YYYY-MM-DD HH:MM:SS (compatible con Supabase)
 * @returns {string} Timestamp en formato YYYY-MM-DD HH:MM:SS
 */
export const getHavanaTimestamp = () => {
  const now = new Date();
  
  // Convertir a zona horaria de La Habana
  const havanaTime = now.toLocaleString('en-US', {
    timeZone: 'America/Havana',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parsear el string "MM/DD/YYYY, HH:MM:SS"
  const parts = havanaTime.split(', ');
  const dateParts = parts[0].split('/'); // [MM, DD, YYYY]
  const timePart = parts[1]; // HH:MM:SS
  
  // Formatear como YYYY-MM-DD HH:MM:SS
  return `${dateParts[2]}-${dateParts[0]}-${dateParts[1]} ${timePart}`;
};

// Funciones auxiliares para formateo de fechas
export const formatDate = (date, formatStr) => {
  if (!date) return '';
  
  const d = new Date(date);
  
  switch (formatStr) {
    case 'yyyy-MM-dd':
      return d.toLocaleDateString('en-CA'); // YYYY-MM-DD en zona horaria local
    case 'dd/MM/yyyy':
      return d.toLocaleDateString('es-ES');
    case 'HH:mm':
      return d.toTimeString().slice(0, 5);
    case 'dd/MM/yyyy HH:mm':
      return `${d.toLocaleDateString('es-ES')} ${d.toTimeString().slice(0, 5)}`;
    default:
      return d.toLocaleDateString();
  }
};

// Exportar format desde date-fns si está disponible
export { format } from 'date-fns';
