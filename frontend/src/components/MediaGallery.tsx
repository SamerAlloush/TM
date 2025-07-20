import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView
} from 'react-native';
import { Modal, Portal, IconButton, Button } from 'react-native-paper';
import { Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { platformMediaUploadService } from '../services/PlatformMediaUploadService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MediaGalleryProps {
  visible: boolean;
  onDismiss: () => void;
  attachments: any[];
  initialIndex?: number;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  visible,
  onDismiss,
  attachments,
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const videoRef = useRef<Video>(null);

  const currentAttachment = attachments[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < attachments.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDownload = async () => {
    try {
      const url = currentAttachment.url.startsWith('http') 
        ? currentAttachment.url 
        : `http://localhost:5000${currentAttachment.url}`;
      
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

  const renderMedia = () => {
    if (!currentAttachment) return null;

    const isImage = platformMediaUploadService.isImage(currentAttachment.mimeType);
    const isVideo = platformMediaUploadService.isVideo(currentAttachment.mimeType);
    const url = currentAttachment.url.startsWith('http') 
      ? currentAttachment.url 
      : `http://localhost:5000${currentAttachment.url}`;

    if (isImage) {
      return (
        <Image
          source={{ uri: url }}
          style={styles.mediaContent}
          resizeMode="contain"
        />
      );
    }

    if (isVideo) {
      return (
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.mediaContent}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={true}
        />
      );
    }

    // For other file types, show file info
    return (
      <View style={styles.fileInfoContainer}>
        <Text style={styles.fileIcon}>
          {platformMediaUploadService.getFileTypeIcon(currentAttachment.mimeType)}
        </Text>
        <Text style={styles.fileName}>{currentAttachment.originalName}</Text>
        <Text style={styles.fileSize}>
          {platformMediaUploadService.formatFileSize(currentAttachment.size)}
        </Text>
        <Button
          mode="contained"
          onPress={handleDownload}
          style={styles.downloadButton}
        >
          Download File
        </Button>
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <StatusBar hidden />
        
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            size={24}
            iconColor="white"
            onPress={onDismiss}
          />
          <Text style={styles.counter}>
            {currentIndex + 1} / {attachments.length}
          </Text>
          <IconButton
            icon="download"
            size={24}
            iconColor="white"
            onPress={handleDownload}
          />
        </View>

        {/* Media Content */}
        <View style={styles.content}>
          {renderMedia()}
        </View>

        {/* Navigation */}
        {attachments.length > 1 && (
          <View style={styles.navigation}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, currentIndex === attachments.length - 1 && styles.navButtonDisabled]}
              onPress={handleNext}
              disabled={currentIndex === attachments.length - 1}
            >
              <Ionicons name="chevron-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Thumbnail Strip */}
        {attachments.length > 1 && (
          <View style={styles.thumbnailStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {attachments.map((attachment, index) => {
                const isImage = platformMediaUploadService.isImage(attachment.mimeType);
                const url = attachment.url.startsWith('http') 
                  ? attachment.url 
                  : `http://localhost:5000${attachment.url}`;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.thumbnail,
                      index === currentIndex && styles.activeThumbnail
                    ]}
                    onPress={() => setCurrentIndex(index)}
                  >
                    {isImage ? (
                      <Image
                        source={{ uri: url }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.thumbnailIcon}>
                        <Text style={styles.thumbnailIconText}>
                          {platformMediaUploadService.getFileTypeIcon(attachment.mimeType)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  counter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContent: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  fileInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fileIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  fileName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  fileSize: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 24,
  },
  downloadButton: {
    marginTop: 16,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  thumbnailStrip: {
    height: 80,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: '#007AFF',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIconText: {
    fontSize: 20,
  },
});

export default MediaGallery; 