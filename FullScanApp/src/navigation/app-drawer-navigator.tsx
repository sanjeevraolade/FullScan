import React from 'react';
import type { ReactElement } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import { CaseListScreen } from '@/features/cases';
import { LoggerService } from '@/infrastructure/logger';

import { AppDrawerContent } from './app-drawer-content';
import { ROUTE_NAMES } from './routes';
import type { DrawerParamList } from './routes';

const FILE_NAME = 'app-drawer-navigator.tsx';
const Drawer = createDrawerNavigator<DrawerParamList>();

/**
 * Post-login shell, registered as the single "Main" route on the root stack
 * (see root-navigator.tsx). Screens are added here as drawer destinations
 * become real features — today only Case List exists.
 */
export function AppDrawerNavigator(): ReactElement {
  LoggerService.info(`${FILE_NAME}: AppDrawerNavigator: rendering`);

  return (
    <Drawer.Navigator
      initialRouteName={ROUTE_NAMES.CASE_LIST}
      screenOptions={{ headerShown: true }}
      drawerContent={(props) => {
        LoggerService.info(`${FILE_NAME}: AppDrawerNavigator.drawerContent: rendering drawer`, {
          routeName: props.state.routeNames[props.state.index],
        });

        return <AppDrawerContent {...props} />;
      }}
    >
      <Drawer.Screen name={ROUTE_NAMES.CASE_LIST} component={CaseListScreen} />
    </Drawer.Navigator>
  );
}
