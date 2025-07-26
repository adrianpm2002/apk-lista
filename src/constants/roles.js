// src/constants/roles.js

export const USER_ROLES = {
  ADMIN: 'admin',
  COLLECTOR: 'collector', 
  LISTERO: 'listero'
};

export const PERMISSIONS = {
  MANAGE_USERS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR],
  MANAGE_LOTTERIES: [USER_ROLES.ADMIN],
  MANAGE_SCHEDULES: [USER_ROLES.ADMIN],
  INSERT_RESULTS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR],
  VIEW_STATISTICS: [USER_ROLES.ADMIN, USER_ROLES.COLLECTOR]
};

export const hasPermission = (userRole, permission) => {
  return PERMISSIONS[permission]?.includes(userRole) || false;
};
