#!/usr/bin/env node

/**
 * Script para migrar estilos shadow deprecados a la nueva API
 * Encuentra y reemplaza los estilos shadowColor, shadowOffset, etc. con createShadowStyle
 */

const fs = require('fs');
const path = require('path');

// Lista de archivos que ya fueron actualizados manualmente
const ALREADY_UPDATED = [
  'src/components/DropdownPicker.js',
  'src/components/MultiSelectDropdown.js',
  'src/components/ActionButton.js',
  'src/components/InputField.js',
  'src/screens/LoginScreen.js',
  'src/utils/shadowUtils.js' // contiene las definiciones, no debe ser modificado
];

// Función para encontrar archivos con estilos shadow
function findFilesWithShadowStyles(dir) {
  const files = [];
  
  function walkDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        
        // Saltar archivos ya actualizados
        if (ALREADY_UPDATED.some(updated => relativePath.endsWith(updated))) {
          continue;
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('shadowColor:') || content.includes('shadowOffset:')) {
          files.push({
            path: fullPath,
            relativePath,
            content
          });
        }
      }
    }
  }
  
  walkDir(dir);
  return files;
}

// Función para generar el reporte
function generateReport() {
  const srcDir = path.join(process.cwd(), 'src');
  const files = findFilesWithShadowStyles(srcDir);
  
  console.log('📊 REPORTE DE ARCHIVOS CON ESTILOS SHADOW DEPRECADOS');
  console.log('='.repeat(60));
  console.log(`Total de archivos encontrados: ${files.length}`);
  console.log('');
  
  if (files.length === 0) {
    console.log('✅ ¡No se encontraron archivos con estilos shadow deprecados!');
    return;
  }
  
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.relativePath}`);
    
    // Contar ocurrencias de shadow styles
    const shadowMatches = file.content.match(/shadowColor:|shadowOffset:|shadowOpacity:|shadowRadius:/g);
    if (shadowMatches) {
      console.log(`   └─ ${shadowMatches.length} propiedades shadow encontradas`);
    }
  });
  
  console.log('');
  console.log('📝 ARCHIVOS YA ACTUALIZADOS:');
  ALREADY_UPDATED.forEach(file => {
    console.log(`✅ ${file}`);
  });
  
  console.log('');
  console.log('🔧 PASOS PARA ACTUALIZAR:');
  console.log('1. Importar: import { createShadowStyle, shadowPresets } from "../utils/shadowUtils";');
  console.log('2. Reemplazar estilos shadow con: ...createShadowStyle({ ... })');
  console.log('3. O usar presets: ...createShadowStyle(shadowPresets.medium)');
}

// Ejecutar el reporte
if (require.main === module) {
  generateReport();
}

module.exports = { findFilesWithShadowStyles, generateReport };
