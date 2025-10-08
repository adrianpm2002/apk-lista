import React from 'react';
import RoleBasedStatisticsRouter from './statistics/RoleBasedStatisticsRouter';

const StatisticsScreen = ({ navigation, route, onModeVisibilityChange }) => {
  return (
    <RoleBasedStatisticsRouter
      navigation={navigation}
      route={route}
      onModeVisibilityChange={onModeVisibilityChange}
    />
  );
};

export default StatisticsScreen;