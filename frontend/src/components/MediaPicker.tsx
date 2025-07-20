import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  Platform
} from 'react-native';
import { Modal, Portal, Button, IconButton, ProgressBar } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { platformMediaUploadService, MediaFile } from '../services/PlatformMediaUploadService';

const { width: screenWidth } = Dimensions.get('window');

interface MediaPickerProps {
  visible: boolean;
  onDismiss: () => void;
  onMediaSelected: (files: MediaFile[]) => void;
  allowMultiple?: boolean;
  maxFiles?: number;
}

interface MediaItem {
  uri: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  isVideo: boolean;
  isDocument: boolean;
}

const MediaPicker: React.FC<MediaPickerProps> = ({
  visible,
  onDismiss,
  onMediaSelected,
  allowMultiple = true,
  maxFiles = 10
}) => {
  const [selectedFiles, setSelectedFiles] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera and media library permissions are required to select media files.'
        );
        return false;
      }
    }
    return true;
  };

  const openCamera = async () => {
    setLoading(true);
    
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `camera_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          size: asset.fileSize || 0,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          isImage: asset.type === 'image',
          isVideo: asset.type === 'video',
          isDocument: false,
        }));

        addFiles(newFiles);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to capture media');
    } finally {
      setLoading(false);
    }
  };

  const openGallery = async () => {
    setLoading(true);
    
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: allowMultiple,
        quality: 0.8,
        selectionLimit: allowMultiple ? maxFiles : 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `gallery_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          size: asset.fileSize || 0,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          isImage: asset.type === 'image',
          isVideo: asset.type === 'video',
          isDocument: false,
        }));

        addFiles(newFiles);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to select media');
    } finally {
      setLoading(false);
    }
  };

  const openDocumentPicker = async () => {
    setLoading(true);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: allowMultiple,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
          isImage: asset.mimeType?.startsWith('image/') || false,
          isVideo: asset.mimeType?.startsWith('video/') || false,
          isDocument: !asset.mimeType?.startsWith('image/') && !asset.mimeType?.startsWith('video/'),
        }));

        addFiles(newFiles);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to select documents');
    } finally {
      setLoading(false);
    }
  };

  const addFiles = (newFiles: MediaItem[]) => {
    const totalFiles = selectedFiles.length + newFiles.length;
    
    if (totalFiles > maxFiles) {
      Alert.alert('Too Many Files', `Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes
    for (const file of newFiles) {
      if (file.size > 100 * 1024 * 1024) { // 100MB
        Alert.alert('File Too Large', `${file.name} exceeds 100MB limit`);
        return;
      }
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      Alert.alert('No Files Selected', 'Please select at least one file');
      return;
    }

    onMediaSelected(selectedFiles);
    setSelectedFiles([]);
    onDismiss();
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    onDismiss();
  };

  const renderFilePreview = (file: MediaItem, index: number) => {
    const icon = platformMediaUploadService.getFileTypeIcon(file.mimeType);
    const size = platformMediaUploadService.formatFileSize(file.size);

    return (
      <View key={index} style={styles.filePreview}>
        <View style={styles.fileInfo}>
          <Text style={styles.fileIcon}>{icon}</Text>
          <View style={styles.fileDetails}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.fileSize}>{size}</Text>
          </View>
          <IconButton
            icon="close"
            size={20}
            onPress={() => removeFile(index)}
            style={styles.removeButton}
          />
        </View>
        
        {file.isImage && (
          <Image source={{ uri: file.uri }} style={styles.mediaPreview} />
        )}
        
        {file.isVideo && (
          <Video
            source={{ uri: file.uri }}
            style={styles.mediaPreview}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
          />
        )}
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleCancel}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select Media</Text>
          <IconButton icon="close" size={24} onPress={handleCancel} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.options}>
            <TouchableOpacity
              style={styles.option}
              onPress={openCamera}
              disabled={loading}
            >
              <Ionicons name="camera" size={32} color="#007AFF" />
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={openGallery}
              disabled={loading}
            >
              <Ionicons name="images" size={32} color="#007AFF" />
              <Text style={styles.optionText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={openDocumentPicker}
              disabled={loading}
            >
              <Ionicons name="document" size={32} color="#007AFF" />
              <Text style={styles.optionText}>Documents</Text>
            </TouchableOpacity>
          </View>

          {selectedFiles.length > 0 && (
            <View style={styles.selectedFiles}>
              <Text style={styles.sectionTitle}>
                Selected Files ({selectedFiles.length}/{maxFiles})
              </Text>
              {selectedFiles.map(renderFilePreview)}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            style={styles.footerButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleConfirm}
            disabled={selectedFiles.length === 0 || loading}
            style={styles.footerButton}
          >
            Confirm ({selectedFiles.length})
          </Button>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ProgressBar indeterminate color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  option: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    minWidth: 80,
  },
  optionText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  selectedFiles: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filePreview: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    margin: 0,
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 14,
  },
});

export default MediaPicker; 