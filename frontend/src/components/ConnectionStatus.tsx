import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import socketService, { ConnectionStatus as SocketConnectionStatus, ConnectionNotification } from '../services/socketService';
import { colors } from '../theme/colors';

interface ConnectionStatusProps {
  showNotifications?: boolean;
  showDetailed?: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showNotifications = true, 
  showDetailed = false 
}) => {
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>(
    socketService.getConnectionStatus()
  );
  const [notification, setNotification] = useState<ConnectionNotification | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Listen for connection status updates
    socketService.on('connection:status', (status: SocketConnectionStatus) => {
      setConnectionStatus(status);
    });

    // Listen for connection notifications
    if (showNotifications) {
      socketService.on('connection:notification', (notif: ConnectionNotification) => {
        setNotification(notif);
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Auto-hide notification
        const hideTimeout = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setNotification(null);
          });
        }, notif.duration || 3000);

        return () => clearTimeout(hideTimeout);
      });
    }

    return () => {
      socketService.off('connection:status');
      socketService.off('connection:notification');
    };
  }, [showNotifications, fadeAnim]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'connecting':
      case 'reconnecting':
        return colors.warning;
      case 'disconnected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'reconnecting':
        return '🔄';
      case 'disconnected':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return `Reconnecting... (${connectionStatus.reconnectAttempt}/${connectionStatus.maxReconnectAttempts})`;
      case 'disconnected':
        return connectionStatus.isOnline ? 'Disconnected' : 'Offline';
      default:
        return 'Unknown';
    }
  };

  const handleRetryConnection = () => {
    socketService.forceReconnect();
  };

  const formatLastConnected = (): string => {
    if (!connectionStatus.lastConnected) return 'Never';
    
    const now = new Date();
    const lastConnected = new Date(connectionStatus.lastConnected);
    const diffInSeconds = Math.floor((now.getTime() - lastConnected.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return lastConnected.toLocaleDateString();
  };

  const formatNextReconnect = (): string | null => {
    if (!connectionStatus.nextReconnectIn) return null;
    
    const seconds = Math.ceil(connectionStatus.nextReconnectIn / 1000);
    return `${seconds}s`;
  };

  return (
    <View style={styles.container}>
      {/* Main Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(connectionStatus.status) }]} />
        <Text style={styles.statusText}>
          {getStatusIcon(connectionStatus.status)} {getStatusText(connectionStatus.status)}
        </Text>
        
        {connectionStatus.status === 'disconnected' && connectionStatus.isOnline && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRetryConnection}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Detailed Status (Optional) */}
      {showDetailed && (
        <View style={styles.detailedStatus}>
          <Text style={styles.detailText}>
            Network: {connectionStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
          
          {connectionStatus.lastConnected && (
            <Text style={styles.detailText}>
              Last connected: {formatLastConnected()}
            </Text>
          )}
          
          {connectionStatus.status === 'reconnecting' && formatNextReconnect() && (
            <Text style={styles.detailText}>
              Next attempt in: {formatNextReconnect()}
            </Text>
          )}
          
          {connectionStatus.status === 'reconnecting' && (
            <Text style={styles.detailText}>
              Attempt {connectionStatus.reconnectAttempt}/{connectionStatus.maxReconnectAttempts}
            </Text>
          )}
        </View>
      )}

      {/* Notification Toast */}
      {notification && showNotifications && (
        <Animated.View 
          style={[
            styles.notificationContainer,
            { opacity: fadeAnim },
            { backgroundColor: getNotificationColor(notification.type) }
          ]}
        >
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const getNotificationColor = (type: string): string => {
  switch (type) {
    case 'success':
      return colors.success + '20';
    case 'warning':
      return colors.warning + '20';
    case 'error':
      return colors.error + '20';
    case 'info':
    default:
      return colors.primary + '20';
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
         backgroundColor: colors.surface,
     borderRadius: 8,
     borderWidth: 1,
     borderColor: colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
     statusText: {
     fontSize: 14,
     color: colors.text,
     flex: 1,
   },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailedStatus: {
    marginTop: 8,
    padding: 8,
         backgroundColor: colors.background,
    borderRadius: 6,
  },
     detailText: {
     fontSize: 12,
     color: colors.textSecondary,
     marginBottom: 2,
   },
  notificationContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
     notificationTitle: {
     fontSize: 14,
     fontWeight: '600',
     color: colors.text,
     marginBottom: 4,
   },
   notificationMessage: {
     fontSize: 12,
     color: colors.textSecondary,
   },
});

export default ConnectionStatus; 