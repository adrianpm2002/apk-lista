import React from 'react';
import RoleBasedStatisticsRouter from './RoleBasedStatisticsRouter';

/**
 * Wrapper component that maintains backward compatibility
 * while providing role-based statistics routing
 */
const StatisticsScreenWrapper = ({ navigation, onModeVisibilityChange, ...otherProps }) => {
  return (
    <RoleBasedStatisticsRouter
      navigation={navigation}
      onModeVisibilityChange={onModeVisibilityChange}
      {...otherProps}
    />
  );
};

export default StatisticsScreenWrapper;