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

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Application />
    </SafeAreaProvider>
  );
}

export default App;
