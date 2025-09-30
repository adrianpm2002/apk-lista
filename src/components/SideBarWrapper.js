import React from 'react';
import { SideBar } from './SideBar';

const SideBarWrapper = (props) => {
  console.log('🔧 SideBarWrapper - Props received:', { isVisible: props.isVisible, role: props.role });
  
  // Solo renderizar el SideBar cuando es visible
  if (!props.isVisible) {
    return null;
  }

  // Usar importación directa temporalmente para debugging
  return <SideBar {...props} />;
};

// Importar SideBarToggle normalmente ya que es un componente simple
export { SideBarToggle } from './SideBar';
export default SideBarWrapper;
