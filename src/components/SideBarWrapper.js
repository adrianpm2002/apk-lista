import React from 'react';
import { SideBar } from './SideBar';

const SideBarWrapper = (props) => {
  // Solo renderizar el SideBar cuando es visible
  if (!props.isVisible) {
    return null;
  }

  return <SideBar {...props} />;
};

// Importar SideBarToggle normalmente ya que es un componente simple
export { SideBarToggle } from './SideBar';
export default SideBarWrapper;
