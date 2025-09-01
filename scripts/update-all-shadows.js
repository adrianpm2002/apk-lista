#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Lista de archivos a actualizar (todos los restantes del reporte)
const FILES_TO_UPDATE = [
  'src/components/CollectorDataTable.js',
  'src/components/DataTable.js',
  'src/components/FeedbackBanner.js',
  'src/components/HammerButton.js',
  'src/components/InfoButton.js',
  'src/components/KPICard.js',
  'src/components/LimitedNumbersButton.js',
  'src/components/ListButton.js',
  'src/components/ListerLimitsButton.js',
  'src/components/ModeSelector.js',
  'src/components/PricesButton.js',
  'src/components/PricingInfoButton.js',
  'src/components/SideBar.js',
  'src/components/StatisticsChart.js',
  'src/components/TextModeInfoButton.js',
  'src/components/TopBar.js',
  'src/components/TopBar_new.js',
  'src/screens/CreateUserScreen.js',
  'src/screens/InsertResultsScreen.js',
  'src/screens/limitNumero.js',
  'src/screens/ManageLotteriesScreen.js',
  'src/screens/ManagePricesScreen.js',
  'src/screens/StatisticsScreen.js',
  'src/screens/TextMode2Screen.js',
  'src/screens/TextModeScreen.js',
  'src/screens/VaultModeScreen.js',
  'src/screens/VisualModeScreen.js'
];

function updateShadowStyles(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Verificar si ya tiene el import
    const hasImport = content.includes('createShadowStyle');
    const hasShadowStyles = content.includes('shadowColor:');
    
    if (!hasShadowStyles) {
      console.log(`⏭️  ${filePath} - No shadow styles found`);
      return;
    }
    
    // Agregar import si no existe
    if (!hasImport) {
      // Encontrar el último import
      const imports = content.match(/^import.*from.*['"];$/gm);
      if (imports) {
        const lastImport = imports[imports.length - 1];
        const importToAdd = "import { createShadowStyle } from '../utils/shadowUtils';";
        
        // Calcular la ruta relativa correcta
        const depth = filePath.split('/').length - 2; // -2 porque no contamos src/ y el archivo
        const relativePath = '../'.repeat(depth) + 'utils/shadowUtils';
        const correctImport = `import { createShadowStyle } from '${relativePath}';`;
        
        content = content.replace(lastImport, lastImport + '\n' + correctImport);
      }
    }
    
    // Reemplazar patrones de shadow
    content = content.replace(
      /shadowColor:\s*['"][^'"]*['"],?\s*shadowOffset:\s*\{\s*width:\s*\d+,?\s*height:\s*(-?\d+),?\s*\},?\s*shadowOpacity:\s*[\d.]+,?\s*shadowRadius:\s*[\d.]+,?\s*elevation:\s*\d+,?/g,
      (match) => {
        // Extraer valores
        const colorMatch = match.match(/shadowColor:\s*['"]([^'"]*)['"],?/);
        const offsetMatch = match.match(/height:\s*(-?\d+)/);
        const opacityMatch = match.match(/shadowOpacity:\s*([\d.]+)/);
        const radiusMatch = match.match(/shadowRadius:\s*([\d.]+)/);
        const elevationMatch = match.match(/elevation:\s*(\d+)/);
        
        const color = colorMatch ? colorMatch[1] : '#000';
        const offsetY = offsetMatch ? offsetMatch[1] : '2';
        const opacity = opacityMatch ? opacityMatch[1] : '0.1';
        const radius = radiusMatch ? radiusMatch[1] : '3';
        const elevation = elevationMatch ? elevationMatch[1] : '3';
        
        return `...createShadowStyle({
      color: '${color}',
      offsetY: ${offsetY},
      opacity: ${opacity},
      radius: ${radius},
      elevation: ${elevation},
    }),`;
      }
    );
    
    // Escribir el archivo actualizado
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ ${filePath} - Updated successfully`);
    
  } catch (error) {
    console.error(`❌ ${filePath} - Error: ${error.message}`);
  }
}

// Ejecutar actualización
console.log('🚀 Updating shadow styles in all remaining files...\n');

FILES_TO_UPDATE.forEach(updateShadowStyles);

console.log('\n✨ Shadow styles update completed!');
