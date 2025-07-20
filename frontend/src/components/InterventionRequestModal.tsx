import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';
import {
  Modal,
  Portal,
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  RadioButton,
  Switch,
  Chip,
  HelperText,
  ActivityIndicator
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { colors, spacing, fontSize } from '../theme/colors';

interface InterventionRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
  sites?: any[];
  tasks?: any[];
}

interface FormData {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  relatedSite?: string;
  relatedTask?: string;
  equipmentLocation: string;
  equipmentDetails: string;
  isEmergency: boolean;
}

const InterventionRequestModal: React.FC<InterventionRequestModalProps> = ({
  visible,
  onDismiss,
  onSuccess,
  sites = [],
  tasks = []
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'Medium',
    relatedSite: '',
    relatedTask: '',
    equipmentLocation: '',
    equipmentDetails: '',
    isEmergency: false
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (formData.equipmentLocation && formData.equipmentLocation.length > 300) {
      newErrors.equipmentLocation = 'Equipment location too long (max 300 characters)';
    }

    if (formData.equipmentDetails && formData.equipmentDetails.length > 500) {
      newErrors.equipmentDetails = 'Equipment details too long (max 500 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // Clean up the request data, removing undefined and empty values
      const requestData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        equipmentLocation: formData.equipmentLocation.trim() || undefined,
        equipmentDetails: formData.equipmentDetails.trim() || undefined,
        isEmergency: formData.isEmergency
      };

      // Only add optional fields if they have valid values
      if (formData.relatedSite && formData.relatedSite.trim() !== '') {
        requestData.relatedSite = formData.relatedSite;
      }
      
      if (formData.relatedTask && formData.relatedTask.trim() !== '') {
        requestData.relatedTask = formData.relatedTask;
      }

      console.log('📝 Submitting intervention request:', requestData);

      const response = await api.post('/intervention-requests', requestData);

      if (response.data.success) {
        resetForm();
        onDismiss();
        onSuccess();
        
        setTimeout(() => {
          Alert.alert(
            'Success! ✅',
            'Your intervention request has been submitted and automatically transferred to the workshop.\n\nThe workshop team has been notified and will review your request.',
            [{ text: 'OK' }]
          );
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ Intervention request submission error:', error);
      
      let errorMessage = 'Failed to submit intervention request. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Submission Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      relatedSite: '',
      relatedTask: '',
      equipmentLocation: '',
      equipmentDetails: '',
      isEmergency: false
    });
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    onDismiss();
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const priorityColors = {
    Low: colors.priority.low,
    Medium: colors.priority.medium,
    High: colors.priority.high,
    Urgent: colors.priority.critical
  };

  // Check if user can submit intervention requests
  const canSubmitRequests = user?.role === 'Worker' || 
                           user?.role === 'Conductors of Work' || 
                           user?.role === 'Project Manager' ||
                           user?.role === 'Administrator';

  if (!canSubmitRequests) {
    return (
      <Portal>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={styles.modalContainer}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>⚠️ Access Restricted</Title>
              <Paragraph style={styles.subtitle}>
                Your role ({user?.role}) is not authorized to submit intervention requests.
              </Paragraph>
              <Paragraph style={styles.helpText}>
                Only Workers, Conductors of Work, and Project Managers can submit intervention requests.
              </Paragraph>
              <Button mode="contained" onPress={onDismiss} style={styles.okButton}>
                OK
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    );
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>🔧 Workshop Intervention Request</Title>
            <Paragraph style={styles.subtitle}>
              Submit a request for workshop intervention or equipment repair
            </Paragraph>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              {/* Emergency Toggle */}
              <View style={styles.emergencySection}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, formData.isEmergency && styles.emergencyText]}>
                    🚨 Emergency Request
                  </Text>
                  <Switch
                    value={formData.isEmergency}
                    onValueChange={(value) => updateFormData('isEmergency', value)}
                    color={colors.error}
                  />
                </View>
                {formData.isEmergency && (
                  <Text style={styles.emergencyNote}>
                    Emergency requests receive immediate priority and workshop notification
                  </Text>
                )}
              </View>

              {/* Title */}
              <View style={styles.section}>
                <TextInput
                  label="Request Title *"
                  value={formData.title}
                  onChangeText={(text) => updateFormData('title', text)}
                  mode="outlined"
                  error={!!errors.title}
                  maxLength={200}
                  placeholder="Brief description of the intervention needed"
                />
                <HelperText type="error" visible={!!errors.title}>
                  {errors.title}
                </HelperText>
              </View>

              {/* Priority */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Priority Level</Text>
                <View style={styles.priorityContainer}>
                  {(['Low', 'Medium', 'High', 'Urgent'] as const).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityChip,
                        { backgroundColor: priorityColors[priority] },
                        formData.priority === priority && styles.selectedPriorityChip
                      ]}
                      onPress={() => updateFormData('priority', priority)}
                    >
                      <Text style={[
                        styles.priorityText,
                        formData.priority === priority && styles.selectedPriorityText
                      ]}>
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.section}>
                <TextInput
                  label="Detailed Description *"
                  value={formData.description}
                  onChangeText={(text) => updateFormData('description', text)}
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  error={!!errors.description}
                  maxLength={2000}
                  placeholder="Describe the problem, symptoms, and any relevant details..."
                />
                <HelperText type="error" visible={!!errors.description}>
                  {errors.description}
                </HelperText>
                <HelperText type="info">
                  {formData.description.length}/2000 characters
                </HelperText>
              </View>

              {/* Related Site */}
              {sites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Related Site (Optional)</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formData.relatedSite}
                      onValueChange={(value) => updateFormData('relatedSite', value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Select a site..." value="" />
                      {sites.map((site) => (
                        <Picker.Item
                          key={site._id}
                          label={`${site.name} - ${site.city}`}
                          value={site._id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {/* Equipment Location */}
              <View style={styles.section}>
                <TextInput
                  label="Equipment/Location"
                  value={formData.equipmentLocation}
                  onChangeText={(text) => updateFormData('equipmentLocation', text)}
                  mode="outlined"
                  error={!!errors.equipmentLocation}
                  maxLength={300}
                  placeholder="Where is the equipment/problem located?"
                />
                <HelperText type="error" visible={!!errors.equipmentLocation}>
                  {errors.equipmentLocation}
                </HelperText>
              </View>

              {/* Equipment Details */}
              <View style={styles.section}>
                <TextInput
                  label="Equipment Details"
                  value={formData.equipmentDetails}
                  onChangeText={(text) => updateFormData('equipmentDetails', text)}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  error={!!errors.equipmentDetails}
                  maxLength={500}
                  placeholder="Equipment model, serial number, specifications..."
                />
                <HelperText type="error" visible={!!errors.equipmentDetails}>
                  {errors.equipmentDetails}
                </HelperText>
              </View>

              {/* Summary */}
              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}>Request Summary</Text>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Priority:</Text>
                  <Chip
                    style={{ backgroundColor: priorityColors[formData.priority] }}
                    textStyle={{ color: 'white', fontWeight: 'bold' }}
                  >
                    {formData.priority}
                  </Chip>
                </View>
                {formData.isEmergency && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Type:</Text>
                    <Chip style={{ backgroundColor: colors.error }} textStyle={{ color: 'white' }}>
                      🚨 Emergency
                    </Chip>
                  </View>
                )}
                <Text style={styles.summaryNote}>
                  💡 This request will be automatically transferred to the workshop team upon submission.
                </Text>
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
                onPress={handleSubmit}
                style={styles.submitButton}
                loading={loading}
                disabled={loading || !formData.title.trim() || !formData.description.trim()}
              >
                Submit Request
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
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    borderRadius: 12,
    maxHeight: '90%',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scrollContainer: {
    maxHeight: 400,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emergencySection: {
    backgroundColor: colors.error + '10',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  emergencyText: {
    color: colors.error,
  },
  emergencyNote: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
    marginHorizontal: 2,
    alignItems: 'center',
    opacity: 0.7,
  },
  selectedPriorityChip: {
    opacity: 1,
    elevation: 3,
  },
  priorityText: {
    color: 'white',
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  selectedPriorityText: {
    fontWeight: 'bold',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  picker: {
    height: 50,
  },
  summarySection: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
    minWidth: 60,
  },
  summaryNote: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  okButton: {
    marginTop: spacing.md,
  },
  helpText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

export default InterventionRequestModal; 