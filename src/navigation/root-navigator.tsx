import React from 'react';
import type { ReactElement } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoggerService } from '@/infrastructure/logger';
import type { VerificationRuntimeEngine } from '@/runtime/engine';

import { ROUTE_NAMES } from './routes';
import type { RootStackParamList } from './routes';
import { RuntimeScreen } from './runtime-screen';

const FILE_NAME = 'root-navigator.tsx';
const Stack = createNativeStackNavigator<RootStackParamList>();

export interface RootNavigatorProps {
  readonly runtimeEngine: VerificationRuntimeEngine;
}

/**
 * Route registration only — which screen follows Login is a Workflow Engine
 * decision (docs/04-Runtime/01-Verification-Runtime-Engine.md §9), not made
 * here. The Workflow Engine is still a skeleton
 * (src/runtime/workflow/README.md), so Login stays the only registered
 * route until it's implemented and more screens are wired in.
 */
export function RootNavigator({ runtimeEngine }: RootNavigatorProps): ReactElement {
  LoggerService.info(`${FILE_NAME}: RootNavigator: rendering`, { initialRouteName: ROUTE_NAMES.LOGIN });

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTE_NAMES.LOGIN} screenOptions={{ headerShown: false }}>
        <Stack.Screen name={ROUTE_NAMES.LOGIN}>
          {() => <RuntimeScreen screenId={ROUTE_NAMES.LOGIN} runtimeEngine={runtimeEngine} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
