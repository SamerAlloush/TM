import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from 'react-query';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import OTPVerificationScreen from './src/screens/auth/OTPVerificationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SitesScreen from './src/screens/SitesScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NewMessageScreen from './src/screens/NewMessageScreen';
import ChatScreen from './src/screens/ChatScreen';
import EmailCredentialsSetupScreen from './src/screens/EmailCredentialsSetupScreen';
import ConnectionStatus from './src/components/ConnectionStatus';

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Theme
import { theme } from './src/theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const queryClient = new QueryClient();

// Loading Screen Component
function LoadingScreen() {
  console.log('🔄 LoadingScreen component rendered');
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
      <Text style={styles.loadingSubtext}>TM Paysage Site Manager</Text>
    </View>
  );
}

// Auth Stack Navigator
function AuthStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
}

// Messages Stack Navigator
function MessagesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MessagesList" 
        component={MessagesScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="NewMessage" 
        component={NewMessageScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal' 
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Sites') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Sites"
        component={SitesScreen}
        options={{ title: 'Construction Sites' }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// App Navigator
function AppNavigator() {
  const { user, loading } = useAuth();

  console.log('🎯 AppNavigator render:', { hasUser: !!user, loading });

  if (loading) {
    console.log('📱 Showing loading screen...');
    return <LoadingScreen />;
  }

  if (user) {
    console.log('✅ User authenticated, showing main app');
  } else {
    console.log('🔑 No user found, showing auth screens');
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="EmailCredentialsSetup" 
              component={EmailCredentialsSetupScreen}
              options={{
                headerShown: true,
                headerTitle: 'Email Setup',
                headerStyle: {
                  backgroundColor: theme.colors.primary,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                presentation: 'modal'
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // Temporarily simplified for debugging
  console.log('🚀 Main App function called');
  
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <AppNavigator />
          <ConnectionStatus />
          <StatusBar style="auto" />
          <Toast />
        </AuthProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.text,
    textAlign: 'center',
    opacity: 0.7,
  },
}); 