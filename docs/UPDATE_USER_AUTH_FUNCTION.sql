-- Función para actualizar tanto el perfil como la autenticación del usuario
-- Esta función debe ejecutarse en Supabase SQL Editor con permisos de servicio

CREATE OR REPLACE FUNCTION update_user_profile_and_auth(
  user_id UUID,
  new_username TEXT,
  new_role TEXT,
  new_assigned_collector UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Esto permite que la función se ejecute con permisos elevados
AS $$
DECLARE
  new_email TEXT;
  result JSON;
BEGIN
  -- Generar el nuevo email falso
  new_email := LOWER(new_username) || '@example.com';
  
  -- Actualizar la tabla de autenticación (requiere permisos elevados)
  UPDATE auth.users 
  SET email = new_email,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', new_username)
  WHERE id = user_id;
  
  -- Actualizar la tabla profiles
  UPDATE public.profiles 
  SET username = new_username,
      role = new_role,
      assigned_collector = new_assigned_collector
  WHERE id = user_id;
  
  -- Verificar que ambas actualizaciones fueron exitosas
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;
  
  -- Retornar resultado exitoso
  result := json_build_object(
    'success', true,
    'message', 'Usuario actualizado correctamente',
    'user_id', user_id,
    'new_email', new_email
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, retornar información del error
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al actualizar usuario'
    );
    RETURN result;
END;
$$;

-- Dar permisos a los usuarios autenticados para ejecutar esta función
GRANT EXECUTE ON FUNCTION update_user_profile_and_auth TO authenticated;
