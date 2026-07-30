import React from 'react';
import type { ReactElement } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '@/features/authentication';
import { LoggerService } from '@/infrastructure/logger';

import { ROUTE_NAMES } from './routes';
import type { RootStackParamList } from './routes';

const FILE_NAME = 'root-navigator.tsx';
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Route registration only — each screen is a normal React component that
 * owns its own content and decides where it navigates next. Login is the
 * only registered route so far; further screens get registered here as
 * their features are built.
 */
export function RootNavigator(): ReactElement {
  LoggerService.info(`${FILE_NAME}: RootNavigator: rendering`, {
    initialRouteName: ROUTE_NAMES.LOGIN,
  });

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTE_NAMES.LOGIN} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTE_NAMES.LOGIN} component={LoginScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
