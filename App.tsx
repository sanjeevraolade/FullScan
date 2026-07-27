/**
 * FullScan Mobile Platform
 *
 * @format
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from '@gluestack-ui/themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Application } from '@/app';
import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'App.tsx';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  LoggerService.info(`${FILE_NAME}: App: rendering root`, { isDarkMode });

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Application />
    </SafeAreaProvider>
  );
}

export default App;
