import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, Chip, Button, Badge, Avatar, Searchbar, ActivityIndicator, FAB } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../theme/colors';
import { messagingAPI } from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';
import ComposeMailModal from '../components/ComposeMailModal';

interface Conversation {
  _id: string;
  participants: any[];
  type: 'direct' | 'group';
  name?: string;
  lastMessage?: any;
  lastActivity: string;
  unreadCount: number;
  otherParticipant?: any;
  createdAt: string;
  updatedAt: string;
}

interface OnlineUser {
  userId: string;
  user: any;
}

const MessagesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [socketConnected, setSocketConnected] = useState(false);
  const [composeMailVisible, setComposeMailVisible] = useState(false);

  // Initialize socket connection and setup real-time updates
  useEffect(() => {
    initializeSocket();
    return () => {
      socketService.off('message:new');
      socketService.off('user:online');
      socketService.off('user:offline');
      socketService.off('connect');
      socketService.off('disconnect');
    };
  }, []);

  // Load conversations when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const initializeSocket = () => {
    // Connect to socket if not already connected
    if (!socketService.isSocketConnected()) {
      socketService.connect();
    }

    // Setup socket event listeners
    socketService.on('connect', () => {
      setSocketConnected(true);
      console.log('✅ Socket connected in Messages screen');
    });

    socketService.on('disconnect', () => {
      setSocketConnected(false);
      console.log('❌ Socket disconnected in Messages screen');
    });

    socketService.on('message:new', (data) => {
      console.log('📨 New message received in Messages screen:', data);
      updateConversationWithNewMessage(data);
    });

    socketService.on('user:online', (data: OnlineUser) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    socketService.on('user:offline', (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await messagingAPI.getConversations();
      
      if (response.success && response.data) {
        setConversations(response.data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const updateConversationWithNewMessage = (data: { message: any; conversationId: string }) => {
    setConversations(prevConversations => {
      return prevConversations.map(conv => {
        if (conv._id === data.conversationId) {
          return {
            ...conv,
            lastMessage: data.message,
            lastActivity: data.message.createdAt,
            unreadCount: data.message.sender._id !== user?._id 
              ? conv.unreadCount + 1 
              : conv.unreadCount
          };
        }
        return conv;
      }).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    });
  };

  const openConversation = (conversation: Conversation) => {
    // Navigate to chat screen
    (navigation as any).navigate('Chat', { 
      conversationId: conversation._id,
      conversationName: conversation.name || getConversationDisplayName(conversation),
      otherUser: conversation.otherParticipant
    });
  };

  const getConversationDisplayName = (conversation: Conversation): string => {
    if (conversation.name) {
      return conversation.name;
    }
    
    if (conversation.type === 'direct' && conversation.otherParticipant) {
      const other = conversation.otherParticipant;
      return `${other.firstName} ${other.lastName}`;
    }
    
    return 'Unknown';
  };

  const getLastMessagePreview = (message: any): string => {
    if (!message) return 'No messages yet';
    
    if (message.type === 'text') {
      return message.content || 'Message';
    }
    
    if (message.attachments && message.attachments.length > 0) {
      return `📎 ${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}`;
    }
    
    return `${message.type} message`;
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d`;
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const displayName = getConversationDisplayName(conv).toLowerCase();
    return displayName.includes(searchQuery.toLowerCase());
  });

  const startNewMessage = () => {
    // Navigate to user selection screen for new message
    (navigation as any).navigate('NewMessage');
  };

  const openComposeMail = () => {
    setComposeMailVisible(true);
  };

  const handleMailSent = () => {
    setComposeMailVisible(false);
    // Refresh conversations to show the new mail conversation
    loadConversations();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with search and connection status */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.connectionStatus}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: socketConnected ? colors.success : colors.error }
          ]} />
          <Text style={styles.statusText}>
            {socketConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <Searchbar
        placeholder="Search conversations..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      {/* Conversations list */}
      <ScrollView 
        style={styles.conversationsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredConversations.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No conversations yet</Text>
            <Text style={styles.emptyStateSubtext}>Start a new message to begin chatting!</Text>
          </View>
        ) : (
          filteredConversations.map((conversation) => (
            <TouchableOpacity
              key={conversation._id}
              onPress={() => openConversation(conversation)}
              style={styles.conversationItem}
            >
              <View style={styles.avatarContainer}>
                <Avatar.Text
                  size={50}
                  label={getConversationDisplayName(conversation).charAt(0).toUpperCase()}
                  style={styles.avatar}
                />
                {conversation.type === 'direct' && 
                 conversation.otherParticipant && 
                 onlineUsers.has(conversation.otherParticipant._id) && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationName} numberOfLines={1}>
                    {getConversationDisplayName(conversation)}
                  </Text>
                  <View style={styles.timeAndBadge}>
                    {conversation.lastMessage && (
                      <Text style={styles.timestamp}>
                        {formatMessageTime(conversation.lastMessage.createdAt)}
                      </Text>
                    )}
                    {conversation.unreadCount > 0 && (
                      <Badge 
                        style={styles.unreadBadge}
                        size={18}
                      >
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </Badge>
                    )}
                  </View>
                </View>
                
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {getLastMessagePreview(conversation.lastMessage)}
                </Text>
                
                {conversation.type === 'group' && (
                  <Text style={styles.participantCount}>
                    {conversation.participants.length} participants
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <FAB
          style={styles.mailFab}
          icon="email"
          onPress={openComposeMail}
          label="Send Mail"
          variant="secondary"
        />
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={startNewMessage}
          label="New Message"
        />
      </View>

      {/* Compose Mail Modal */}
      <ComposeMailModal
        visible={composeMailVisible}
        onDismiss={() => setComposeMailVisible(false)}
        onMailSent={handleMailSent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  searchBar: {
    margin: spacing.md,
    elevation: 0,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  conversationName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  timeAndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
  },
  lastMessage: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  participantCount: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionButtons: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'column',
  },
  fab: {
    backgroundColor: colors.primary,
  },
  mailFab: {
    backgroundColor: colors.secondary || '#6c757d',
    marginBottom: spacing.sm,
  },
});

export default MessagesScreen; 