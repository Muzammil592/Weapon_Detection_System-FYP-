/**
 * Weapon Detection System App
 * React Native CLI Version
 */

import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/utils';
import { SocketProvider } from './src/utils/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';

// Ignore specific warnings
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Non-serializable values were found in the navigation state',
]);

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1523" />
      <SocketProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SocketProvider>
    </GestureHandlerRootView>
  );
}

export default App;
