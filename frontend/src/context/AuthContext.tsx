import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  assignedSites?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    console.log('🚀 Starting auth state check...');
    setLoading(true);
    
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      const freshRegistration = await AsyncStorage.getItem('freshRegistration');

      console.log('🔍 Auth state check:', {
        hasToken: !!storedToken,
        hasUser: !!storedUser,
        isFreshRegistration: freshRegistration === 'true'
      });

      // Only auto-login if we have credentials AND it's not a fresh registration
      if (storedToken && storedUser && freshRegistration !== 'true') {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('✅ Auto-login: Valid stored credentials, logging in automatically');
          setToken(storedToken);
          setUser(parsedUser);
        } catch (parseError) {
          console.error('❌ Error parsing stored user data:', parseError);
          console.log('🧹 Clearing corrupted user data...');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('freshRegistration');
        }
      } else if (freshRegistration === 'true') {
        console.log('🏁 Fresh registration detected: Showing login screen despite stored credentials');
        // Don't auto-login, let user manually log in to confirm their credentials
      }
    } catch (error) {
      console.error('❌ Error checking auth state:', error);
    } finally {
      console.log('✅ Auth state check completed, setting loading to false');
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      // This would be replaced with actual API call
      const API_BASE_URL = 'http://localhost:5000/api';
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { token: newToken, data: userData } = data;
        
        await AsyncStorage.setItem('token', newToken);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        // Clear fresh registration flag since user has now manually logged in
        await AsyncStorage.removeItem('freshRegistration');
        console.log('🧹 Fresh registration flag cleared after successful login');
        
        setToken(newToken);
        setUser(userData);
        
        return true;
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 