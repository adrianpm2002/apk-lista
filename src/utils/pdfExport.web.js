// Exportación de PDF para Web: abre una ventana con el HTML y ejecuta print

export async function exportPdf(html) {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      
      // Esperar a que se carguen los estilos y el contenido antes de imprimir
      await new Promise(resolve => {
        if (w.document.readyState === 'complete') {
          resolve();
        } else {
          w.addEventListener('load', resolve);
        }
      });
      
      // Delay adicional para asegurar que todos los estilos se hayan aplicado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      w.focus();
      w.print();
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error en exportPdf web:', e);
    return false;
  }
}
