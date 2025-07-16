// Wrapper para date-fns que maneja errores gracefully
let format;

try {
  // Intentar importar date-fns
  const dateFns = require('date-fns');
  format = dateFns.format;
} catch (error) {
  console.warn('date-fns not available, using fallback:', error);
  
  // Fallback simple para formateo de fechas
  format = (date, formatStr) => {
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
}

export { format };
