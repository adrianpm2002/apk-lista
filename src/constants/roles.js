// src/constants/roles.js

export const USER_ROLES = {
  ADMIN: 'admin',
  COLLECTOR: 'collector', 
  LISTERO: 'listero'
};

// Nuevo rol: CLIENT (usuario final que introduce jugadas)
USER_ROLES.CLIENT = 'client';

export const PERMISSIONS = {
  MANAGE_USERS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR],
  MANAGE_LOTTERIES: [USER_ROLES.ADMIN],
  MANAGE_SCHEDULES: [USER_ROLES.ADMIN],
  INSERT_RESULTS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR],
  VIEW_STATISTICS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR]
};

// Permitir que clientes también inserten jugadas (solo interfaz y checks adicionales en runtime)
PERMISSIONS.INSERT_RESULTS = Array.from(new Set([...(PERMISSIONS.INSERT_RESULTS || []), USER_ROLES.CLIENT]));

export const hasPermission = (userRole, permission) => {
  return PERMISSIONS[permission]?.includes(userRole) || false;
};
