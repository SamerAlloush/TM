import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  Modal,
  Portal,
  Button,
  TextInput,
  Card,
  Title,
  ActivityIndicator,
  Chip,
  IconButton,
  Divider,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../theme/colors';
import { messagingAPI } from '../services/api';

interface ComposeMailModalProps {
  visible: boolean;
  onDismiss: () => void;
  onMailSent: () => void;
}

interface Attachment {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

const ComposeMailModal: React.FC<ComposeMailModalProps> = ({
  visible,
  onDismiss,
  onMailSent,
}) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipient: '',
    subject: '',
    body: '',
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const resetForm = () => {
    setFormData({
      recipient: '',
      subject: '',
      body: '',
    });
    setAttachments([]);
  };

  const handleCancel = () => {
    resetForm();
    onDismiss();
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        }));
        
        setAttachments(prev => [...prev, ...newAttachments]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType.includes('pdf')) return 'picture-as-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-on';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'folder-zip';
    return 'insert-drive-file';
  };

  const validateForm = (): boolean => {
    if (!formData.recipient.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipient email address.');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.recipient.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }

    if (!formData.subject.trim()) {
      Alert.alert('Validation Error', 'Please enter a subject for your email.');
      return false;
    }

    if (!formData.body.trim()) {
      Alert.alert('Validation Error', 'Please enter some content for your email.');
      return false;
    }

    return true;
  };

  const handleSendMail = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      console.log('📧 Sending mail:', {
        recipient: formData.recipient,
        subject: formData.subject,
        body: formData.body,
        attachments: attachments.length,
      });

      const mailData = {
        recipient: formData.recipient.trim(),
        subject: formData.subject.trim(),
        body: formData.body.trim(),
        attachments: attachments,
      };

      const response = await messagingAPI.sendMail(mailData);

      if (response.success) {
        resetForm();
        onMailSent();
        
        Alert.alert(
          'Mail Sent! ✅',
          `Your email has been sent successfully to ${formData.recipient}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ Mail sending error:', error);
      console.log('🔍 Error response data:', error.response?.data);
      console.log('🔍 Full error object:', error);
      console.log('🔍 Error message:', error.message);
      
      // Check if this is a missing email credentials error
      const errorResponse = error.response?.data;
      const errorMessage = error.message || '';
      
      if (errorResponse?.error === 'MISSING_EMAIL_CREDENTIALS' || 
          errorMessage.includes('MISSING_EMAIL_CREDENTIALS') ||
          errorMessage.includes('email service credentials not configured') ||
          errorMessage.includes('Please set up your email credentials') ||
          errorResponse?.message?.includes('email credentials')) {
        
        console.log('✅ Detected missing credentials - showing setup dialog');
        Alert.alert(
          'Email Credentials Required',
          'You need to set up your email credentials before sending emails. Would you like to set them up now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Setup Now',
              onPress: () => {
                onDismiss(); // Close the mail modal first
                (navigation as any).navigate('EmailCredentialsSetup', {
                  required: true,
                  returnTo: 'Dashboard'
                });
              }
            }
          ]
        );
      } else {
        // Handle other errors
        let errorMessage = 'Failed to send email. Please try again.';
        
        if (errorResponse?.message) {
          errorMessage = errorResponse.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        Alert.alert('Send Failed', errorMessage, [{ text: 'OK' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            {/* Header */}
            <View style={styles.header}>
              <Title style={styles.title}>📧 Compose Mail</Title>
              <IconButton
                icon="close"
                size={24}
                onPress={handleCancel}
                disabled={loading}
              />
            </View>

            <Divider style={styles.divider} />

            <ScrollView 
              ref={scrollViewRef}
              style={styles.scrollContainer} 
              showsVerticalScrollIndicator={false}
            >
              {/* Recipient */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>To *</Text>
                <TextInput
                  mode="outlined"
                  value={formData.recipient}
                  onChangeText={(value) => setFormData({ ...formData, recipient: value })}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  disabled={loading}
                />
              </View>

              {/* Subject */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Subject *</Text>
                <TextInput
                  mode="outlined"
                  value={formData.subject}
                  onChangeText={(value) => setFormData({ ...formData, subject: value })}
                  placeholder="Enter email subject"
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  disabled={loading}
                />
              </View>

              {/* Attachments */}
              <View style={styles.fieldContainer}>
                <View style={styles.attachmentHeader}>
                  <Text style={styles.fieldLabel}>Attachments</Text>
                  <Button
                    mode="outlined"
                    icon="attachment"
                    onPress={pickDocument}
                    disabled={loading}
                    style={styles.attachButton}
                    compact
                  >
                    Add Files
                  </Button>
                </View>

                {attachments.length > 0 && (
                  <View style={styles.attachmentsList}>
                    {attachments.map((attachment, index) => (
                      <View key={index} style={styles.attachmentItem}>
                        <MaterialIcons
                          name={getFileIcon(attachment.mimeType) as any}
                          size={20}
                          color={colors.primary}
                        />
                        <View style={styles.attachmentInfo}>
                          <Text style={styles.attachmentName} numberOfLines={1}>
                            {attachment.name}
                          </Text>
                          <Text style={styles.attachmentSize}>
                            {formatFileSize(attachment.size)}
                          </Text>
                        </View>
                        <IconButton
                          icon="close"
                          size={16}
                          onPress={() => removeAttachment(index)}
                          disabled={loading}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Message Body */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Message *</Text>
                <TextInput
                  mode="outlined"
                  value={formData.body}
                  onChangeText={(value) => setFormData({ ...formData, body: value })}
                  placeholder="Type your message here..."
                  multiline
                  numberOfLines={8}
                  style={[styles.input, styles.bodyInput]}
                  theme={{ colors: { primary: colors.primary } }}
                  disabled={loading}
                />
              </View>

              {/* Summary */}
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>📋 Summary</Text>
                <Text style={styles.summaryText}>
                  To: {formData.recipient || 'Not specified'}
                </Text>
                <Text style={styles.summaryText}>
                  Subject: {formData.subject || 'No subject'}
                </Text>
                <Text style={styles.summaryText}>
                  Attachments: {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                </Text>
                {attachments.length > 0 && (
                  <Text style={styles.summaryText}>
                    Total size: {formatFileSize(attachments.reduce((sum, att) => sum + att.size, 0))}
                  </Text>
                )}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSendMail}
                style={styles.sendButton}
                loading={loading}
                disabled={loading}
                icon="send"
              >
                Send Mail
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: spacing.md,
    flex: 1,
  },
  card: {
    flex: 1,
    maxHeight: '95%',
  },
  cardContent: {
    flex: 1,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
  },
  bodyInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  attachButton: {
    borderColor: colors.primary,
  },
  attachmentsList: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  attachmentName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },
  attachmentSize: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  summary: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  cancelButton: {
    flex: 0.4,
    marginRight: spacing.sm,
  },
  sendButton: {
    flex: 0.6,
    backgroundColor: colors.primary,
  },
});

export default ComposeMailModal; 