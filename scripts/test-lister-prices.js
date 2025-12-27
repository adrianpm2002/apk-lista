/**
 * Script de prueba para validar el flujo de precios del listero
 * 
 * Pruebas:
 * 1. Obtener loterías del banco
 * 2. Obtener jugadas activas
 * 3. Crear un precio para el listero
 * 4. Listar precios (del listero y del banco)
 * 5. Asignar precio a clientes
 * 6. Verificar asignación
 * 
 * Uso: node scripts/test-lister-prices.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║           VALIDACIÓN DEL SISTEMA DE PRECIOS DEL LISTERO           ║
╚════════════════════════════════════════════════════════════════════╝

Este script te ayudará a validar que el sistema esté funcionando correctamente.

CHECKLIST DE VERIFICACIÓN:
═══════════════════════════

1. ✓ Migración de Base de Datos
   - ¿Has ejecutado el script 'add_id_listero_to_precio.sql' en Supabase?
   - Este script agrega la columna 'id_listero' a la tabla 'precio'
   
2. ✓ Estructura de Datos
   - La tabla 'precio' debe tener las columnas:
     * id (uuid)
     * nombre (text)
     * precios (jsonb)
     * id_banco (uuid)
     * id_listero (uuid, nullable)
     * id_loteria (uuid)
     * created_at (timestamp)

3. ✓ Permisos en Supabase
   - Los listeros deben poder:
     * INSERT en 'precio' con su propio id_listero
     * SELECT en 'precio' donde id_banco = su banco
     * UPDATE en 'precio' donde id_listero = su id
   
4. ✓ Relaciones
   - profiles.id_precio debe ser una FK a precio.id
   - precio.id_listero debe ser una FK a profiles.id
   - precio.id_banco debe ser una FK a banco.id
   - precio.id_loteria debe ser una FK a loteria.id

═══════════════════════════════════════════════════════════════════

FLUJO DE PRUEBA MANUAL:
═══════════════════════

A. CREAR PRECIO
   1. Abre la app como listero
   2. Ve a "Precios de Clientes"
   3. Selecciona una lotería
   4. Ingresa un nombre (ej: "Precio Día")
   5. Llena los campos de precio para las jugadas activas
   6. Presiona "Guardar"
   7. ✓ Verifica que aparezca en la sección "Precios del listero"

B. EDITAR PRECIO
   1. En la lista de precios, presiona "Editar"
   2. Modifica algún valor
   3. Presiona "Actualizar"
   4. ✓ Verifica que los cambios se guardaron

C. ASIGNAR A UN CLIENTE
   1. En la sección "Asignar a clientes"
   2. Presiona "Asignar" junto a un cliente
   3. Selecciona un precio del dropdown
   4. Presiona "Aplicar"
   5. ✓ Verifica que el precio asignado aparezca junto al cliente

D. ASIGNAR A TODOS
   1. Presiona "Aplicar a todos"
   2. Selecciona un precio
   3. Presiona "Aplicar"
   4. ✓ Verifica que todos los clientes tengan ese precio asignado

═══════════════════════════════════════════════════════════════════

VALIDACIONES AUTOMÁTICAS EN EL CÓDIGO:
═════════════════════════════════════

✓ Validación de entrada numérica
  - Solo acepta números y un punto decimal
  - Previene múltiples puntos decimales

✓ Validación de campos requeridos
  - Lotería: obligatorio
  - Nombre: obligatorio
  - Al menos un precio para una jugada: obligatorio

✓ Manejo de errores
  - Si falta la columna id_listero, muestra mensaje claro
  - Errores de red se capturan y muestran
  - Validaciones antes de guardar

✓ Filtrado de precios
  - Muestra precios del listero (scope: 'listero')
  - Muestra precios del banco (scope: 'banco')
  - Ambos pueden asignarse a clientes

✓ Estados de carga
  - Loading inicial
  - Saving al guardar
  - Assigning al asignar

═══════════════════════════════════════════════════════════════════

ERRORES COMUNES Y SOLUCIONES:
═══════════════════════════

❌ "La columna 'id_listero' no existe"
   → Ejecuta el script SQL en Supabase:
     scripts/db/add_id_listero_to_precio.sql

❌ "Permission denied for table precio"
   → Revisa las políticas RLS en Supabase
   → Asegúrate de que los listeros puedan INSERT/SELECT/UPDATE

❌ "No se encontró id_banco en el perfil"
   → Verifica que el perfil del listero tenga id_banco asignado

❌ "No se pudieron cargar los datos iniciales"
   → Verifica conexión a Supabase
   → Revisa las claves de API en supabaseClient.js

❌ Dropdown no muestra opciones
   → Verifica que haya loterías creadas para el banco
   → Verifica que haya jugadas activas configuradas

❌ No aparecen clientes
   → Verifica que el listero tenga clientes asignados
   → Los clientes deben tener lister_id = id del listero

═══════════════════════════════════════════════════════════════════

PREGUNTAS DE VERIFICACIÓN:
════════════════════════

`);

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function runChecklist() {
  const checks = [
    '¿Ejecutaste el script add_id_listero_to_precio.sql en Supabase? (s/n)',
    '¿El listero tiene id_banco asignado en su perfil? (s/n)',
    '¿Hay loterías creadas para el banco del listero? (s/n)',
    '¿Hay jugadas activas configuradas para esas loterías? (s/n)',
    '¿El listero tiene clientes asignados (con lister_id)? (s/n)',
  ];

  let allGood = true;
  
  for (const check of checks) {
    const answer = await ask(`${check}: `);
    if (answer !== 's' && answer !== 'si' && answer !== 'sí') {
      allGood = false;
      console.log('⚠️  Este requisito no está cumplido.\n');
    } else {
      console.log('✓ OK\n');
    }
  }

  console.log('\n' + '═'.repeat(70) + '\n');

  if (allGood) {
    console.log('🎉 ¡Todas las verificaciones pasaron!\n');
    console.log('El sistema debería estar funcionando correctamente.');
    console.log('Prueba el flujo manual descrito arriba para confirmar.\n');
  } else {
    console.log('⚠️  Hay requisitos sin cumplir.\n');
    console.log('Completa los pasos faltantes antes de continuar.');
    console.log('Revisa la sección "ERRORES COMUNES" arriba.\n');
  }

  rl.close();
}

runChecklist();
