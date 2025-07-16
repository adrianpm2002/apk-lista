// Utilidades para formateo de fechas
// Este archivo puede ser eliminado si solo se necesita la función format de date-fns

// Funciones auxiliares para formateo de fechas
export const formatDate = (date, formatStr) => {
  if (!date) return '';
  
  const d = new Date(date);
  
  switch (formatStr) {
    case 'yyyy-MM-dd':
      return d.toISOString().slice(0, 10);
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
