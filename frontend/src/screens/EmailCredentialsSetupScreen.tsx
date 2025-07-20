import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface EmailProvider {
  name: string;
  displayName: string;
  domains: string[];
  instructions: {
    appPasswordRequired: boolean;
    appPasswordUrl?: string;
    setupSteps: string[];
  };
}

interface EmailStatus {
  email: string;
  hasCredentials: boolean;
  detectedProvider: string;
  supportedProvider: boolean;
  providerDisplayName: string;
  canSendEmails: boolean;
  setupInstructions: {
    appPasswordRequired: boolean;
    appPasswordUrl?: string;
    setupSteps: string[];
  } | null;
}

const EmailCredentialsSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailPassword, setEmailPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingCredentials, setIsTestingCredentials] = useState(false);
  const [setupStep, setSetupStep] = useState<'loading' | 'instructions' | 'credentials' | 'testing' | 'success'>('loading');
  const [showPassword, setShowPassword] = useState(false);
  
  // Check if this is a required setup (from mail send failure) or optional setup
  const isRequired = (route.params as any)?.required || false;
  const returnTo = (route.params as any)?.returnTo || 'Dashboard';

  useEffect(() => {
    loadEmailStatus();
  }, []);

  const loadEmailStatus = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/mail/status');
      
      if (response.data.success) {
        const status = response.data.data;
        setEmailStatus(status);
        
        if (status.hasCredentials) {
          setSetupStep('success');
        } else if (status.supportedProvider) {
          setSetupStep('instructions');
        } else {
          // Unsupported provider
          Alert.alert(
            'Email Provider Not Supported',
            `Your email provider (${status.detectedProvider}) is not currently supported. Please contact support for assistance.`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (error) {
      console.error('Error loading email status:', error);
      Alert.alert('Error', 'Failed to load email status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAppPasswordUrl = () => {
    if (emailStatus?.setupInstructions?.appPasswordUrl) {
      Linking.openURL(emailStatus.setupInstructions.appPasswordUrl);
    }
  };

  const proceedToCredentialsSetup = () => {
    setSetupStep('credentials');
  };

  const setupEmailCredentials = async () => {
    if (!emailPassword.trim()) {
      Alert.alert('Error', 'Please enter your email password or app password.');
      return;
    }

    try {
      setIsTestingCredentials(true);
      setSetupStep('testing');

      const response = await api.post('/mail/setup-credentials', {
        emailPassword: emailPassword.trim()
      });

      if (response.data.success) {
        setSetupStep('success');
        Alert.alert(
          'Success!',
          'Your email credentials have been configured and verified successfully. You can now send emails.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (isRequired) {
                  // Return to the previous screen that required email setup
                  navigation.navigate(returnTo as never);
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Setup Failed', response.data.message || 'Failed to set up email credentials.');
        setSetupStep('credentials');
      }
    } catch (error: any) {
      console.error('Error setting up credentials:', error);
      let errorMessage = 'Failed to set up email credentials.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Setup Failed', errorMessage);
      setSetupStep('credentials');
    } finally {
      setIsTestingCredentials(false);
    }
  };

  const testExistingCredentials = async () => {
    try {
      setIsTestingCredentials(true);
      const response = await api.post('/mail/verify-credentials');
      
      if (response.data.success) {
        Alert.alert('Success', 'Your email credentials are working correctly!');
      } else {
        Alert.alert('Verification Failed', response.data.message || 'Email credentials verification failed.');
      }
    } catch (error: any) {
      Alert.alert('Verification Failed', error.response?.data?.message || 'Failed to verify credentials.');
    } finally {
      setIsTestingCredentials(false);
    }
  };

  const removeCredentials = async () => {
    Alert.alert(
      'Remove Credentials',
      'Are you sure you want to remove your email credentials? You will not be able to send emails until you set them up again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/mail/credentials');
              Alert.alert('Success', 'Email credentials removed successfully.');
              setSetupStep('instructions');
              setEmailStatus(prev => prev ? { ...prev, hasCredentials: false } : null);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to remove credentials.');
            }
          }
        }
      ]
    );
  };

  if (setupStep === 'loading' || isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading email configuration...</Text>
      </View>
    );
  }

  if (!emailStatus) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load email status</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadEmailStatus}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Email Credentials Setup</Text>
        <Text style={styles.subtitle}>
          Configure your {emailStatus.providerDisplayName} credentials to send emails
        </Text>
      </View>

      <View style={styles.userInfoCard}>
        <Text style={styles.userEmail}>{emailStatus.email}</Text>
        <Text style={styles.provider}>Provider: {emailStatus.providerDisplayName}</Text>
        <Text style={styles.status}>
          Status: {emailStatus.hasCredentials ? '✅ Configured' : '❌ Not Configured'}
        </Text>
      </View>

      {setupStep === 'instructions' && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.sectionTitle}>Setup Instructions</Text>
          
          {emailStatus.setupInstructions?.appPasswordRequired && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ App Password Required</Text>
              <Text style={styles.warningText}>
                For security, {emailStatus.providerDisplayName} requires an App Password instead of your regular password.
              </Text>
            </View>
          )}

          <View style={styles.stepsContainer}>
            {emailStatus.setupInstructions?.setupSteps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {emailStatus.setupInstructions?.appPasswordUrl && (
            <TouchableOpacity style={styles.linkButton} onPress={openAppPasswordUrl}>
              <Text style={styles.linkButtonText}>
                Open {emailStatus.providerDisplayName} Security Settings
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={proceedToCredentialsSetup}>
            <Text style={styles.primaryButtonText}>I've Set Up My App Password</Text>
          </TouchableOpacity>
        </View>
      )}

      {setupStep === 'credentials' && (
        <View style={styles.credentialsContainer}>
          <Text style={styles.sectionTitle}>Enter Your Credentials</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              value={emailStatus.email}
              editable={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {emailStatus.setupInstructions?.appPasswordRequired ? 'App Password' : 'Email Password'}
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter your app password"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {emailStatus.setupInstructions?.appPasswordRequired && (
              <Text style={styles.helpText}>
                Use the 16-character app password, not your regular email password
              </Text>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, isTestingCredentials && styles.disabledButton]} 
            onPress={setupEmailCredentials}
            disabled={isTestingCredentials}
          >
            <Text style={styles.primaryButtonText}>
              {isTestingCredentials ? 'Setting Up...' : 'Set Up Email Credentials'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {setupStep === 'testing' && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Testing your email credentials...</Text>
          <Text style={styles.subLoadingText}>This may take a few seconds</Text>
        </View>
      )}

      {setupStep === 'success' && emailStatus.hasCredentials && (
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>✅ Email Credentials Configured</Text>
          <Text style={styles.successText}>
            Your email credentials are set up and verified. You can now send emails using your {emailStatus.providerDisplayName} account.
          </Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity 
              style={[styles.secondaryButton, isTestingCredentials && styles.disabledButton]} 
              onPress={testExistingCredentials}
              disabled={isTestingCredentials}
            >
              <Text style={styles.secondaryButtonText}>
                {isTestingCredentials ? 'Testing...' : 'Test Credentials'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.removeButton} onPress={removeCredentials}>
            <Text style={styles.removeButtonText}>Remove Credentials</Text>
          </TouchableOpacity>
        </View>
      )}

      {isRequired && (
        <View style={styles.requiredNotice}>
          <Text style={styles.requiredText}>
            Email credentials are required to send emails. Please complete the setup to continue.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  userInfoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  provider: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
  },
  stepsContainer: {
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    backgroundColor: '#007AFF',
    color: 'white',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 12,
    lineHeight: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  credentialsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  disabledInput: {
    backgroundColor: '#f9f9f9',
    color: '#666',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: 'white',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  showPasswordText: {
    color: '#007AFF',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  successContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginBottom: 16,
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  removeButton: {
    paddingVertical: 8,
  },
  removeButtonText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  requiredNotice: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
  requiredText: {
    fontSize: 14,
    color: '#0c5460',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  subLoadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmailCredentialsSetupScreen; 