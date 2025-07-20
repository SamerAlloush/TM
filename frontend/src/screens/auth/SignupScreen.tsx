import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, Button, Card, HelperText } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authAPI, healthCheck } from '../../services/api';
import { colors, spacing, fontSize, shadows } from '../../theme/colors';

const SignupScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Worker', // Default role
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const roles = [
    'Administrator',
            'RH',
        'Purchase Department',
        'Worker',
        'Workshop',
        'Conductors of Work',
        'Accounting',
        'Bureau d\'Études',
        'Project Manager',
  ];

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      Alert.alert('Error', 'First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      Alert.alert('Error', 'Last name is required');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Test backend connectivity first
      console.log('🏥 Testing backend connection...');
      const isBackendUp = await healthCheck();
      console.log('🏥 Backend health check result:', isBackendUp);
      
      if (!isBackendUp) {
        Alert.alert(
          'Connection Error', 
          'Cannot connect to the server. Please ensure the backend is running on http://localhost:5000'
        );
        setLoading(false);
        return;
      }
      
      const { confirmPassword, ...userData } = formData;
      console.log('📝 Submitting registration data:', userData);
      console.log('🌐 API URL:', 'http://localhost:5000/api/auth/register');
      
      // Show immediate feedback
      Alert.alert('Processing...', 'Creating your account and sending verification email...');
      
      const response = await authAPI.register(userData);
      console.log('📡 Registration response:', response);
      console.log('📡 Response success status:', response?.success);
      console.log('📡 Response data:', response?.data);
      console.log('📡 Response message:', response?.message);
      
              if (response && response.success) {
          console.log('✅ Registration successful, navigating to OTP verification');
          console.log('🧭 Navigation params:', { email: formData.email, firstName: formData.firstName });
          
          // Immediate navigation with delay to ensure UI is ready
          setTimeout(() => {
            console.log('🧭 Attempting navigation to OTPVerification...');
            console.log('🧭 Navigation object:', navigation);
            console.log('🧭 Available navigation methods:', Object.keys(navigation));
            
            try {
              navigation.navigate('OTPVerification', {
                email: formData.email,
                firstName: formData.firstName
              });
              console.log('✅ Navigation call completed');
              
              // Show success message after navigation
              setTimeout(() => {
                Alert.alert(
                  'Check Your Email! 📧',
                  `We've sent a verification code to ${formData.email}. Please check your inbox and enter the code to complete your registration.`
                );
              }, 300);
              
            } catch (navError) {
              console.log('❌ Navigation error:', navError);
              console.log('❌ Navigation error details:', JSON.stringify(navError));
              
              // Fallback: Use push instead of navigate
              try {
                console.log('🔄 Trying navigation.push as fallback...');
                navigation.push('OTPVerification', {
                  email: formData.email,
                  firstName: formData.firstName
                });
                console.log('✅ Push navigation completed');
              } catch (pushError) {
                console.log('❌ Push navigation also failed:', pushError);
                Alert.alert(
                  'Navigation Error', 
                  'Cannot navigate to verification screen. Please try restarting the app.',
                  [
                    {
                      text: 'Manual Navigation',
                      onPress: () => {
                        Alert.alert(
                          'Please Navigate Manually',
                          'Go to the OTP Verification screen and enter your email: ' + formData.email
                        );
                      }
                    }
                  ]
                );
              }
            }
          }, 100);
        
      } else {
        console.log('❌ Registration failed - response not successful');
        console.log('❌ Response error:', response?.error);
        Alert.alert('Registration Failed', response?.error || response?.message || 'Failed to create account. Please try again.');
      }
    } catch (error: any) {
      console.log('❌ Registration error caught:', error);
      console.log('❌ Error message:', error.message);
      console.log('❌ Error response:', error.response?.data);
      console.log('❌ Error status:', error.response?.status);
      
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.message?.includes('Network Error') || error.code === 'NETWORK_ERROR') {
        errorMessage = 'Cannot connect to server. Please check your network connection and ensure the backend is running.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.surface} />
          </TouchableOpacity>
          <Text style={styles.logo}>🏗️</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join TM Paysage Site Manager</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.nameRow}>
              <TextInput
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(text: string) => setFormData({...formData, firstName: text})}
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                  theme={{ colors: { primary: colors.primary } }}
                />
              <TextInput
                label="Last Name"
                value={formData.lastName}
                onChangeText={(text) => setFormData({...formData, lastName: text})}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                theme={{ colors: { primary: colors.primary } }}
              />
            </View>

            <TextInput
              label="Email Address"
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              theme={{ colors: { primary: colors.primary } }}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(text) => setFormData({...formData, password: text})}
                mode="outlined"
                secureTextEntry={!showPassword}
                style={styles.input}
                theme={{ colors: { primary: colors.primary } }}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
              <HelperText type="info" visible={formData.password.length > 0 && formData.password.length < 6}>
                Password must be at least 6 characters
              </HelperText>
            </View>

            <TextInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              theme={{ colors: { primary: colors.primary } }}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
            />

            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Select Your Role:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScrollView}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      formData.role === role && styles.roleButtonSelected,
                      { backgroundColor: formData.role === role ? colors.roles[role as keyof typeof colors.roles] : colors.background }
                    ]}
                    onPress={() => setFormData({...formData, role})}
                  >
                    <Text style={[
                      styles.roleText,
                      formData.role === role && styles.roleTextSelected
                    ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Button
              mode="contained"
              onPress={handleSignup}
              loading={loading}
              disabled={loading}
              style={styles.signupButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Create Account
            </Button>

         

            <View style={styles.loginLink}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLinkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 10,
    padding: spacing.sm,
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: 'bold',
    color: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.surface,
    textAlign: 'center',
    opacity: 0.9,
  },
  card: {
    ...shadows.large,
    borderRadius: 16,
  },
  cardContent: {
    padding: spacing.xl,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    marginBottom: spacing.md,
  },
  halfInput: {
    flex: 0.48,
  },
  passwordContainer: {
    marginBottom: spacing.sm,
  },
  roleContainer: {
    marginBottom: spacing.lg,
  },
  roleLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  roleScrollView: {
    flexGrow: 0,
  },
  roleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleButtonSelected: {
    borderColor: 'transparent',
  },
  roleText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  roleTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  signupButton: {
    borderRadius: 12,
    marginTop: spacing.md,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  loginLinkText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default SignupScreen; 