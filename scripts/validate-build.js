#!/usr/bin/env node

/**
 * Script de validación de integridad del build
 * Verifica que no haya información sensible expuesta en el bundle
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Patrones que no deberían aparecer en producción
const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]*['"]/gi,
  /api[_-]?key\s*[:=]\s*['"][^'"]*['"]/gi,
  /secret\s*[:=]\s*['"][^'"]*['"]/gi,
  /console\.log\(/gi,
  /console\.error\(/gi,
  /console\.warn\(/gi,
  /debugger;/gi,
  // Patrones específicos de Supabase
  /eyJ[A-Za-z0-9-_]*\.eyJ[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*/g, // JWT tokens
  /https:\/\/[a-z]+\.supabase\.co/gi,
  // Información de desarrollo
  /localhost/gi,
  /127\.0\.0\.1/gi,
  /192\.168\./gi,
];

function validateBundle() {
  console.log('🔍 Validando integridad del bundle...');
  
  const bundlePath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(bundlePath)) {
    console.log('⚠️  No se encontró directorio de build, omitiendo validación.');
    return;
  }

  let issuesFound = false;

  function scanFile(filePath) {
    if (path.extname(filePath) !== '.js') return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    SENSITIVE_PATTERNS.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        console.error(`❌ Patrón sensible encontrado en ${filePath}:`);
        matches.forEach(match => {
          console.error(`   - ${match.substring(0, 50)}${match.length > 50 ? '...' : ''}`);
        });
        issuesFound = true;
      }
    });
  }

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else {
        scanFile(itemPath);
      }
    });
  }

  scanDirectory(bundlePath);

  if (issuesFound) {
    console.error('❌ Se encontraron problemas de seguridad en el bundle.');
    console.error('   Revisa los archivos marcados antes de publicar.');
    process.exit(1);
  } else {
    console.log('✅ Validación de integridad completada exitosamente.');
    
    // Generar hash del bundle para verificación
    const bundleHash = crypto.createHash('sha256');
    scanDirectory(bundlePath);
    
    console.log(`📋 Hash del bundle: ${bundleHash.digest('hex').substring(0, 16)}`);
  }
}

// Ejecutar validación
validateBundle();