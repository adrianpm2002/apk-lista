import { Platform } from 'react-native';

export const getAccessibilityRole = (webRole, mobileRole = 'none') => {
  // Roles válidos en Android/iOS
  const validMobileRoles = [
    'none', 'button', 'link', 'search', 'image', 'keyboardkey',
    'text', 'adjustable', 'imagebutton', 'header', 'summary',
    'alert', 'checkbox', 'combobox', 'menu', 'menubar', 'menuitem',
    'progressbar', 'radio', 'radiogroup', 'scrollbar', 'spinbutton',
    'switch', 'tab', 'tablist', 'timer', 'toolbar'
  ];

  if (Platform.OS === 'web') {
    return webRole;
  }

  // Verificar si el mobileRole es válido
  if (validMobileRoles.includes(mobileRole)) {
    return mobileRole;
  }

  // Mapeo de roles web a móvil
  const roleMapping = {
    'navigation': 'menu',
    'dialog': 'none', // dialog no es válido en móvil, usar none
    'article': 'none',
    'banner': 'header',
    'complementary': 'none',
    'contentinfo': 'none',
    'form': 'none',
    'main': 'none',
    'region': 'none',
    'search': 'search'
  };

  return roleMapping[webRole] || 'none';
};

export const getAccessibilityProps = (role, label, additionalProps = {}) => {
  return {
    accessible: true,
    accessibilityRole: getAccessibilityRole(role),
    accessibilityLabel: label,
    ...additionalProps
  };
};
