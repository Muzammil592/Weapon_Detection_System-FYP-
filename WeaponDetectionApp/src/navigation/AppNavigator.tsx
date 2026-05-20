/**
 * Main Navigation Setup
 * React Navigation configuration for the app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import { RootStackParamList, MainTabsParamList } from '../utils/types';
import { useAuth, useTheme, APP_TYPOGRAPHY } from '../utils';

// Screens
import {
  LoginScreen,
  UserSignupScreen,
  AuthoritySignupScreen,
  DashboardScreen,
  AuthorityDashboardScreen,
  LiveFeedScreen,
  ExploreScreen,
  NotificationDetailsScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// Bottom Tab Navigator
function MainTabs() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAuthority = user?.role === 'authority';
  const DashboardComponent = isAuthority ? AuthorityDashboardScreen : DashboardScreen;

  // For authorities: hide the tab bar and only show Dashboard
  if (isAuthority) {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            display: 'none',
            backgroundColor: colors.tab.background,
          },
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardComponent} options={{ title: 'Home' }} />
      </Tab.Navigator>
    );
  }

  // For users: full tab bar with Home, Live, Notifications, Explore
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'LiveFeed':
              iconName = focused ? 'videocam' : 'videocam-outline';
              break;
            case 'Notifications':
            case 'AllNotifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Explore':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: colors.tab.background,
          borderTopColor: colors.border.dark,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: APP_TYPOGRAPHY.mediumFontFamily,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardComponent}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="LiveFeed" 
        component={LiveFeedScreen}
        options={{ title: 'Live Feed' }}
      />
      <Tab.Screen 
        name="AllNotifications" 
        component={require('../screens/user/AllNotificationsScreen').default}
        options={{ title: 'Notifications', tabBarLabel: 'Notifications',
          tabBarIcon: ({ focused, color, size }) => (
            <Icon name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
          )
        }}
      />
      <Tab.Screen 
        name="Explore" 
        component={ExploreScreen}
        options={{ title: 'Explore' }}
      />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { navTheme } = useTheme();

  if (isLoading) {
    return null; // Or a splash screen component
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: navTheme.colors.background },
        }}
      >
        {!isAuthenticated ? (
          // Auth Screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="UserSignup" component={UserSignupScreen} />
            <Stack.Screen name="AuthoritySignup" component={AuthoritySignupScreen} />
          </>
        ) : (
          // Main App Screens
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen 
              name="AuthorityHistory" 
              component={require('../screens/authority/AuthorityHistoryScreen').default}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="AuthorityAlertDetails" 
              component={require('../screens/authority/AuthorityAlertDetailsScreen').default}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="NotificationDetails" 
              component={NotificationDetailsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
