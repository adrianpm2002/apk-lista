// Exportación de PDF para Web: abre una ventana con el HTML y ejecuta print

export async function exportPdf(html) {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}
