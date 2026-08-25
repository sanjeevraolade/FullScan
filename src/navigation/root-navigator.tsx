import React from 'react';
import type { ReactElement } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '@/features/authentication';
import { CaseCameraScreen, CaseDetailsScreen, CasePhotoViewerScreen } from '@/features/cases';
import { LoggerService } from '@/infrastructure/logger';

import { AppDrawerNavigator } from './app-drawer-navigator';
import { ROUTE_NAMES } from './routes';
import type { RootStackParamList } from './routes';

const FILE_NAME = 'root-navigator.tsx';
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Route registration only — each screen is a normal React component that
 * owns its own content and decides where it navigates next. Screens get
 * registered here as their features are built.
 */
export function RootNavigator(): ReactElement {
  LoggerService.info(`${FILE_NAME}: RootNavigator: rendering`, {
    initialRouteName: ROUTE_NAMES.LOGIN,
  });

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTE_NAMES.LOGIN} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTE_NAMES.LOGIN} component={LoginScreen} />
        <Stack.Screen name={ROUTE_NAMES.MAIN} component={AppDrawerNavigator} />
        <Stack.Screen name={ROUTE_NAMES.CASE_DETAILS} component={CaseDetailsScreen} options={{ headerShown: true }} />
        <Stack.Screen name={ROUTE_NAMES.CASE_CAMERA} component={CaseCameraScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name={ROUTE_NAMES.CASE_PHOTO_VIEWER}
          component={CasePhotoViewerScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
