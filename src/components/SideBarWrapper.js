import React, { Suspense } from 'react';
import { View, Text } from 'react-native';

// Importación lazy del SideBar para mejor rendimiento
const LazySideBar = React.lazy(() => import('./SideBar').then(module => ({ default: module.SideBar })));

// Componente de carga mientras se carga el SideBar
const SideBarFallback = ({ isDarkMode }) => (
  <View style={{ 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#2c3e50' : '#ffffff'
  }}>
    <Text style={{ color: isDarkMode ? '#ecf0f1' : '#2c3e50' }}>
      Cargando menú...
    </Text>
  </View>
);

const SideBarWrapper = (props) => {
  // Solo renderizar el SideBar cuando es visible
  if (!props.isVisible) {
    return null;
  }

  return (
    <Suspense fallback={<SideBarFallback isDarkMode={props.isDarkMode} />}>
      <LazySideBar {...props} />
    </Suspense>
  );
};

// Importar SideBarToggle normalmente ya que es un componente simple
export { SideBarToggle } from './SideBar';
export default SideBarWrapper;
