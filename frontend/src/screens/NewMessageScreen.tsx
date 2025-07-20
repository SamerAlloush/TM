import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { 
  Searchbar, 
  Avatar, 
  Card, 
  ActivityIndicator,
  Button,
  Divider
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, messagingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize } from '../theme/colors';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const NewMessageScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        `${user.firstName} ${user.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      let response;
      
      try {
        // Try the new messaging contacts endpoint first (accessible to all users)
        console.log('🔍 Loading messaging contacts for user:', currentUser?.role);
        response = await userAPI.getMessagingContacts();
      } catch (contactsError: any) {
        console.log('📱 Messaging contacts failed, checking if user has admin access...');
        
        // If contacts endpoint fails and user is admin/RH, try the full users endpoint
        if (currentUser?.role === 'Administrator' || currentUser?.role === 'RH') {
          console.log('🔑 Admin user detected, trying full user list...');
          response = await userAPI.getAllUsers();
          
          if (response.success && response.data) {
            // Filter out current user from admin endpoint
            response.data = response.data.filter((user: User) => user._id !== currentUser?._id);
          }
        } else {
          throw contactsError; // Re-throw the original error for non-admin users
        }
      }
      
      if (response?.success && response.data) {
        console.log(`✅ Loaded ${response.data.length} contacts`);
        setUsers(response.data);
        setFilteredUsers(response.data);
      }
    } catch (error: any) {
      console.error('❌ Error loading users:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load contacts. Please try again.';
      
      if (error.message.includes('authorized')) {
        errorMessage = 'You don\'t have permission to view contacts. Please contact your administrator.';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('Not Found')) {
        errorMessage = 'Contacts service is temporarily unavailable. Please try again later.';
      }
      
      Alert.alert(
        'Error Loading Contacts',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: loadUsers }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.find(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const startConversation = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user to start a conversation.');
      return;
    }

    try {
      if (selectedUsers.length === 1) {
        // Start direct conversation
        const response = await messagingAPI.createConversation({
          type: 'direct',
          participants: [selectedUsers[0]._id]
        });

        if (response.success && response.data) {
          navigation.navigate('Chat', {
            conversationId: response.data._id,
            conversationName: `${selectedUsers[0].firstName} ${selectedUsers[0].lastName}`,
            otherUser: selectedUsers[0]
          });
        }
      } else {
        // Start group conversation
        Alert.prompt(
          'Group Name',
          'Enter a name for this group conversation:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create',
              onPress: async (groupName) => {
                if (!groupName?.trim()) {
                  Alert.alert('Error', 'Please enter a group name.');
                  return;
                }

                const response = await messagingAPI.createConversation({
                  type: 'group',
                  name: groupName.trim(),
                  participants: selectedUsers.map(u => u._id)
                });

                if (response.success && response.data) {
                  navigation.navigate('Chat', {
                    conversationId: response.data._id,
                    conversationName: groupName.trim()
                  });
                }
              }
            }
          ],
          'plain-text'
        );
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.find(u => u._id === item._id);

    return (
      <TouchableOpacity
        onPress={() => toggleUserSelection(item)}
        style={[styles.userItem, isSelected && styles.userItemSelected]}
      >
        <Avatar.Text
          size={40}
          label={`${item.firstName.charAt(0)}${item.lastName.charAt(0)}`}
          style={[styles.avatar, isSelected && styles.avatarSelected]}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isSelected && styles.userNameSelected]}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={[styles.userRole, isSelected && styles.userRoleSelected]}>
            {item.role}
          </Text>
          <Text style={[styles.userEmail, isSelected && styles.userEmailSelected]}>
            {item.email}
          </Text>
        </View>
        {isSelected && (
          <Ionicons 
            name="checkmark-circle" 
            size={24} 
            color={colors.primary} 
          />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>New Message</Text>
      </View>

      {/* Search bar */}
      <Searchbar
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
      />

      {/* Selected users count */}
      {selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedText}>
            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity onPress={() => setSelectedUsers([])}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Users list */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item._id}
        style={styles.usersList}
        ItemSeparatorComponent={() => <Divider />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No users found</Text>
          </View>
        }
      />

      {/* Start conversation button */}
      {selectedUsers.length > 0 && (
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={startConversation}
            style={styles.startButton}
            contentStyle={styles.buttonContent}
          >
            Start Conversation
            {selectedUsers.length > 1 && ' (Group)'}
          </Button>
        </View>
      )}
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
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    elevation: 2,
  },
  backButton: {
    marginRight: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchBar: {
    margin: spacing.md,
    elevation: 0,
  },
  selectedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary + '20',
  },
  selectedText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  clearText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  userItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  avatar: {
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  avatarSelected: {
    backgroundColor: colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  userNameSelected: {
    color: colors.primary,
  },
  userRole: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userRoleSelected: {
    color: colors.primary,
  },
  userEmail: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userEmailSelected: {
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  buttonContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    elevation: 8,
  },
  startButton: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
});

export default NewMessageScreen; 