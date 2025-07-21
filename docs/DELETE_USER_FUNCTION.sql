-- Función para eliminar tanto el perfil como la autenticación del usuario
-- Esta función debe ejecutarse en Supabase SQL Editor con permisos de servicio

CREATE OR REPLACE FUNCTION delete_user_complete(
  user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Esto permite que la función se ejecute con permisos elevados
AS $$
DECLARE
  result JSON;
  user_exists BOOLEAN;
BEGIN
  -- Verificar que el usuario existe en profiles
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = user_id) INTO user_exists;
  
  IF NOT user_exists THEN
    result := json_build_object(
      'success', false,
      'error', 'Usuario no encontrado',
      'message', 'El usuario no existe en la base de datos'
    );
    RETURN result;
  END IF;
  
  -- Eliminar de la tabla profiles primero
  DELETE FROM public.profiles WHERE id = user_id;
  
  -- Eliminar de la tabla de autenticación
  DELETE FROM auth.users WHERE id = user_id;
  
  -- Retornar resultado exitoso
  result := json_build_object(
    'success', true,
    'message', 'Usuario eliminado completamente',
    'user_id', user_id
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, retornar información del error
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error al eliminar usuario'
    );
    RETURN result;
END;
$$;

-- Dar permisos a los usuarios autenticados para ejecutar esta función
GRANT EXECUTE ON FUNCTION delete_user_complete TO authenticated;
