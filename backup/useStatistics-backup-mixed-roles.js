// ARCHIVO DE BACKUP - Hook original con todos los roles mezclados
// Este archivo se mantiene como referencia para debugging
// Fecha: 9 de septiembre de 2025
// 
// NUEVO ENFOQUE:
// - useListeroStatistics.js para listeros
// - useCollectorStatistics.js para colectores  
// - useAdminStatistics.js para administradores
//
// Los archivos nuevos están en /src/hooks/ y son específicos por rol

export const BACKUP_INFO = {
  originalFile: 'useStatistics.js',
  reason: 'Separación por roles para mejor mantenimiento',
  newFiles: [
    'useListeroStatistics.js',
    'useCollectorStatistics.js', 
    'useAdminStatistics.js'
  ],
  date: '2025-09-09'
};
