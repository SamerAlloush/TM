import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Text,
  Alert,
  Image,
  TouchableOpacity
} from 'react-native';
import { 
  Appbar, 
  TextInput, 
  IconButton, 
  Avatar, 
  Surface,
  ActivityIndicator,
  Chip,
  Divider
} from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../theme/colors';
import { messagingAPI } from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';
import MediaPicker from '../components/MediaPicker';
import MediaMessage from '../components/MediaMessage';
import MediaGallery from '../components/MediaGallery';
import { platformMediaUploadService, MediaFile } from '../services/PlatformMediaUploadService';
import WebFileUpload, { WebFile } from '../components/WebFileUpload';
import webMediaUploadService from '../services/WebMediaUploadService';
import ImagePreview, { PreviewFile } from '../components/ImagePreview';

// Import Message type from api
import { Message } from '../services/api';

interface ChatScreenParams {
  conversationId: string;
  conversationName: string;
  otherUser?: any;
}

const ChatScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { conversationId, conversationName, otherUser } = route.params as ChatScreenParams;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [selectedWebFiles, setSelectedWebFiles] = useState<WebFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDetails, setUploadDetails] = useState<any>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
    setupSocketListeners();
    
    // Join conversation room
    if (socketService.isSocketConnected()) {
      socketService.joinConversation(conversationId);
    }

    return () => {
      // Leave conversation room
      if (socketService.isSocketConnected()) {
        socketService.leaveConversation(conversationId);
      }
      socketService.off('message:new');
      socketService.off('user:online');
      socketService.off('user:offline');
    };
  }, [conversationId]);

  const setupSocketListeners = () => {
    socketService.on('message:new', (data) => {
      if (data.conversationId === conversationId) {
        // 🔄 PREVENT DUPLICATES: Check if message already exists
        setMessages(prev => {
          const messageExists = prev.some(msg => msg._id === data.message._id);
          if (messageExists) {
            console.log('📝 Message already exists, skipping duplicate');
            return prev;
          }
          
          // Remove any temporary message for this content (optimistic update replacement)
          const filteredMessages = prev.filter(msg => 
            !(msg._id.startsWith('temp_') && 
              msg.content === data.message.content && 
              msg.sender._id === data.message.sender._id)
          );
          
          return [data.message, ...filteredMessages];
        });
      }
    });

    // Upload progress listeners
    socketService.on('upload:progress', (data) => {
      console.log('📊 Upload progress:', data);
      
      if (data.conversationId === conversationId) {
        setUploadProgress(data.progress);
        setUploadDetails(data);
        
        if (data.status === 'processing') {
          setUploadStatus(`Processing ${data.currentFile || 'files'}... ${data.progress}%`);
          setIsUploading(true);
        } else if (data.status === 'ready') {
          setUploadStatus('Upload complete!');
          setIsUploading(false);
          setTimeout(() => {
            setUploadStatus('');
            setUploadDetails(null);
          }, 2000);
        }
      }
    });

    socketService.on('upload:error', (data) => {
      console.log('❌ Upload error:', data);
      
      if (data.conversationId === conversationId) {
        setUploadStatus('Upload failed');
        setIsUploading(false);
        Alert.alert('Upload Error', data.error || 'Failed to upload files');
        setTimeout(() => {
          setUploadStatus('');
          setUploadDetails(null);
        }, 3000);
      }
    });

    socketService.on('media_upload_complete', (data) => {
      console.log('✅ Media upload complete:', data);
      
      if (data.conversationId === conversationId) {
        setUploadStatus('Media uploaded successfully!');
        setIsUploading(false);
        setTimeout(() => {
          setUploadStatus('');
          setUploadDetails(null);
        }, 2000);
      }
    });

    socketService.on('user:online', (data) => {
      if (otherUser && data.userId === otherUser._id) {
        setOnlineStatus(true);
      }
    });

    socketService.on('user:offline', (data) => {
      if (otherUser && data.userId === otherUser._id) {
        setOnlineStatus(false);
      }
    });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await messagingAPI.getMessages(conversationId);
      
      if (response.success && response.data) {
        // Sort messages by creation date (newest first for FlatList)
        const sortedMessages = response.data.sort((a: Message, b: Message) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    setNewMessage('');
    setSending(true);

    // 🚀 OPTIMISTIC UI UPDATE: Add message immediately
    const optimisticMessage: Message = {
      _id: tempId,
      conversation: conversationId,
      sender: {
        _id: user?._id || '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        role: user?.role || '',
        isActive: user?.isActive || true
      },
      content: messageContent,
      type: 'text',
      attachments: [],
      reactions: {},
      status: 'sending', // Show sending status
      readBy: {},
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add optimistic message to UI immediately
    setMessages(prev => [optimisticMessage, ...prev]);

    try {
      // 🔍 DEBUG: Log the send attempt
      console.log('🚀 ChatScreen: Attempting to send message:', {
        conversationId,
        messageLength: messageContent.length,
        user: user?.email,
        timestamp: new Date().toISOString(),
        tempId
      });

      const response = await messagingAPI.sendMessage(conversationId, messageContent, 'text');

      if (response.success && response.data) {
        console.log('✅ ChatScreen: Message sent successfully');
        
        // 🔄 UPDATE OPTIMISTIC MESSAGE: Replace temp message with real one
        if (response.data) {
          setMessages(prev => prev.map(msg => 
            msg._id === tempId 
              ? response.data!
              : msg
          ));
        }
      }
    } catch (error: any) {
      console.error('❌ ChatScreen: Error sending message:', error);
      
      // 🚫 ROLLBACK OPTIMISTIC UPDATE: Mark as failed and allow retry
      setMessages(prev => prev.map(msg => 
        msg._id === tempId 
          ? { ...msg, status: 'failed' }
          : msg
      ));
      
      // Provide more specific error messages to user
      let userMessage = 'Failed to send message. Please try again.';
      
      if (error.message.includes('401') || error.message.includes('authentication')) {
        userMessage = 'Session expired. Please log in again.';
      } else if (error.message.includes('403') || error.message.includes('Not authorized')) {
        userMessage = 'You are not authorized to send messages in this conversation.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        userMessage = 'This conversation no longer exists.';
      } else if (error.message.includes('Network Error') || error.message.includes('timeout')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('EMPTY_CONTENT')) {
        userMessage = 'Message cannot be empty.';
      }
      
      Alert.alert('Error', userMessage);
      setNewMessage(messageContent); // Restore message content
    } finally {
      setSending(false);
    }
  };

  const handleMediaSelected = (media: MediaFile[]) => {
    setSelectedMedia(prev => [...prev, ...media]);
    console.log('📎 Media selected:', media.length, 'items');
    
    // Add to preview files
    const newPreviewFiles: PreviewFile[] = media.map((file, index) => ({
      id: `mobile_${Date.now()}_${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUri: file.uri,
      file: file
    }));
    
    setPreviewFiles(prev => [...prev, ...newPreviewFiles]);
    console.log('📎 Validation terminée, fichiers prêts à être envoyés:', newPreviewFiles);
  };

  const handleWebFilesSelected = (files: WebFile[]) => {
    setSelectedWebFiles(prev => [...prev, ...files]);
    console.log('📎 Web files selected:', files.length, 'items');
    
    // Add to preview files
    const newPreviewFiles: PreviewFile[] = files.map((file, index) => ({
      id: `web_${Date.now()}_${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUri: file.preview,
      file: file
    }));
    
    setPreviewFiles(prev => [...prev, ...newPreviewFiles]);
    console.log('📎 Médias ajoutés avec succès');
    console.log('✅ Prêt à envoyer');
    console.log('📎 Validation terminée, fichiers prêts à être envoyés:', newPreviewFiles);
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const removeWebFile = (index: number) => {
    setSelectedWebFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removePreviewFile = (fileId: string) => {
    setPreviewFiles(prev => prev.filter(file => file.id !== fileId));
    
    // Also remove from corresponding arrays
    if (fileId.startsWith('mobile_')) {
      const mobileIndex = previewFiles.findIndex(f => f.id === fileId);
      if (mobileIndex >= 0) {
        setSelectedMedia(prev => prev.filter((_, i) => i !== mobileIndex));
      }
    } else if (fileId.startsWith('web_')) {
      const webIndex = previewFiles.findIndex(f => f.id === fileId);
      if (webIndex >= 0) {
        setSelectedWebFiles(prev => prev.filter((_, i) => i !== webIndex));
      }
    }
  };

  const sendMessageWithMedia = async () => {
    const hasText = newMessage.trim().length > 0;
    const hasMobileMedia = selectedMedia.length > 0;
    const hasWebFiles = selectedWebFiles.length > 0;
    
    // Allow sending with media only (no text required)
    if ((!hasText && !hasMobileMedia && !hasWebFiles) || sending) return;

    // Determine message content
    const messageContent = hasText ? newMessage.trim() : '[Media]';
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const mediaFiles = [...selectedMedia];
    const webFiles = [...selectedWebFiles];
    
    // Clear inputs immediately
    setNewMessage('');
    setSelectedMedia([]);
    setSelectedWebFiles([]);
    setPreviewFiles([]); // Clear preview files
    setSending(true);
    setIsUploading(true);
    setUploadStatus('Envoi en cours...');

    console.log('📎 Preparing to send:', {
      hasText,
      mediaFiles: mediaFiles.length,
      webFiles: webFiles.length,
      messageType: hasText ? (hasMobileMedia || hasWebFiles ? 'mixed' : 'text') : 'media-only'
    });

    // Ne pas envoyer un message optimiste s'il contient un média non encore uploadé
    // Afficher un loader pendant l'upload

    // 🚀 OPTIMISTIC UI UPDATE: Add message immediately with media
    const optimisticMessage: Message = {
      _id: tempId,
      conversation: conversationId,
      sender: {
        _id: user?._id || '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        role: user?.role || '',
        isActive: user?.isActive || true
      },
      content: messageContent,
      type: hasMobileMedia || hasWebFiles 
        ? (mediaFiles[0]?.isImage || webFiles[0]?.isImage ? 'image' : 
           mediaFiles[0]?.isVideo || webFiles[0]?.isVideo ? 'video' : 'document') 
        : 'text',
      attachments: [
        ...mediaFiles.map(media => ({
          fileName: media.name,
          originalName: media.name,
          mimeType: media.mimeType || 'application/octet-stream',
          size: media.size,
          url: media.uri, // Use local URI for preview
          thumbnailUrl: undefined
        })),
        ...webFiles.map(webFile => ({
          fileName: webFile.name,
          originalName: webFile.name,
          mimeType: webFile.type,
          size: webFile.size,
          url: webFile.preview || '', // Use preview URL if available
          thumbnailUrl: undefined
        }))
      ],
      reactions: {},
      status: 'sending',
      readBy: {},
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setMessages(prev => [optimisticMessage, ...prev]);

    try {
      let response;
      
      if (webFiles.length > 0) {
        // Send with web files using FormData
        console.log('🌐 Sending web files via FormData');
        setUploadStatus('Envoi des fichiers...');
        
        response = await webMediaUploadService.uploadFiles(
          conversationId, 
          messageContent, 
          webFiles,
          (progress) => {
            setUploadProgress(progress.percentage);
            setUploadStatus(`Envoi... ${progress.percentage}%`);
          }
        );
        
        if (response.success) {
          console.log('✅ Web files uploaded successfully');
          setUploadStatus('Envoi terminé!');
          
          // Emit new_message event for real-time sync
          if (response.data && socketService.isSocketConnected()) {
            console.log('📡 Emitting new_message event for real-time sync');
          }
        } else {
          throw new Error(response.error || 'Upload failed');
        }
      } else if (mediaFiles.length > 0) {
        // Send with mobile media attachments
        console.log('📱 Sending mobile media files');
        setUploadStatus('Envoi des médias...');
        
        response = await messagingAPI.sendMessageWithFiles(
          conversationId, 
          messageContent, 
          mediaFiles, 
          'text'
        );
      } else {
        // Send text only
        console.log('📝 Sending text only');
        response = await messagingAPI.sendMessage(conversationId, messageContent, 'text');
      }

      if (response.success && response.data) {
        console.log('✅ ChatScreen: Message sent successfully');
        setUploadStatus('Message envoyé!');
        
        // Replace optimistic message with real one
        setMessages(prev => prev.map(msg => 
          msg._id === tempId 
            ? response.data!
            : msg
        ));
        
        // Clear upload status after a delay
        setTimeout(() => {
          setUploadStatus('');
          setUploadProgress(0);
        }, 1000);
      }
    } catch (error: any) {
      console.error('❌ ChatScreen: Error sending message:', error);
      setUploadStatus('Erreur lors de l\'envoi');
      
      // Check if response is not valid JSON
      if (error.message?.includes('JSON.parse') || error.message?.includes('Unexpected token')) {
        console.error('🚨 Erreur serveur : Invalid JSON response');
        Alert.alert('Erreur', 'Le serveur a retourné une réponse invalide. Veuillez réessayer.');
      } else {
        Alert.alert('Erreur', error.message || 'Échec de l\'envoi du message. Veuillez réessayer.');
      }
      
      // Rollback optimistic update
      setMessages(prev => prev.filter(msg => msg._id !== tempId));
      
      // Restore inputs
      setNewMessage(messageContent);
      setSelectedMedia(mediaFiles);
      setSelectedWebFiles(webFiles);
      
      // Restore preview files
      const restoredPreviewFiles: PreviewFile[] = [
        ...mediaFiles.map((file, index) => ({
          id: `mobile_${Date.now()}_${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUri: file.uri,
          file: file
        })),
        ...webFiles.map((file, index) => ({
          id: `web_${Date.now()}_${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUri: file.preview,
          file: file
        }))
      ];
      setPreviewFiles(restoredPreviewFiles);
      
      // Clear upload status after a delay
      setTimeout(() => {
        setUploadStatus('');
        setUploadProgress(0);
      }, 3000);
    } finally {
      setSending(false);
      setIsUploading(false);
    }
  };

  const renderUploadProgress = () => {
    if (!isUploading && !uploadStatus) return null;

    return (
      <View style={styles.uploadProgressContainer}>
        <View style={styles.uploadProgressContent}>
          {isUploading && (
            <View style={styles.uploadProgressBar}>
              <View 
                style={[
                  styles.uploadProgressFill, 
                  { width: `${uploadProgress}%` }
                ]} 
              />
            </View>
          )}
          
          <Text style={styles.uploadProgressText}>
            {uploadStatus || 'Uploading...'}
          </Text>
          
          {uploadDetails && (
            <Text style={styles.uploadDetailsText}>
              {uploadDetails.fileIndex}/{uploadDetails.totalFiles} files
              {uploadDetails.currentFile && ` • ${uploadDetails.currentFile}`}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderMediaPreview = () => {
    const hasMobileMedia = selectedMedia.length > 0;
    const hasWebFiles = selectedWebFiles.length > 0;
    
    if (!hasMobileMedia && !hasWebFiles) return null;

    return (
      <View style={styles.mediaPreviewContainer}>
        <Text style={styles.mediaPreviewTitle}>
          Attachments ({selectedMedia.length + selectedWebFiles.length})
        </Text>
        
        {/* Mobile Media Preview */}
        {hasMobileMedia && (
          <FlatList
            horizontal
            data={selectedMedia}
            keyExtractor={(item, index) => `mobile_${item.uri}_${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.mediaPreviewItem}>
                {item.isImage && (
                  <Image source={{ uri: item.uri }} style={styles.mediaPreviewImage} />
                )}
                {!item.isImage && (
                  <View style={styles.mediaPreviewDocument}>
                    <Text style={styles.mediaPreviewDocumentIcon}>
                      {item.isVideo ? '🎥' : '📄'}
                    </Text>
                    <Text style={styles.mediaPreviewDocumentName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.mediaRemoveButton}
                  onPress={() => removeMedia(index)}
                >
                  <Text style={styles.mediaRemoveButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.mediaPreviewList}
          />
        )}
        
        {/* Web Files Preview */}
        {hasWebFiles && (
          <FlatList
            horizontal
            data={selectedWebFiles}
            keyExtractor={(item, index) => `web_${item.name}_${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.mediaPreviewItem}>
                {item.isImage && item.preview ? (
                  <Image source={{ uri: item.preview }} style={styles.mediaPreviewImage} />
                ) : (
                  <View style={styles.mediaPreviewDocument}>
                    <Text style={styles.mediaPreviewDocumentIcon}>
                      {item.isVideo ? '🎥' : item.isAudio ? '🎵' : '📄'}
                    </Text>
                    <Text style={styles.mediaPreviewDocumentName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.mediaRemoveButton}
                  onPress={() => removeWebFile(index)}
                >
                  <Text style={styles.mediaRemoveButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.mediaPreviewList}
          />
        )}
        
        <Divider style={styles.mediaPreviewDivider} />
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender._id === user?._id;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isOwnMessage && (
          <Avatar.Text 
            size={32} 
            label={item.sender.firstName[0] + item.sender.lastName[0]} 
            style={styles.avatar}
          />
        )}
        
        <MediaMessage
          message={item}
          isOwnMessage={isOwnMessage}
          onPress={() => {
            // Handle media press - could open gallery
            if (item.attachments && item.attachments.length > 0) {
              // TODO: Open media gallery
            }
          }}
          onLongPress={() => {
            // Handle long press - could show options
          }}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <Appbar.Header>
      <Appbar.BackAction onPress={() => navigation.goBack()} />
      <View style={styles.headerContent}>
        {otherUser && (
          <Avatar.Text 
            size={40} 
            label={otherUser.firstName[0] + otherUser.lastName[0]} 
            style={styles.headerAvatar}
          />
        )}
        <View style={styles.headerText}>
          <Appbar.Content title={conversationName} />
          {otherUser && (
            <View style={styles.statusContainer}>
              <Chip 
                mode="outlined" 
                compact 
                textStyle={styles.statusText}
                style={[
                  styles.statusChip,
                  onlineStatus ? styles.onlineChip : styles.offlineChip
                ]}
              >
                {onlineStatus ? 'Online' : 'Offline'}
              </Chip>
            </View>
          )}
        </View>
      </View>
    </Appbar.Header>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            inverted
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        {renderUploadProgress()}
        {renderMediaPreview()}
        
        {/* Upload Progress */}
        {renderUploadProgress()}
        
        {/* File Preview */}
        {previewFiles.length > 0 && (
          <ImagePreview
            files={previewFiles}
            onRemoveFile={removePreviewFile}
            maxWidth={200}
          />
        )}
        
        <View style={styles.inputContainer}>
          <IconButton
            icon="paperclip"
            size={20}
            onPress={() => setShowMediaPicker(true)}
            style={styles.attachButton}
            disabled={sending}
          />
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
            style={styles.textInput}
            mode="outlined"
            dense
            disabled={sending}
          />
          <IconButton
            icon="send"
            size={24}
            onPress={(selectedMedia.length > 0 || selectedWebFiles.length > 0 || previewFiles.length > 0) ? sendMessageWithMedia : sendMessage}
            disabled={(!newMessage.trim() && selectedMedia.length === 0 && selectedWebFiles.length === 0 && previewFiles.length === 0) || sending}
            style={[
              styles.sendButton,
              ((!newMessage.trim() && selectedMedia.length === 0 && selectedWebFiles.length === 0 && previewFiles.length === 0) || sending) ? styles.sendButtonDisabled : styles.sendButtonEnabled
            ]}
          />
        </View>
      </KeyboardAvoidingView>
      
      <MediaPicker
        visible={showMediaPicker}
        onDismiss={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
        allowMultiple={true}
        maxFiles={10}
      />
      
      {/* Web File Upload Component */}
      <WebFileUpload
        onFilesSelected={handleWebFilesSelected}
        selectedFiles={selectedWebFiles}
        onRemoveFile={removeWebFile}
        disabled={sending}
        maxFiles={10}
        maxFileSize={50 * 1024 * 1024} // 50MB
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  statusContainer: {
    paddingLeft: spacing.md,
  },
  statusChip: {
    height: 24,
  },
  statusText: {
    fontSize: 10,
  },
  onlineChip: {
    backgroundColor: '#e8f5e8',
    borderColor: colors.success,
  },
  offlineChip: {
    backgroundColor: '#f5f5f5',
    borderColor: colors.textSecondary,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  messagesContent: {
    paddingVertical: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    marginHorizontal: spacing.xs,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.sm,
    borderRadius: 16,
    elevation: 1,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageStatusContainer: {
    marginLeft: spacing.xs,
  },
  messageStatus: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusSending: {
    color: colors.textSecondary,
  },
  statusSent: {
    color: colors.success,
  },
  statusDelivered: {
    color: colors.success,
  },
  statusRead: {
    color: colors.primary,
  },
  statusFailed: {
    color: colors.error,
  },
  mediaPreviewContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  mediaPreviewTitle: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  mediaPreviewList: {
    paddingHorizontal: spacing.sm,
  },
  mediaPreviewItem: {
    marginRight: spacing.sm,
    position: 'relative',
  },
  mediaPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.disabled,
  },
  mediaPreviewDocument: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  mediaPreviewDocumentIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  mediaPreviewDocumentName: {
    fontSize: 8,
    textAlign: 'center',
    color: colors.text,
  },
  mediaRemoveButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaRemoveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mediaPreviewDivider: {
    marginTop: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachButton: {
    margin: 0,
    marginRight: spacing.xs,
  },
  attachmentsContainer: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  attachmentItem: {
    marginBottom: spacing.xs,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: colors.disabled,
  },
  attachmentVideo: {
    width: 200,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  attachmentVideoIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  attachmentVideoName: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    color: colors.text,
  },
  attachmentDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.disabled,
    borderRadius: 8,
    padding: spacing.sm,
    maxWidth: 200,
  },
  attachmentDocumentIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  attachmentDocumentName: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.text,
  },
  attachmentDocumentSize: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  textInput: {
    flex: 1,
    marginRight: spacing.xs,
    maxHeight: 100,
  },
  sendButton: {
    margin: 0,
  },
  sendButtonEnabled: {
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  // Upload progress styles
  uploadProgressContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    margin: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadProgressContent: {
    alignItems: 'center',
  },
  uploadProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.disabled,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  uploadProgressText: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  uploadDetailsText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
export default ChatScreen; 
