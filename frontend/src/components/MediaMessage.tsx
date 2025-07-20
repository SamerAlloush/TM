import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking
} from 'react-native';
import { Surface, IconButton, Chip } from 'react-native-paper';
import { Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { platformMediaUploadService } from '../services/PlatformMediaUploadService';
import { Message } from '../services/api';

const { width: screenWidth } = Dimensions.get('window');

interface MediaMessageProps {
  message: Message;
  isOwnMessage: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

const MediaMessage: React.FC<MediaMessageProps> = ({
  message,
  isOwnMessage,
  onPress,
  onLongPress
}) => {
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});
  const [videoError, setVideoError] = useState<{ [key: string]: boolean }>({});

  const handleImageError = (attachmentId: string) => {
    setImageError(prev => ({ ...prev, [attachmentId]: true }));
  };

  const handleVideoError = (attachmentId: string) => {
    setVideoError(prev => ({ ...prev, [attachmentId]: true }));
  };

  const handleDownload = async (attachment: any) => {
    try {
      // For now, we'll just open the URL in the browser
      // In a real app, you'd implement proper file downloading
      const url = attachment.url.startsWith('http') 
        ? attachment.url 
        : `http://localhost:5000${attachment.url}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const renderAttachment = (attachment: any, index: number) => {
    const icon = platformMediaUploadService.getFileTypeIcon(attachment.mimeType);
    const size = platformMediaUploadService.formatFileSize(attachment.size);
    const isImage = platformMediaUploadService.isImage(attachment.mimeType);
    const isVideo = platformMediaUploadService.isVideo(attachment.mimeType);
    const isAudio = platformMediaUploadService.isAudio(attachment.mimeType);
    const isDocument = platformMediaUploadService.isDocument(attachment.mimeType);
    const isArchive = platformMediaUploadService.isArchive(attachment.mimeType);
    const isCode = platformMediaUploadService.isCode(attachment.mimeType);

    // Ensure proper URL format
    const baseUrl = 'http://localhost:5000';
    const fileUrl = attachment.url.startsWith('http') ? attachment.url : `${baseUrl}${attachment.url}`;

    return (
      <Surface key={index} style={styles.attachmentContainer}>
        {/* Image Preview */}
        {isImage && !imageError[attachment.fileName] && (
          <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
            <Image
              source={{ uri: fileUrl }}
              style={styles.imagePreview}
              onError={() => handleImageError(attachment.fileName)}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Video Preview */}
        {isVideo && !videoError[attachment.fileName] && (
          <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
            <Video
              source={{ uri: fileUrl }}
              style={styles.videoPreview}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              onError={() => handleVideoError(attachment.fileName)}
            />
          </TouchableOpacity>
        )}

        {/* File Info */}
        <View style={styles.fileInfo}>
          <View style={styles.fileHeader}>
            <Text style={styles.fileIcon}>{icon}</Text>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={2}>
                {attachment.originalName}
              </Text>
              <Text style={styles.fileSize}>{size}</Text>
            </View>
            <IconButton
              icon="download"
              size={20}
              onPress={() => handleDownload(attachment)}
              style={styles.downloadButton}
            />
          </View>

          {/* File Type Badge */}
          <View style={styles.fileTypeContainer}>
            {isImage && <Chip icon="image" mode="outlined" style={styles.fileTypeChip}>Image</Chip>}
            {isVideo && <Chip icon="video" mode="outlined" style={styles.fileTypeChip}>Video</Chip>}
            {isAudio && <Chip icon="music" mode="outlined" style={styles.fileTypeChip}>Audio</Chip>}
            {isDocument && <Chip icon="file-document" mode="outlined" style={styles.fileTypeChip}>Document</Chip>}
            {isArchive && <Chip icon="package-variant" mode="outlined" style={styles.fileTypeChip}>Archive</Chip>}
            {isCode && <Chip icon="code-tags" mode="outlined" style={styles.fileTypeChip}>Code</Chip>}
          </View>
        </View>
      </Surface>
    );
  };

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {/* Debug information (remove in production) */}
      {__DEV__ && (
        <Text style={styles.debugText}>
          Content: "{message.content}", Attachments: {message.attachments?.length || 0}
        </Text>
      )}

      {/* Message Content - Show text if it exists and is not just [Media] */}
      {message.content && message.content.trim() !== '' && message.content !== '[Media]' && (
        <Text style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          {message.content}
        </Text>
      )}

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          {message.attachments.map(renderAttachment)}
        </View>
      )}

      {/* Show fallback only if truly empty */}
      {(!message.content || message.content.trim() === '' || message.content === '[Media]') && 
       (!message.attachments || message.attachments.length === 0) && (
        <Text style={[
          styles.messageText,
          styles.fallbackText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText
        ]}>
          Message sans contenu
        </Text>
      )}

      {/* Message Status */}
      <View style={styles.messageStatus}>
        <Text style={styles.timestamp}>
          {new Date(message.createdAt).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
        {isOwnMessage && (
          <View style={styles.statusContainer}>
            {message.status === 'sending' && (
              <Ionicons name="time-outline" size={12} color="#666" />
            )}
            {message.status === 'sent' && (
              <Ionicons name="checkmark" size={12} color="#666" />
            )}
            {message.status === 'delivered' && (
              <Ionicons name="checkmark-done" size={12} color="#666" />
            )}
            {message.status === 'read' && (
              <Ionicons name="checkmark-done" size={12} color="#007AFF" />
            )}
            {message.status === 'failed' && (
              <Ionicons name="close-circle" size={12} color="#FF3B30" />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  fallbackText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  attachmentsContainer: {
    marginTop: 4,
  },
  attachmentContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#000000',
  },
  fileInfo: {
    padding: 12,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  downloadButton: {
    margin: 0,
  },
  fileTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  fileTypeChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginRight: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default MediaMessage; 