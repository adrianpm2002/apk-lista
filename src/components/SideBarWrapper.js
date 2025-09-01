import React from 'react';
import { SideBar as MemoizedSideBar, SideBarToggle } from './SideBar';

const SideBarWrapper = (props) => {
  return <MemoizedSideBar {...props} />;
};

export default SideBarWrapper;
export { SideBarToggle };
