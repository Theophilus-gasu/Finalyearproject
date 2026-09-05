import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
import 'react-native-get-random-values';

import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import { FirebaseProvider, FirebaseContext } from './FirebaseContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

enableScreens(false);

import DashboardScreen from './screens/DashboardScreen';
import GraphScreen from './screens/GraphScreen';
import HistoryScreen from './screens/HistoryScreen';
import StatusScreen from './screens/StatusScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors, theme } = useContext(FirebaseContext);

  const navTheme = theme === 'Dark' ? DarkTheme : DefaultTheme;

  return (
    <>
      <StatusBar style={theme === 'Dark' ? "light" : "dark"} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
              else if (route.name === 'Graph') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              else if (route.name === 'History') iconName = focused ? 'list' : 'list-outline';
              else if (route.name === 'Status') iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
              else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: colors.danger,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: { backgroundColor: colors.tabBarBg, borderTopWidth: 0, paddingBottom: 5 },
            headerStyle: { backgroundColor: colors.headerBg, shadowColor: 'transparent', elevation: 0 },
            headerTintColor: colors.textMain,
            headerTitleStyle: { fontWeight: 'bold' },
            sceneStyle: { backgroundColor: colors.bgMain }
          })}
        >
          <Tab.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ 
              title: 'IOT SAFETY DASHBOARD',
              tabBarLabel: 'Dashboard'
            }} 
          />
          <Tab.Screen name="Graph" component={GraphScreen} options={{ title: 'SMOKE LEVEL GRAPH', tabBarLabel: 'Graph' }} />
          <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'ALERT HISTORY', tabBarLabel: 'History' }} />
          <Tab.Screen name="Status" component={StatusScreen} options={{ title: 'DEVICE STATUS', tabBarLabel: 'Status' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'SETTINGS', tabBarLabel: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <MainTabs />
    </FirebaseProvider>
  );
}
