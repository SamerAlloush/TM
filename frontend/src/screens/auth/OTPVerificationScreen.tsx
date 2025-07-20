import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { TextInput, Button, Card } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, fontSize, shadows } from '../../theme/colors';

const OTPVerificationScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  console.log('🎯 OTPVerificationScreen mounting...');
  console.log('🎯 Route params received:', route?.params);
  
  const { email, firstName } = route?.params || { email: 'N/A', firstName: 'N/A' };
  
  console.log('🎯 Extracted email:', email);
  console.log('🎯 Extracted firstName:', firstName);
  const [otp, setOTP] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(600); // 10 minutes in seconds
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  
  const inputRefs = useRef<(any)[]>([]);
  const { login: contextLogin } = useAuth();

  useEffect(() => {
    // Start countdown timer
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          Alert.alert(
            'OTP Expired',
            'Your verification code has expired. Please request a new one.',
            [
              { text: 'Request New Code', onPress: handleResendOTP },
              { text: 'Go Back', onPress: () => navigation.goBack() }
            ]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOTPChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const otpArray = value.slice(0, 6).split('');
      const newOTP = [...otp];
      otpArray.forEach((digit, i) => {
        if (index + i < 6) {
          newOTP[index + i] = digit;
        }
      });
      setOTP(newOTP);
      
      // Focus last filled input or next empty
      const nextIndex = Math.min(index + otpArray.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOTP = [...otp];
    newOTP[index] = value;
    setOTP(newOTP);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOTP({ email, otp: otpCode });
      
      if (response.success && response.data) {
        console.log('✅ OTP verification successful, storing auth data...');
        
        // Store auth token and user data locally for future use
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.data));
        
        // Set flag to indicate this is a fresh registration - should show login screen
        await AsyncStorage.setItem('freshRegistration', 'true');
        
        console.log('💾 Auth data stored successfully');
        console.log('🏁 Fresh registration flag set');
        console.log('🔀 Redirecting to login page...');
        
        // Account created successfully - redirect immediately to login page
        console.log('🎉 Account verification successful!');
        console.log(`👤 Welcome ${firstName}! Redirecting to login...`);
        
        // Navigate directly to login page - token is stored but user sees login screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error: any) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Invalid OTP')) {
        setAttemptsLeft(prev => prev - 1);
        Alert.alert('Invalid Code', `${errorMessage}\n\nAttempts remaining: ${attemptsLeft - 1}`);
      } else if (errorMessage.includes('expired')) {
        Alert.alert(
          'Code Expired',
          'Your verification code has expired. Please request a new one.',
          [{ text: 'Request New Code', onPress: handleResendOTP }]
        );
      } else if (errorMessage.includes('Maximum verification attempts')) {
        Alert.alert(
          'Too Many Attempts',
          'You have exceeded the maximum number of verification attempts. Please register again.',
          [{ text: 'Go Back', onPress: () => navigation.navigate('Signup') }]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    try {
      await authAPI.resendOTP(email);
      setTimer(600); // Reset timer
      setAttemptsLeft(3); // Reset attempts
      setOTP(['', '', '', '', '', '']); // Clear current OTP
      Alert.alert('Success', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.surface} />
        </TouchableOpacity>
        <Text style={styles.logo}>📧</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text style={styles.instruction}>Enter the verification code:</Text>
          
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                                 ref={(ref: any) => (inputRefs.current[index] = ref)}
                value={digit}
                onChangeText={(value) => handleOTPChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                mode="outlined"
                keyboardType="numeric"
                maxLength={6}
                style={styles.otpInput}
                contentStyle={styles.otpInputContent}
                theme={{ colors: { primary: colors.primary } }}
                textAlign="center"
              />
            ))}
          </View>

          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.timerText}>
              Code expires in: <Text style={styles.timerValue}>{formatTime(timer)}</Text>
            </Text>
          </View>

          <Text style={styles.attemptsText}>
            Attempts remaining: <Text style={styles.attemptsValue}>{attemptsLeft}</Text>
          </Text>

          <Button
            mode="contained"
            onPress={handleVerifyOTP}
            loading={loading}
            disabled={loading || otp.join('').length !== 6}
            style={styles.verifyButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Verify Code
          </Button>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity 
              onPress={handleResendOTP} 
              disabled={resendLoading || timer > 540} // Allow resend after 1 minute
            >
              <Text style={[
                styles.resendLink,
                (resendLoading || timer > 540) && styles.resendLinkDisabled
              ]}>
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
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
    lineHeight: 22,
  },
  email: {
    fontWeight: '600',
    color: colors.accent,
  },
  card: {
    ...shadows.large,
    borderRadius: 16,
  },
  cardContent: {
    padding: spacing.xl,
  },
  instruction: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: 45,
    height: 55,
  },
  otpInputContent: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  timerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  timerValue: {
    fontWeight: '600',
    color: colors.warning,
  },
  attemptsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  attemptsValue: {
    fontWeight: '600',
    color: colors.error,
  },
  verifyButton: {
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  resendLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.disabled,
  },
});

export default OTPVerificationScreen; 