import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, Button, Avatar, Chip, ActivityIndicator, Divider } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme/colors';
import AbsenceRequestModal from '../components/AbsenceRequestModal';
import { absenceAPI } from '../services/api';
import socketService from '../services/socketService';

interface AbsenceHistoryItem {
  _id: string;
  reason?: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  requestType: string;
  dayCount: number;
  origin?: string;
  approvedBy?: any;
  approvedAt?: string;
  createdAt: string;
}

interface CalendarData {
  [key: string]: {
    marked: boolean;
    dotColor: string;
    activeOpacity?: number;
    selectedColor?: string;
    absent?: boolean;
    working?: boolean;
    absenceInfo?: {
      reason: string;
      type: string;
      status: string;
      id?: string;
    };
  };
}

interface AbsenceStats {
  totalAbsences: number;
  totalDays: number;
  thisMonth: number;
}

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [declarationModalVisible, setDeclarationModalVisible] = useState(false);
  const [recentAbsences, setRecentAbsences] = useState<any[]>([]);
  const [absenceHistory, setAbsenceHistory] = useState<AbsenceHistoryItem[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [absenceStats, setAbsenceStats] = useState<AbsenceStats>({ totalAbsences: 0, totalDays: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [user?._id]);

  useEffect(() => {
    // Set up real-time listeners for absence updates
    const handleAbsenceUpdate = (data: any) => {
      console.log('Absence updated:', data);
      // Reload data when any absence is updated
      loadData();
    };

    const handleAbsenceApproval = (data: any) => {
      console.log('Absence approved:', data);
      // Reload data when absence is approved
      loadData();
      
      // Show notification if it's the current user's absence
      if (data.absence?.user?._id === user?._id) {
        Alert.alert(
          'Absence Approved ✅',
          `Your ${data.absence.type} request from ${formatDate(data.absence.startDate)} to ${formatDate(data.absence.endDate)} has been approved!`,
          [{ text: 'OK' }]
        );
      }
    };

    const handleAbsenceRejection = (data: any) => {
      console.log('Absence rejected:', data);
      // Reload data when absence is rejected
      loadData();
      
      // Show notification if it's the current user's absence
      if (data.absence?.user?._id === user?._id) {
        Alert.alert(
          'Absence Rejected ❌',
          `Your ${data.absence.type} request from ${formatDate(data.absence.startDate)} to ${formatDate(data.absence.endDate)} has been rejected.${data.rejectionReason ? `\n\nReason: ${data.rejectionReason}` : ''}`,
          [{ text: 'OK' }]
        );
      }
    };

    const handleAbsenceDeclaration = (data: any) => {
      console.log('Absence declared:', data);
      // Reload data when new absence is declared
      loadData();
    };

    // Listen for absence-related events
    socketService.on('absenceUpdated', handleAbsenceUpdate);
    socketService.on('absenceApproved', handleAbsenceApproval);
    socketService.on('absenceRejected', handleAbsenceRejection);
    socketService.on('absenceDeclared', handleAbsenceDeclaration);

    // Cleanup listeners on unmount
    return () => {
      socketService.off('absenceUpdated');
      socketService.off('absenceApproved');
      socketService.off('absenceRejected');
      socketService.off('absenceDeclared');
    };
  }, [user?._id]);

  const loadData = async () => {
    if (!user?._id) return;
    
    try {
      setLoading(true);
      await Promise.all([
        loadRecentAbsences(),
        loadAbsenceHistory()
      ]);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAbsences = async () => {
    try {
      const response = await absenceAPI.getMyAbsences();
      if (response.success && response.data) {
        // Get the 3 most recent absences
        const sortedAbsences = response.data
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 3);
        setRecentAbsences(sortedAbsences);
      }
    } catch (error: any) {
      console.error('Error loading recent absences:', error);
    }
  };

  const loadAbsenceHistory = async () => {
    if (!user?._id) return;
    
    try {
      setCalendarLoading(true);
      const response = await absenceAPI.getAbsenceHistory(user._id);
      if (response.success && response.data) {
        setAbsenceHistory(response.data.absenceHistory || []);
        setCalendarData(response.data.calendarData || {});
        setAbsenceStats(response.data.stats || { totalAbsences: 0, totalDays: 0, thisMonth: 0 });
      }
    } catch (error: any) {
      console.error('Error loading absence history:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleRequestAbsence = () => {
    setRequestModalVisible(true);
  };

  const handleDeclareAbsence = () => {
    setDeclarationModalVisible(true);
  };

  const handleAbsenceSuccess = async () => {
    // Reload all data after successful submission
    console.log('🔄 Refreshing absence data after successful submission...');
    setRefreshing(true);
    try {
      await loadData();
      console.log('✅ Absence data refreshed successfully');
    } finally {
      setRefreshing(false);
    }
  };

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    const dayData = calendarData[day.dateString];
    
    if (dayData?.absent && dayData.absenceInfo) {
      Alert.alert(
        'Absence Details',
        `Date: ${day.dateString}\nType: ${dayData.absenceInfo.type}\nReason: ${dayData.absenceInfo.reason}\nStatus: ${dayData.absenceInfo.status}`,
        [{ text: 'OK' }]
      );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return colors.success;
      case 'Pending': return colors.warning;
      case 'Rejected': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <Avatar.Icon size={64} icon="account" style={styles.avatar} />
              <View style={styles.profileInfo}>
                <Title style={styles.name}>
                  {user?.firstName} {user?.lastName}
                </Title>
                <Chip mode="outlined" style={styles.roleChip}>
                  {user?.role}
                </Chip>
                <Paragraph style={styles.email}>{user?.email}</Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Calendar & Absences</Title>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{absenceStats.totalAbsences}</Text>
                <Text style={styles.statLabel}>Total Absences</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{absenceStats.totalDays}</Text>
                <Text style={styles.statLabel}>Days Off</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{absenceStats.thisMonth}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.legendText}>Working Days</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ff4444' }]} />
                <Text style={styles.legendText}>Absence Days</Text>
              </View>
            </View>

            {calendarLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading calendar...</Text>
              </View>
            ) : (
              <Calendar
                style={styles.calendar}
                theme={{
                  backgroundColor: '#ffffff',
                  calendarBackground: '#ffffff',
                  textSectionTitleColor: colors.textSecondary,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textSecondary,
                  dotColor: colors.primary,
                  selectedDotColor: '#ffffff',
                  arrowColor: colors.primary,
                  monthTextColor: colors.text,
                  indicatorColor: colors.primary,
                  textDayFontWeight: '500',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
                markedDates={{
                  ...calendarData,
                  [selectedDate]: {
                    ...calendarData[selectedDate],
                    selected: true,
                    selectedColor: colors.primary,
                  },
                }}
                onDayPress={onDayPress}
                monthFormat={'MMMM yyyy'}
                enableSwipeMonths={true}
                hideExtraDays={true}
                disableMonthChange={false}
                markingType={'dot'}
              />
            )}
            
            <View style={styles.buttonContainer}>
              <Button 
                mode="contained" 
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleRequestAbsence}
                icon="calendar-plus"
              >
                Request Absence
              </Button>
              <Button 
                mode="outlined" 
                style={styles.button}
                onPress={handleDeclareAbsence}
                icon="alert-circle"
              >
                Declare Absence
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Recent Absences</Title>
            {loading ? (
              <Paragraph>Loading absences...</Paragraph>
            ) : recentAbsences.length > 0 ? (
              recentAbsences.map((absence) => (
                <View key={absence._id} style={styles.absenceItem}>
                  <View style={styles.absenceHeader}>
                    <Text style={styles.absenceDate}>
                      {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                    </Text>
                    <Chip 
                      mode="outlined" 
                      textStyle={[styles.chipText, { color: getStatusColor(absence.status) }]}
                      style={{ borderColor: getStatusColor(absence.status) }}
                    >
                      {absence.status}
                    </Chip>
                  </View>
                  <Paragraph style={styles.absenceDetails}>
                    {absence.type} • {absence.requestType} • {absence.dayCount} day(s)
                    {absence.reason && ` • ${absence.reason}`}
                  </Paragraph>
                </View>
              ))
            ) : (
              <Paragraph style={styles.noData}>
                No recent absences. Use the buttons above to request or declare an absence.
              </Paragraph>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Absence History</Title>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : absenceHistory.length > 0 ? (
              <ScrollView style={styles.historyContainer} nestedScrollEnabled>
                {absenceHistory.map((absence) => (
                  <View key={absence._id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <View style={styles.historyDateContainer}>
                        <Text style={styles.historyDate}>
                          {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                        </Text>
                        <Text style={styles.historyDuration}>
                          {absence.dayCount} day{absence.dayCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.historyStatusContainer}>
                        <Chip 
                          mode="outlined" 
                          textStyle={[styles.chipText, { color: getStatusColor(absence.status) }]}
                          style={{ borderColor: getStatusColor(absence.status) }}
                        >
                          {absence.status}
                        </Chip>
                        <Text style={styles.historyOrigin}>
                          {absence.origin === 'admin' ? '👨‍💼 Admin' : '👤 User'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyType}>{absence.type}</Text>
                      {absence.reason && (
                        <Text style={styles.historyReason}>"{absence.reason}"</Text>
                      )}
                      {absence.approvedBy && (
                        <Text style={styles.historyApprover}>
                          Approved by: {absence.approvedBy.firstName} {absence.approvedBy.lastName}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Paragraph style={styles.noData}>
                No absence history found.
              </Paragraph>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>My Tasks</Title>
            <Paragraph>📋 Foundation Excavation - In Progress</Paragraph>
            <Paragraph>🏗️ Electrical Installation Planning - Pending</Paragraph>
            <Paragraph>✅ Structural Assessment - Completed</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Assigned Sites</Title>
            <Paragraph>🏢 Résidence Les Jardins (Lyon)</Paragraph>
            <Paragraph>🏬 Centre Commercial Horizon (Marseille)</Paragraph>
          </Card.Content>
        </Card>

        <View style={styles.logoutContainer}>
          <Button 
            mode="contained" 
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: colors.error }]}
          >
            Logout
          </Button>
        </View>
      </View>

      {/* Absence Request Modal */}
      <AbsenceRequestModal
        visible={requestModalVisible}
        onDismiss={() => setRequestModalVisible(false)}
        requestType="Request"
        onSuccess={handleAbsenceSuccess}
      />

      {/* Absence Declaration Modal */}
      <AbsenceRequestModal
        visible={declarationModalVisible}
        onDismiss={() => setDeclarationModalVisible(false)}
        requestType="Declaration"
        onSuccess={handleAbsenceSuccess}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  profileCard: {
    marginBottom: spacing.lg,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.lg,
    marginBottom: spacing.xs,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  card: {
    marginBottom: spacing.md,
    elevation: 3,
  },
  calendarPlaceholder: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  calendarText: {
    fontSize: fontSize.lg,
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  button: {
    flex: 0.45,
  },
  absenceItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  absenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  absenceDate: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  chipText: {
    fontSize: fontSize.xs,
  },
  absenceDetails: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  noData: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: spacing.md,
  },
  logoutContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  logoutButton: {
    width: '50%',
  },
  // New styles for calendar and absence history
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    marginVertical: spacing.md,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  calendar: {
    marginVertical: spacing.md,
    borderRadius: 8,
    elevation: 2,
  },
  historyContainer: {
    maxHeight: 300,
    marginTop: spacing.sm,
  },
  historyItem: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  historyDateContainer: {
    flex: 1,
  },
  historyDate: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  historyDuration: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  historyStatusContainer: {
    alignItems: 'flex-end',
  },
  historyOrigin: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  historyDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  historyType: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  historyReason: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  historyApprover: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});

export default ProfileScreen; 