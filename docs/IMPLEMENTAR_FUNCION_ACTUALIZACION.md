# Instrucciones para Implementar la Función de Actualización de Usuario

## Paso 1: Crear la función en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor**
3. Crea una nueva query
4. Copia y pega el contenido del archivo `UPDATE_USER_AUTH_FUNCTION.sql`
5. Ejecuta la query

## Paso 2: Verificar permisos

La función está configurada con `SECURITY DEFINER` lo que significa que se ejecuta con los permisos del usuario que la creó (probablemente permisos de admin).

## Paso 3: Probar la función

Primero, obtén un ID de usuario real de tu tabla profiles:

```sql
-- Obtener un usuario existente para probar
SELECT id, username, role FROM profiles LIMIT 1;
```

Luego prueba la función con el ID real:

```sql
-- Reemplaza 'UUID-REAL-AQUI' con el ID que obtuviste arriba
SELECT update_user_profile_and_auth(
  'UUID-REAL-AQUI'::uuid,
  'username_prueba',
  'collector',
  null
);
```

**Ejemplo con UUID real:**
```sql
SELECT update_user_profile_and_auth(
  '22eaf503-5d75-4e8a-9e37-d6c52924a104'::uuid,
  'usuario_actualizado',
  'collector',
  null
);
```

## ¿Cómo funciona?

1. **Desde el frontend**: Se llama a `supabase.rpc('update_user_profile_and_auth', {...})`
2. **En el servidor**: La función se ejecuta con permisos elevados
3. **Actualiza**: Tanto la tabla `auth.users` como `public.profiles`
4. **Retorna**: Un JSON con el resultado de la operación

## Ventajas de esta solución:

- ✅ Mantiene sincronizadas ambas tablas
- ✅ Se ejecuta en el servidor con permisos seguros
- ✅ No expone credenciales de admin en el frontend
- ✅ Maneja errores de forma consistente
- ✅ Es transaccional (si una falla, ambas fallan)

## Si hay problemas:

1. Verifica que la función se creó correctamente
2. Revisa los permisos de la función
3. Comprueba que el usuario que ejecutó la función tiene permisos de admin
4. Revisa los logs de Supabase para errores específicos
