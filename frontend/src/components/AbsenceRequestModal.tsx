import React, { useState } from 'react';
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
  RadioButton,
  Card,
  Title,
  Paragraph,
  Menu,
  Divider,
  IconButton,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize } from '../theme/colors';
import { absenceAPI } from '../services/api';

interface AbsenceRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
  requestType: 'Request' | 'Declaration';
  onSuccess: () => void;
}

const AbsenceRequestModal: React.FC<AbsenceRequestModalProps> = ({
  visible,
  onDismiss,
  requestType,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Get tomorrow's date as minimum selectable date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const [formData, setFormData] = useState({
    type: 'Vacation' as 'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Emergency' | 'Training' | 'Other',
    startDate: getTomorrowDate(),
    endDate: getTomorrowDate(),
    reason: '',
    isFullDay: true,
  });

  const absenceTypes = [
    { label: 'Vacation', value: 'Vacation' },
    { label: 'Sick Leave', value: 'Sick Leave' },
    { label: 'Personal Leave', value: 'Personal Leave' },
    { label: 'Emergency', value: 'Emergency' },
    { label: 'Training', value: 'Training' },
    { label: 'Other', value: 'Other' },
  ];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateDayCount = (): number => {
    const timeDiff = formData.endDate.getTime() - formData.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const validateDates = (): { isValid: boolean; error?: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if start date is today or in the past - ALL absence types must be future-dated
    if (formData.startDate <= today) {
      return {
        isValid: false,
        error: 'Absence requests must be for future dates only (starting tomorrow). For current or past absences, please contact HR directly.'
      };
    }

    // Check if end date is before start date
    if (formData.endDate < formData.startDate) {
      return {
        isValid: false,
        error: 'End date must be on or after the start date.'
      };
    }

    return { isValid: true };
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setFormData(prev => {
        const newData = { ...prev, startDate: selectedDate };
        // Auto-adjust end date if it becomes before start date
        if (prev.endDate < selectedDate) {
          newData.endDate = selectedDate;
        }
        return newData;
      });
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setFormData(prev => ({ ...prev, endDate: selectedDate }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.type) {
      Alert.alert('Error', 'Please select an absence type');
      return;
    }

    // Validate dates
    const dateValidation = validateDates();
    if (!dateValidation.isValid) {
      Alert.alert('Invalid Date Selection', dateValidation.error);
      return;
    }

    if (formData.type === 'Other' && !formData.reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for "Other" absence type');
      return;
    }

    setLoading(true);
    try {
      const absenceData = {
        type: formData.type,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
        reason: formData.reason.trim() || undefined,
        requestType,
        isFullDay: formData.isFullDay,
        dayCount: calculateDayCount(),
      };

      console.log('📝 Submitting absence:', absenceData);

      const response = await absenceAPI.createAbsence(absenceData);

      if (response.success) {
        // Close modal immediately and refresh data
        resetForm();
        onDismiss();
        onSuccess();
        
        // Show success message after closing
        const actionText = requestType === 'Request' ? 'submitted' : 'declared';
        setTimeout(() => {
          Alert.alert(
            'Success! ✅',
            `Your absence ${actionText} has been ${actionText} successfully.${
              requestType === 'Request'
                ? '\n\nYour request is pending approval and you will be notified once it\'s reviewed.'
                : '\n\nYour absence declaration has been recorded.'
            }`,
            [{ text: 'OK' }]
          );
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ Absence submission error:', error);
      Alert.alert(
        'Submission Failed',
        error.message || 'Failed to submit absence. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const tomorrow = getTomorrowDate();
    setFormData({
      type: 'Vacation',
      startDate: tomorrow,
      endDate: tomorrow,
      reason: '',
      isFullDay: true,
    });
  };

  const handleCancel = () => {
    resetForm();
    onDismiss();
  };

  const getMinimumDate = (): Date => {
    // All absence types require future dates (starting tomorrow)
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>
              {requestType === 'Request' ? '📋 Request Absence' : '🚨 Declare Absence'}
            </Title>
            <Paragraph style={styles.subtitle}>
              {requestType === 'Request'
                ? 'Submit an absence request for approval'
                : 'Declare an immediate absence (e.g., sick leave)'}
            </Paragraph>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
              {/* Absence Type */}
              <View style={styles.section}>
                <Text style={styles.label}>Absence Type *</Text>
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setMenuVisible(true)}
                      style={styles.menuButton}
                      contentStyle={styles.menuButtonContent}
                    >
                      {formData.type}
                    </Button>
                  }
                >
                  {absenceTypes.map((type) => (
                    <Menu.Item
                      key={type.value}
                      title={type.label}
                      onPress={() => {
                        setFormData({ ...formData, type: type.value as any });
                        setMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>
              </View>

              {/* Date Selection with Calendar Picker */}
              <View style={styles.section}>
                <Text style={styles.label}>Start Date *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <View style={styles.dateButtonContent}>
                    <Text style={styles.dateButtonText}>
                      {formatDate(formData.startDate)}
                    </Text>
                    <IconButton
                      icon="calendar"
                      size={20}
                      iconColor={colors.primary}
                    />
                  </View>
                </TouchableOpacity>
                
                {showStartDatePicker && (
                  <DateTimePicker
                    value={formData.startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                    minimumDate={getMinimumDate()}
                    maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)} // 1 year ahead
                  />
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>End Date *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <View style={styles.dateButtonContent}>
                    <Text style={styles.dateButtonText}>
                      {formatDate(formData.endDate)}
                    </Text>
                    <IconButton
                      icon="calendar"
                      size={20}
                      iconColor={colors.primary}
                    />
                  </View>
                </TouchableOpacity>
                
                {showEndDatePicker && (
                  <DateTimePicker
                    value={formData.endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={formData.startDate} // End date must be >= start date
                    maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)} // 1 year ahead
                  />
                )}
              </View>

              {/* Duration Type */}
              <View style={styles.section}>
                <Text style={styles.label}>Duration</Text>
                <RadioButton.Group
                  onValueChange={(value) =>
                    setFormData({ ...formData, isFullDay: value === 'full' })
                  }
                  value={formData.isFullDay ? 'full' : 'partial'}
                >
                  <View style={styles.radioRow}>
                    <RadioButton value="full" color={colors.primary} />
                    <Text style={styles.radioLabel}>Full Day(s)</Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="partial" color={colors.primary} />
                    <Text style={styles.radioLabel}>Partial Day</Text>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Reason */}
              <View style={styles.section}>
                <TextInput
                  label={`Reason ${formData.type === 'Other' ? '*' : '(optional)'}`}
                  value={formData.reason}
                  onChangeText={(text) => setFormData({ ...formData, reason: text })}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                  theme={{ colors: { primary: colors.primary } }}
                  placeholder="Please provide details about your absence..."
                />
              </View>

              {/* Summary */}
              <View style={[styles.section, styles.summary]}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <Text style={styles.summaryText}>Type: {formData.type}</Text>
                <Text style={styles.summaryText}>Duration: {calculateDayCount()} day(s)</Text>
                <Text style={styles.summaryText}>
                  Period: {formatDate(formData.startDate)} to {formatDate(formData.endDate)}
                </Text>
                <Text style={styles.summaryText}>
                  Mode: {formData.isFullDay ? 'Full Day' : 'Partial Day'}
                </Text>
                <Text style={styles.validationNote}>
                  💡 Note: All absence requests must be for future dates only (starting tomorrow).
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
                disabled={loading}
              >
                {requestType === 'Request' ? 'Submit Request' : 'Declare Absence'}
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
    maxHeight: '90%',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  scrollContainer: {
    flex: 1,
    maxHeight: 350,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  menuButton: {
    borderColor: colors.border,
    justifyContent: 'flex-start',
  },
  menuButtonContent: {
    justifyContent: 'flex-start',
  },
  input: {
    backgroundColor: colors.surface,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.surface,
    minHeight: 56,
    justifyContent: 'center',
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  dateButtonText: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  radioLabel: {
    fontSize: fontSize.md,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  textArea: {
    backgroundColor: colors.surface,
  },
  summary: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  validationNote: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 0.48,
    borderColor: colors.border,
  },
  submitButton: {
    flex: 0.48,
    backgroundColor: colors.primary,
  },
});

export default AbsenceRequestModal; 