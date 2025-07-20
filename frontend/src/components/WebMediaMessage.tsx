import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import { Surface, Chip } from 'react-native-paper';
import { colors, spacing, fontSize } from '../theme/colors';
import { Message } from '../services/api';
import { getFileTypeInfo, formatFileSize } from '../config/webConfig';

interface WebMediaMessageProps {
  message: Message;
  isOwnMessage: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

const WebMediaMessage: React.FC<WebMediaMessageProps> = ({
  message,
  isOwnMessage,
  onPress,
  onLongPress
}) => {
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;

  const renderAttachment = (attachment: any, index: number) => {
    const fileTypeInfo = getFileTypeInfo(attachment.mimeType);
    const isImage = attachment.mimeType.startsWith('image/');
    const isVideo = attachment.mimeType.startsWith('video/');
    const isAudio = attachment.mimeType.startsWith('audio/');

    return (
      <Surface key={index} style={styles.attachmentContainer}>
        {isImage ? (
          // Image attachment
          <TouchableOpacity onPress={onPress} style={styles.imageContainer}>
            <Image
              source={{ uri: attachment.url }}
              style={styles.attachmentImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.imageName} numberOfLines={1}>
                {attachment.originalName || attachment.fileName}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          // Document/Video/Audio attachment
          <TouchableOpacity 
            onPress={() => handleDownload(attachment)}
            style={styles.documentContainer}
          >
            <View style={styles.documentIcon}>
              <Text style={styles.documentIconText}>
                {fileTypeInfo.icon}
              </Text>
            </View>
            <View style={styles.documentInfo}>
              <Text style={styles.documentName} numberOfLines={2}>
                {attachment.originalName || attachment.fileName}
              </Text>
              <Text style={styles.documentSize}>
                {formatFileSize(attachment.size)}
              </Text>
              <Text style={styles.documentType}>
                {fileTypeInfo.label}
              </Text>
            </View>
            <View style={styles.downloadIcon}>
              <Text style={styles.downloadIconText}>⬇️</Text>
            </View>
          </TouchableOpacity>
        )}
      </Surface>
    );
  };

  const handleDownload = (attachment: any) => {
    if (attachment.url) {
      // For web, try to open in new tab or download
      if (typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = attachment.url;
        link.download = attachment.originalName || attachment.fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const getMessageTypeLabel = () => {
    if (message.type === 'image') return '🖼️ Image';
    if (message.type === 'video') return '🎥 Video';
    if (message.type === 'audio') return '🎵 Audio';
    if (message.type === 'document') return '📄 Document';
    if (hasAttachments) return '📎 Media';
    return '💬 Message';
  };

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {/* Message bubble */}
      <Surface style={[
        styles.messageBubble,
        isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
      ]}>
        {/* Message type indicator */}
        {hasAttachments && (
          <View style={styles.messageTypeContainer}>
            <Chip 
              mode="outlined" 
              compact 
              textStyle={styles.messageTypeText}
              style={styles.messageTypeChip}
            >
              {getMessageTypeLabel()}
            </Chip>
          </View>
        )}

        {/* Message content */}
        {hasContent && (
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
        )}

        {/* Attachments */}
        {hasAttachments && (
          <View style={styles.attachmentsContainer}>
            {message.attachments.map((attachment, index) => 
              renderAttachment(attachment, index)
            )}
          </View>
        )}

        {/* Message footer */}
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {new Date(message.createdAt).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          
          {/* Message status for own messages */}
          {isOwnMessage && message.status && (
            <View style={styles.statusContainer}>
              <Text style={[
                styles.statusText,
                message.status === 'sending' && styles.statusSending,
                message.status === 'sent' && styles.statusSent,
                message.status === 'delivered' && styles.statusDelivered,
                message.status === 'read' && styles.statusRead,
                message.status === 'failed' && styles.statusFailed,
              ].filter(Boolean)}
              >
                {message.status === 'sending' && '⏳'}
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
                {message.status === 'failed' && '❌'}
              </Text>
            </View>
          )}
        </View>
      </Surface>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
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
  messageTypeContainer: {
    marginBottom: spacing.xs,
  },
  messageTypeChip: {
    height: 20,
    alignSelf: 'flex-start',
  },
  messageTypeText: {
    fontSize: 10,
  },
  messageText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: colors.text,
  },
  attachmentsContainer: {
    gap: spacing.xs,
  },
  attachmentContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.xs,
  },
  imageName: {
    color: 'white',
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.disabled,
    borderRadius: 8,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  documentIconText: {
    fontSize: 20,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  documentSize: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  documentType: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  downloadIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIconText: {
    fontSize: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: 10,
    opacity: 0.7,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: colors.textSecondary,
  },
  statusContainer: {
    marginLeft: spacing.xs,
  },
  statusText: {
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
});

export default WebMediaMessage; 