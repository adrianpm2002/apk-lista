#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Buscar todos los archivos JS/JSX en src
const files = glob.sync('src/**/*.js', { 
  ignore: ['**/node_modules/**', '**/scripts/**']
});

let totalChanges = 0;

files.forEach(file => {
  const fullPath = path.resolve(file);
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  
  // Patrón para encontrar pointerEvents como prop y convertirlo a style
  const pattern = /(\s+)pointerEvents="([^"]+)"/g;
  
  let match;
  const changes = [];
  
  while ((match = pattern.exec(content)) !== null) {
    changes.push({
      original: match[0],
      replacement: ``,
      index: match.index,
      value: match[2]
    });
  }
  
  if (changes.length > 0) {
    console.log(`\n📁 ${file}:`);
    
    // Procesar cambios en orden inverso para mantener índices válidos
    changes.reverse().forEach(change => {
      const before = content.substring(0, change.index);
      const after = content.substring(change.index + change.original.length);
      
      // Buscar el style existente en la misma línea o línea anterior
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = content.indexOf('\n', change.index);
      const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
      
      // Buscar si ya existe style={}
      const stylePattern = /style=\{([^}]+)\}/;
      const styleMatch = currentLine.match(stylePattern);
      
      if (styleMatch) {
        // Ya existe style, agregar pointerEvents
        const existingStyle = styleMatch[1];
        let newStyle;
        
        if (existingStyle.includes('[')) {
          // Es un array de estilos, agregar al final
          newStyle = existingStyle.replace(/\]$/, `, { pointerEvents: '${change.value}' }]`);
        } else {
          // Es un objeto, convertir a array
          newStyle = `[${existingStyle}, { pointerEvents: '${change.value}' }]`;
        }
        
        content = before + after;
        content = content.replace(stylePattern, `style={${newStyle}}`);
      } else {
        // No existe style, agregar uno nuevo
        const tagMatch = currentLine.match(/<(\w+)([^>]*)/);
        if (tagMatch) {
          const beforeTag = before;
          const afterTag = after;
          const newStyleProp = ` style={{ pointerEvents: '${change.value}' }}`;
          
          // Insertar el style justo antes del cierre del tag
          const insertPoint = change.index;
          content = beforeTag + newStyleProp + afterTag;
        } else {
          content = before + after;
        }
      }
      
      console.log(`   ✅ Convertido pointerEvents="${change.value}" a style`);
      changed = true;
      totalChanges++;
    });
    
    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`   💾 Archivo actualizado`);
    }
  }
});

console.log(`\n🎉 Conversión completada!`);
console.log(`📊 Total de cambios: ${totalChanges}`);
console.log(`📁 Archivos procesados: ${files.length}`);

if (totalChanges > 0) {
  console.log(`\n⚠️  Recomendación: Revisar manualmente que los cambios sean correctos`);
  console.log(`   y ejecutar las pruebas para verificar que todo funciona.`);
}
