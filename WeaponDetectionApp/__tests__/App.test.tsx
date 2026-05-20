/**
 * @format
 */

import 'react-native';
import React from 'react';

// Note: import explicitly to use the types shipped with jest.
import {it, jest} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('../src/navigation/AppNavigator', () => () => null);
jest.mock('../src/utils/ThemeStatusBar', () => () => null);
jest.mock('../src/utils/SocketContext', () => ({
  SocketProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/utils', () => ({
  AuthProvider: ({children}: {children: React.ReactNode}) => children,
  ThemeProvider: ({children}: {children: React.ReactNode}) => children,
  applyGlobalTypography: jest.fn(),
}));

import App from '../App';

it('renders correctly', () => {
  renderer.create(<App />);
});
