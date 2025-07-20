import { DefaultTheme } from 'react-native-paper';

export const colors = {
  primary: '#2E86AB',
  primaryDark: '#1E5E7E',
  secondary: '#F24236',
  accent: '#F6AE2D',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  error: '#E74C3C',
  warning: '#F39C12',
  success: '#27AE60',
  info: '#3498DB',
  border: '#E1E8ED',
  disabled: '#BDC3C7',
  placeholder: '#95A5A6',
  
  // Construction-specific colors
  construction: {
    orange: '#FF6B35',
    yellow: '#F7931E',
    blue: '#2E86AB',
    green: '#88D8B0',
    red: '#FF6B6B',
    gray: '#6C757D'
  },
  
  // Status colors
  status: {
    active: '#27AE60',
    inactive: '#95A5A6',
    pending: '#F39C12',
    completed: '#27AE60',
    cancelled: '#E74C3C',
    onHold: '#F39C12'
  },
  
  // Priority colors
  priority: {
    low: '#27AE60',
    medium: '#F39C12',
    high: '#E67E22',
    critical: '#E74C3C'
  },
  
  // Role colors (for visual distinction)
  roles: {
    Administrator: '#9B59B6',
    RH: '#E67E22',
    'Purchase Department': '#3498DB',
    Worker: '#E74C3C',
    Workshop: '#F39C12',
    'Conductors of Work': '#27AE60',
    'Project Manager': '#8E44AD',
    Accounting: '#34495E',
    'Bureau d\'Études': '#16A085'
  }
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    error: colors.error,
    disabled: colors.disabled,
    placeholder: colors.placeholder,
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'System',
      fontWeight: 'normal' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300' as const,
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100' as const,
    },
  },
  roundness: 8,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 32,
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
}; 