import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Chip,
  ActivityIndicator,
  Divider,
  Modal,
  Portal,
  TextInput,
} from 'react-native-paper';
import { colors, spacing, fontSize } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { absenceAPI } from '../services/api';
import api from '../services/api';
import socketService from '../services/socketService';
import InterventionRequestModal from '../components/InterventionRequestModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  Absence, 
  InterventionRequest, 
  PaginatedApiResponse,
  isAbsenceArray,
  isInterventionRequestArray,
  isPaginatedApiResponse
} from '../types/api';

// Types are now imported from '../types/api'

const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<Absence[]>([]);
  const [myAbsences, setMyAbsences] = useState<Absence[]>([]);
  const [interventionRequests, setInterventionRequests] = useState<InterventionRequest[]>([]);
  const [myInterventionRequests, setMyInterventionRequests] = useState<InterventionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [interventionModalVisible, setInterventionModalVisible] = useState(false);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string>('');

  const isAdminOrHR = user?.role === 'Administrator' || user?.role === 'RH';
  const isWorkshopUser = user?.role === 'Workshop' || user?.role === 'Administrator';
  const canRequestIntervention = user?.role === 'Worker' || 
                                user?.role === 'Conductors of Work' || 
                                user?.role === 'Project Manager' ||
                                user?.role === 'Administrator';

  const fetchData = useCallback(async () => {
    try {
      setError(null); // Clear previous errors
      const promises = [];
      
      // Get pending absence requests for Admin/HR
      if (isAdminOrHR) {
        promises.push(absenceAPI.getPendingAbsences());
      }
      
      // Get current user's absences
      promises.push(absenceAPI.getMyAbsences());
      
      // Get intervention requests for workshop users
      if (isWorkshopUser) {
        promises.push(api.get('/intervention-requests?status=pending'));
      }
      
      // Get current user's intervention requests
      if (canRequestIntervention) {
        promises.push(api.get('/intervention-requests?submittedBy=me'));
      }
      
      const results = await Promise.all(promises);
      let resultIndex = 0;
      
      if (isAdminOrHR) {
        const pendingAbsencesData = results[resultIndex]?.data;
        setPendingRequests(isAbsenceArray(pendingAbsencesData) ? pendingAbsencesData : []);
        resultIndex++;
      }
      
      const myAbsencesData = results[resultIndex]?.data;
      setMyAbsences(isAbsenceArray(myAbsencesData) ? myAbsencesData : []);
      resultIndex++;
      
      if (isWorkshopUser) {
        const interventionRequestsResponse = results[resultIndex];
        
        // Handle both direct array and paginated response
        let interventionRequestsData: InterventionRequest[] = [];
        if (isPaginatedApiResponse(interventionRequestsResponse?.data)) {
          const data = interventionRequestsResponse.data.data as InterventionRequest[];
          interventionRequestsData = isInterventionRequestArray(data) ? data : [];
        } else {
          const directData = interventionRequestsResponse?.data?.data || interventionRequestsResponse?.data;
          interventionRequestsData = isInterventionRequestArray(directData) ? directData : [];
        }
        
        setInterventionRequests(interventionRequestsData);
        resultIndex++;
      }
      
      if (canRequestIntervention) {
        const myInterventionRequestsResponse = results[resultIndex];
        
        // Handle both direct array and paginated response
        let myInterventionRequestsData: InterventionRequest[] = [];
        if (isPaginatedApiResponse(myInterventionRequestsResponse?.data)) {
          const data = myInterventionRequestsResponse.data.data as InterventionRequest[];
          myInterventionRequestsData = isInterventionRequestArray(data) ? data : [];
        } else {
          const directData = myInterventionRequestsResponse?.data?.data || myInterventionRequestsResponse?.data;
          myInterventionRequestsData = isInterventionRequestArray(directData) ? directData : [];
        }
        
        setMyInterventionRequests(myInterventionRequestsData);
      }
      
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load dashboard data';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdminOrHR, isWorkshopUser, canRequestIntervention]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket listeners for real-time updates
  useEffect(() => {
    // Listen for new absence requests (Admin/HR only)
    if (isAdminOrHR) {
      socketService.on('absence:new', (data) => {
        console.log('📬 New absence request received:', data);
        // Refresh pending requests
        fetchData();
        // Show notification
        Alert.alert(
          '🔔 New Absence Request',
          data.message,
          [{ text: 'View', onPress: () => fetchData() }, { text: 'OK' }]
        );
      });
    }

    // Listen for approval/rejection updates (for user's own requests)
    socketService.on('absence:approved', (data) => {
      console.log('✅ Absence approved:', data);
      fetchData();
      Alert.alert('✅ Request Approved', data.message, [{ text: 'OK' }]);
    });

    socketService.on('absence:rejected', (data) => {
      console.log('❌ Absence rejected:', data);
      fetchData();
      Alert.alert(
        '❌ Request Rejected', 
        `${data.message}\n\nReason: ${data.rejectionReason}`,
        [{ text: 'OK' }]
      );
    });

    // Listen for new intervention requests (Workshop/Admin only)
    if (isWorkshopUser) {
      socketService.on('intervention:new', (data) => {
        console.log('🔧 New intervention request received:', data);
        // Refresh intervention requests
        fetchData();
        // Show notification with priority indicator
        const priorityEmoji = data.priority === 'Urgent' ? '🚨' : 
                             data.priority === 'High' ? '⚠️' : 
                             data.priority === 'Medium' ? '📋' : '📝';
        const emergencyText = data.isEmergency ? ' (EMERGENCY)' : '';
        
        Alert.alert(
          `${priorityEmoji} New Intervention Request${emergencyText}`,
          data.message,
          [
            { text: 'View', onPress: () => fetchData() }, 
            { text: 'OK' }
          ]
        );
      });
    }

    // Listen for intervention status updates (for requesters)
    if (canRequestIntervention) {
      socketService.on('intervention:statusUpdate', (data) => {
        console.log('📋 Intervention status updated:', data);
        fetchData();
        Alert.alert(
          '📋 Request Updated', 
          data.message,
          [{ text: 'OK' }]
        );
      });

      socketService.on('intervention:assigned', (data) => {
        console.log('👷 Intervention assigned:', data);
        fetchData();
        Alert.alert(
          '👷 Request Assigned', 
          data.message,
          [{ text: 'OK' }]
        );
      });

      socketService.on('intervention:comment', (data) => {
        console.log('💬 New intervention comment:', data);
        fetchData();
        Alert.alert(
          '💬 New Comment', 
          data.message,
          [
            { text: 'View', onPress: () => fetchData() }, 
            { text: 'OK' }
          ]
        );
      });
    }

    // Cleanup listeners on unmount
    return () => {
      socketService.off('absence:new');
      socketService.off('absence:approved');
      socketService.off('absence:rejected');
      socketService.off('intervention:new');
      socketService.off('intervention:statusUpdate');
      socketService.off('intervention:assigned');
      socketService.off('intervention:comment');
    };
  }, [isAdminOrHR, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleApprove = async (absenceId: string) => {
    setActionLoading(absenceId);
    try {
      await absenceAPI.approveAbsence(absenceId);
      Alert.alert('Success', 'Absence request approved successfully');
      fetchData(); // Refresh data
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve absence request');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!selectedAbsenceId) return;
    
    setActionLoading(selectedAbsenceId);
    try {
      await absenceAPI.rejectAbsence(selectedAbsenceId, rejectionReason);
      setRejectModalVisible(false);
      setRejectionReason('');
      setSelectedAbsenceId('');
      Alert.alert('Success', 'Absence request rejected successfully');
      fetchData(); // Refresh data
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject absence request');
    } finally {
      setActionLoading('');
    }
  };

  const handleInterventionSuccess = () => {
    setInterventionModalVisible(false);
    fetchData(); // Refresh data to show new request
  };

  const handleInterventionStatusUpdate = async (requestId: string, status: string) => {
    setActionLoading(requestId);
    try {
      await api.put(`/intervention-requests/${requestId}/status`, { status });
      Alert.alert('Success', `Intervention request ${status.toLowerCase()} successfully`);
      fetchData(); // Refresh data
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update intervention request');
    } finally {
      setActionLoading('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return '#ff9800';
      case 'Approved': return '#4caf50';
      case 'Rejected': return '#f44336';
      case 'Declared': return '#2196f3';
      default: return '#9e9e9e';
    }
  };

  const getInterventionStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#ff9800';
      case 'in_progress': return '#2196f3';
      case 'assigned': return '#9c27b0';
      case 'completed': return '#4caf50';
      case 'rejected': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low': return '#4caf50';
      case 'Medium': return '#ff9800';
      case 'High': return '#ff5722';
      case 'Urgent': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const formatInterventionStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderAbsenceCard = (absence: Absence, showActions: boolean = false) => (
    <Card key={absence._id} style={styles.absenceCard}>
      <Card.Content>
        <View style={styles.absenceHeader}>
          <View style={styles.absenceInfo}>
            <Text style={styles.absenceName}>
              {showActions ? `${absence.user.firstName} ${absence.user.lastName}` : absence.type}
            </Text>
            <Text style={styles.absenceRole}>
              {showActions ? absence.user.role : `${formatDate(absence.startDate)} - ${formatDate(absence.endDate)}`}
            </Text>
          </View>
          <Chip 
            style={[styles.statusChip, { backgroundColor: getStatusColor(absence.status) }]}
            textStyle={styles.statusText}
          >
            {absence.status}
          </Chip>
        </View>
        
        {showActions && (
          <Text style={styles.absenceDetails}>
            {absence.type} • {formatDate(absence.startDate)} - {formatDate(absence.endDate)} • {absence.dayCount} day(s)
          </Text>
        )}
        
        {absence.reason && (
          <Text style={styles.absenceReason}>{absence.reason}</Text>
        )}
        
        {showActions && absence.status === 'Pending' && (
          <View style={styles.actionButtons}>
            <Button 
              mode="contained" 
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(absence._id)}
              loading={actionLoading === absence._id}
              disabled={!!actionLoading}
            >
              ✅ Approve
            </Button>
            <Button 
              mode="outlined" 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => {
                setSelectedAbsenceId(absence._id);
                setRejectModalVisible(true);
              }}
              loading={actionLoading === absence._id}
              disabled={!!actionLoading}
            >
              ❌ Reject
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const renderInterventionCard = (request: InterventionRequest, showActions: boolean = false) => (
    <Card key={request._id} style={styles.absenceCard}>
      <Card.Content>
        <View style={styles.absenceHeader}>
          <View style={styles.absenceInfo}>
            <Text style={styles.absenceName}>
              {request.title}
              {request.isEmergency && <Text style={styles.emergencyFlag}> 🚨</Text>}
            </Text>
            <Text style={styles.absenceRole}>
              {showActions ? `${request.submittedBy.firstName} ${request.submittedBy.lastName} (${request.submittedBy.role})` : formatDate(request.createdAt)}
            </Text>
            {request.relatedSite && (
              <Text style={styles.absenceRole}>📍 {request.relatedSite.name}</Text>
            )}
          </View>
          <View style={styles.chipContainer}>
            <Chip 
              style={[styles.statusChip, { backgroundColor: getPriorityColor(request.priority) }]}
              textStyle={styles.statusText}
            >
              {request.priority}
            </Chip>
            <Chip 
              style={[styles.statusChip, { backgroundColor: getInterventionStatusColor(request.status) }]}
              textStyle={styles.statusText}
            >
              {formatInterventionStatus(request.status)}
            </Chip>
          </View>
        </View>
        
        <Text style={styles.absenceReason} numberOfLines={2}>{request.description}</Text>
        
        {showActions && request.status === 'pending' && (
          <View style={styles.actionButtons}>
            <Button 
              mode="contained" 
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleInterventionStatusUpdate(request._id, 'assigned')}
              loading={actionLoading === request._id}
              disabled={!!actionLoading}
            >
              📋 Assign
            </Button>
            <Button 
              mode="outlined" 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleInterventionStatusUpdate(request._id, 'in_progress')}
              loading={actionLoading === request._id}
              disabled={!!actionLoading}
            >
              🔧 Start Work
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Card style={styles.errorCard}>
          <Card.Content>
            <Title style={styles.errorTitle}>⚠️ Error Loading Dashboard</Title>
            <Paragraph style={styles.errorMessage}>{error}</Paragraph>
            <Button 
              mode="contained" 
              onPress={() => {
                setError(null);
                fetchData();
              }}
              style={styles.retryButton}
              icon="refresh"
            >
              Retry
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>📊 Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back, {user?.firstName}!</Text>
        
        {/* Intervention Request Button for Eligible Users */}
        {canRequestIntervention && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>🔧 Request Intervention</Title>
              <Paragraph style={styles.sectionDescription}>
                Submit a new intervention request for equipment, maintenance, or repairs
              </Paragraph>
              <Button
                mode="contained"
                icon="tools"
                style={styles.interventionButton}
                onPress={() => setInterventionModalVisible(true)}
              >
                Submit Intervention Request
              </Button>
            </Card.Content>
          </Card>
        )}
        
        {/* Workshop Dashboard Section (Workshop Users) */}
        {isWorkshopUser && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>🔧 Workshop Intervention Requests</Title>
              <Paragraph style={styles.sectionDescription}>
                Intervention requests assigned to the workshop team
              </Paragraph>
              
              {!Array.isArray(interventionRequests) || interventionRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>✅ No pending interventions</Text>
                  <Text style={styles.emptySubtext}>All intervention requests have been processed</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countText}>
                    {interventionRequests.length} request(s) awaiting action
                  </Text>
                  {interventionRequests.map(request => renderInterventionCard(request, true))}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Pending Absence Requests Section (Admin/HR only) */}
        {isAdminOrHR && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>🔔 Pending Absence Requests</Title>
              <Paragraph style={styles.sectionDescription}>
                Review and approve absence requests from your team members
              </Paragraph>
              
              {!Array.isArray(pendingRequests) || pendingRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>✅ No pending requests</Text>
                  <Text style={styles.emptySubtext}>All absence requests have been processed</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countText}>
                    {pendingRequests.length} request(s) awaiting approval
                  </Text>
                  {pendingRequests.map(absence => renderAbsenceCard(absence, true))}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* My Absences Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>📅 My Absence Requests</Title>
            <Paragraph style={styles.sectionDescription}>
              Your recent absence requests and their status
            </Paragraph>
            
            {!Array.isArray(myAbsences) || myAbsences.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>📝 No absence requests</Text>
                <Text style={styles.emptySubtext}>You haven't submitted any absence requests yet</Text>
              </View>
            ) : (
              <>
                <Text style={styles.countText}>
                  {myAbsences.length} request(s) total
                </Text>
                {myAbsences.slice(0, 5).map(absence => renderAbsenceCard(absence, false))}
                {myAbsences.length > 5 && (
                  <Text style={styles.moreText}>And {myAbsences.length - 5} more...</Text>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        {/* My Intervention Requests Section */}
        {canRequestIntervention && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>🔧 My Intervention Requests</Title>
              <Paragraph style={styles.sectionDescription}>
                Your submitted intervention requests and their status
              </Paragraph>
              
              {!Array.isArray(myInterventionRequests) || myInterventionRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>📝 No intervention requests</Text>
                  <Text style={styles.emptySubtext}>You haven't submitted any intervention requests yet</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.countText}>
                    {myInterventionRequests.length} request(s) total
                  </Text>
                  {myInterventionRequests.slice(0, 5).map(request => renderInterventionCard(request, false))}
                  {myInterventionRequests.length > 5 && (
                    <Text style={styles.moreText}>And {myInterventionRequests.length - 5} more...</Text>
                  )}
                </>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Quick Stats */}
        <Card style={styles.card}>
          <Card.Content>
            <Title>📈 Quick Stats</Title>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {isAdminOrHR 
                    ? (Array.isArray(pendingRequests) ? pendingRequests.length : 0)
                    : (Array.isArray(myAbsences) ? myAbsences.filter(a => a.status === 'Pending').length : 0)
                  }
                </Text>
                <Text style={styles.statLabel}>
                  {isAdminOrHR ? 'Pending Absences' : 'My Pending'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {isWorkshopUser 
                    ? (Array.isArray(interventionRequests) ? interventionRequests.length : 0)
                    : (Array.isArray(myInterventionRequests) ? myInterventionRequests.filter(r => r.status === 'pending').length : 0)
                  }
                </Text>
                <Text style={styles.statLabel}>
                  {isWorkshopUser ? 'Workshop Queue' : 'My Interventions'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {Array.isArray(myAbsences) ? myAbsences.reduce((sum, absence) => sum + absence.dayCount, 0) : 0}
                </Text>
                <Text style={styles.statLabel}>Absence Days</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Rejection Modal */}
      <Portal>
        <Modal
          visible={rejectModalVisible}
          onDismiss={() => {
            setRejectModalVisible(false);
            setRejectionReason('');
            setSelectedAbsenceId('');
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Card style={styles.modalCard}>
            <Card.Content>
              <Title>Reject Absence Request</Title>
              <Paragraph style={styles.modalDescription}>
                Please provide a reason for rejecting this absence request:
              </Paragraph>
              
              <TextInput
                mode="outlined"
                label="Rejection Reason"
                value={rejectionReason}
                onChangeText={setRejectionReason}
                style={styles.textInput}
                multiline
                numberOfLines={3}
                placeholder="e.g., Insufficient notice, conflicting schedules..."
              />
              
              <View style={styles.modalActions}>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setRejectModalVisible(false);
                    setRejectionReason('');
                    setSelectedAbsenceId('');
                  }}
                  style={styles.modalButton}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={handleReject}
                  style={[styles.modalButton, styles.rejectModalButton]}
                  loading={!!actionLoading}
                  disabled={!rejectionReason.trim() || !!actionLoading}
                >
                  Reject Request
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      {/* Intervention Request Modal */}
      <InterventionRequestModal
        visible={interventionModalVisible}
        onDismiss={() => setInterventionModalVisible(false)}
        onSuccess={handleInterventionSuccess}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
  },
  errorTitle: {
    textAlign: 'center',
    color: colors.error,
    marginBottom: spacing.md,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  retryButton: {
    width: '100%',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.md,
    elevation: 3,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  countText: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  absenceCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    elevation: 1,
  },
  absenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  absenceInfo: {
    flex: 1,
  },
  absenceName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  absenceRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  absenceDetails: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  absenceReason: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  approveButton: {
    backgroundColor: '#4caf50',
  },
  rejectButton: {
    borderColor: '#f44336',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  moreText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalContainer: {
    padding: spacing.lg,
  },
  modalCard: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  modalDescription: {
    marginBottom: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  textInput: {
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  rejectModalButton: {
    backgroundColor: '#f44336',
  },
  emergencyFlag: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'column',
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  interventionButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
});

// Wrap the DashboardScreen with ErrorBoundary
const DashboardScreenWithErrorBoundary: React.FC = () => (
  <ErrorBoundary>
    <DashboardScreen />
  </ErrorBoundary>
);

export default DashboardScreenWithErrorBoundary; 