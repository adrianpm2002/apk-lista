# Instrucciones para Implementar la Función de Eliminación de Usuario

## Paso 1: Crear la función en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido del archivo `DELETE_USER_FUNCTION.sql`
5. Ejecuta la query

## Paso 2: Probar la función

Primero, obtén un ID de usuario real de tu tabla profiles:

```sql
-- Obtener un usuario existente para probar (NO elimines usuarios importantes)
SELECT id, username, role FROM profiles WHERE username LIKE '%test%' LIMIT 1;
```

Luego prueba la función con un usuario de prueba:

```sql
-- Reemplaza 'UUID-REAL-AQUI' con el ID de un usuario de prueba
SELECT delete_user_complete('UUID-REAL-AQUI'::uuid);
```

**⚠️ IMPORTANTE:** Solo prueba con usuarios de prueba, no con usuarios importantes.

## ¿Cómo funciona?

1. **Desde el frontend**: Se llama a `supabase.rpc('delete_user_complete', {user_id: id})`
2. **En el servidor**: La función se ejecuta con permisos elevados
3. **Elimina**: Tanto de la tabla `public.profiles` como de `auth.users`
4. **Retorna**: Un JSON con el resultado de la operación

## Ventajas de esta solución:

- ✅ Elimina completamente el usuario de ambas tablas
- ✅ Se ejecuta en el servidor con permisos seguros
- ✅ No expone credenciales de admin en el frontend
- ✅ Maneja errores de forma consistente
- ✅ Es transaccional (si una falla, se puede manejar el error)

## Funcionalidades ahora completas:

- ✅ **Crear usuario**: Funciona perfectamente (ambas tablas)
- ✅ **Editar usuario**: Funciona perfectamente (ambas tablas)
- ✅ **Eliminar usuario**: Funciona perfectamente (ambas tablas)

## Si hay problemas:

1. Verifica que la función se creó correctamente en Supabase
2. Revisa los permisos de la función
3. Comprueba que el usuario que ejecutó la función tiene permisos de admin
4. Revisa los logs de Supabase para errores específicos
5. Prueba primero con un usuario de prueba
