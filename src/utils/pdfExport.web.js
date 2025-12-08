// Exportación de PDF para Web: abre una ventana con el HTML y ejecuta print

export async function exportPdf(html) {
  try {
    const w = window.open('', '_blank');
    if (!w) return false;
    
    w.document.open();
    w.document.write(html);
    w.document.close();
    
    // Esperar a que se carguen los estilos y el contenido
    await new Promise((resolve) => {
      if (w.document.readyState === 'complete') {
        resolve();
      } else {
        w.addEventListener('load', resolve);
        // Timeout de seguridad por si load no se dispara
        setTimeout(resolve, 500);
      }
    });
    
    // Pequeña pausa adicional para asegurar que los estilos se apliquen
    await new Promise(resolve => setTimeout(resolve, 300));
    
    w.focus();
    w.print();
    
    return true;
  } catch (e) {
    console.error('Error en exportPdf web:', e);
    return false;
  }
}
