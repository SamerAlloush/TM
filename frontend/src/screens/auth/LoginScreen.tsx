import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { TextInput, Button, Card, Checkbox, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, fontSize, shadows } from '../../theme/colors';

const LoginScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [isFreshRegistration, setIsFreshRegistration] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    // Animation on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Check for fresh registration and pre-fill email
    checkFreshRegistration();
  }, []);

  const checkFreshRegistration = async () => {
    try {
      const freshRegistration = await AsyncStorage.getItem('freshRegistration');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (freshRegistration === 'true' && storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('🏁 Fresh registration detected, pre-filling email:', userData.email);
          setEmail(userData.email);
          setIsFreshRegistration(true);
        } catch (parseError) {
          console.error('❌ Error parsing stored user data for fresh registration:', parseError);
          console.log('🧹 Clearing corrupted data...');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('freshRegistration');
        }
      }
    } catch (error) {
      console.error('Error checking fresh registration:', error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const success = await login(email, password);
    setLoading(false);

    if (!success) {
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Please contact your administrator to reset your password.',
      [{ text: 'OK' }]
    );
  };

  const handleSocialLogin = (platform: string) => {
    Alert.alert(
      'Social Login',
      `${platform} login will be available in a future update.`,
      [{ text: 'OK' }]
    );
  };

  const quickLoginUsers = [
    { name: 'Admin', email: 'admin@tm-paysage.com', role: 'Administrator', color: colors.roles.Administrator },
    { name: 'RH Manager', email: 'rh@tm-paysage.com', role: 'RH', color: colors.roles.RH },
    { name: 'Worker', email: 'worker@tm-paysage.com', role: 'Worker', color: colors.roles.Worker },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.logo}>🏗️</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to TM Paysage Site Manager</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.cardTitle}>Sign In</Text>
                
                {isFreshRegistration && (
                  <View style={styles.freshRegistrationBanner}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.freshRegistrationText}>
                      Account created successfully! Please log in with your credentials.
                    </Text>
                  </View>
                )}

                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  left={<TextInput.Icon icon="email-outline" />}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off-outline" : "eye-outline"}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />

                <View style={styles.optionsRow}>
                  <View style={styles.checkboxContainer}>
                    <Checkbox
                      status={rememberMe ? 'checked' : 'unchecked'}
                      onPress={() => setRememberMe(!rememberMe)}
                      color={colors.primary}
                    />
                    <Text style={styles.checkboxLabel}>Remember me</Text>
                  </View>
                  <TouchableOpacity onPress={handleForgotPassword}>
                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading}
                  style={styles.loginButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                >
                  Sign In
                </Button>

                <View style={styles.dividerContainer}>
                  <Divider style={styles.divider} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <Divider style={styles.divider} />
                </View>

                <View style={styles.socialButtons}>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('Google')}
                  >
                    <Ionicons name="logo-google" size={20} color={colors.error} />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleSocialLogin('Microsoft')}
                  >
                    <Ionicons name="briefcase-outline" size={20} color={colors.info} />
                    <Text style={styles.socialButtonText}>Microsoft</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.signupLink}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation?.navigate('Signup')}>
                    <Text style={styles.signupLinkText}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>

            {/* Quick Login Demo Section */}
            <Card style={styles.demoCard}>
              <Card.Content style={styles.demoContent}>
                <View style={styles.demoHeader}>
                  <Ionicons name="flash" size={20} color={colors.accent} />
                  <Text style={styles.demoTitle}>Quick Demo Access</Text>
                </View>
                <Text style={styles.demoSubtitle}>Try different user roles instantly</Text>
                
                <View style={styles.quickLoginContainer}>
                  {quickLoginUsers.map((user, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.quickLoginButton, { borderColor: user.color }]}
                      onPress={() => {
                        setEmail(user.email);
                        setPassword('password123');
                      }}
                    >
                      <View style={[styles.roleIndicator, { backgroundColor: user.color }]} />
                      <View style={styles.quickLoginInfo}>
                        <Text style={styles.quickLoginName}>{user.name}</Text>
                        <Text style={styles.quickLoginRole}>{user.role}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={styles.demoPassword}>
                  <Ionicons name="key-outline" size={14} color={colors.textSecondary} />
                  {' '}All demo accounts use password: password123
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl * 1.5,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: 'bold',
    color: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.surface,
    textAlign: 'center',
    opacity: 0.9,
  },
  cardContainer: {
    flex: 1,
  },
  card: {
    ...shadows.large,
    borderRadius: 20,
    marginBottom: spacing.lg,
  },
  cardContent: {
    padding: spacing.xl,
  },
  cardTitle: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  freshRegistrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  freshRegistrationText: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500',
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  forgotPassword: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  socialButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  socialButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  signupLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signupText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  signupLinkText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  demoCard: {
    ...shadows.medium,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  demoContent: {
    padding: spacing.lg,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  demoTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  demoSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  quickLoginContainer: {
    marginBottom: spacing.md,
  },
  quickLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  roleIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  quickLoginInfo: {
    flex: 1,
  },
  quickLoginName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  quickLoginRole: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  demoPassword: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LoginScreen; 