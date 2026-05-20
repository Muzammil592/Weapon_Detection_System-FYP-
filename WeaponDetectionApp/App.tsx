/**
 * Weapon Detection System App
 * React Native CLI Version
 */

import React from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, ThemeProvider, applyGlobalTypography } from './src/utils';
import ThemeStatusBar from './src/utils/ThemeStatusBar';
import { SocketProvider } from './src/utils/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';

// Ignore specific warnings
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Non-serializable values were found in the navigation state',
]);

applyGlobalTypography();

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <AuthProvider>
          <ThemeProvider>
            <ThemeStatusBar />
            <AppNavigator />
          </ThemeProvider>
        </AuthProvider>
      </SocketProvider>
    </GestureHandlerRootView>
  );
}

export default App;
