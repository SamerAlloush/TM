import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  Modal,
  Portal,
  Button,
  List,
  Divider,
  Text,
  Surface,
  ActivityIndicator,
} from 'react-native-paper';
// import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
// import DocumentPicker from 'react-native-document-picker';

// For now, using placeholders - install these packages:
// npm install react-native-image-picker react-native-document-picker
// or use expo equivalents: expo-image-picker expo-document-picker
import { colors, spacing } from '../theme/colors';

interface MediaPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onMediaSelected: (media: MediaItem[]) => void;
  allowMultiple?: boolean;
  maxFiles?: number;
}

export interface MediaItem {
  uri: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  isVideo: boolean;
  isDocument: boolean;
  thumbnail?: string;
}

const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  visible,
  onDismiss,
  onMediaSelected,
  allowMultiple = true,
  maxFiles = 10,
}) => {
  const [loading, setLoading] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    // Only request permissions on native platforms
    if (Platform.OS === 'android') {
      try {
        // Dynamically import PermissionsAndroid to avoid web bundling issues
        const { PermissionsAndroid } = require('react-native');
        
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
        
        return (
          granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission request failed:', err);
        return false;
      }
    }
    
    // For iOS and web, assume permissions are granted or handled by the system
    return true;
  };



  const openCamera = async () => {
    setLoading(true);
    
    // TODO: Install react-native-image-picker or expo-image-picker
    Alert.alert(
      'Media Picker Setup',
      'To enable camera functionality, install:\n\n• react-native-image-picker\n• expo-image-picker (for Expo)\n\nThen replace this placeholder with actual camera implementation.',
      [{ text: 'OK', onPress: () => setLoading(false) }]
    );
    
    // Example implementation structure for when packages are installed:
    /*
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission needed');
      setLoading(false);
      return;
    }

    // Using react-native-image-picker:
    import { launchCamera } from 'react-native-image-picker';
    
    launchCamera({
      mediaType: 'mixed',
      quality: 0.8,
    }, (response) => {
      setLoading(false);
      if (response.assets && response.assets.length > 0) {
        const mediaItems = response.assets.map(asset => ({
          uri: asset.uri!,
          name: asset.fileName!,
          type: asset.type!,
          size: asset.fileSize!,
          mimeType: asset.type!,
          isImage: asset.type!.startsWith('image/'),
          isVideo: asset.type!.startsWith('video/'),
          isDocument: false,
        }));
        onMediaSelected(mediaItems);
        onDismiss();
      }
    });
    */
  };

  const openGallery = async () => {
    setLoading(true);

    Alert.alert(
      'Media Picker Setup',
      'To enable gallery functionality, install:\n\n• react-native-image-picker\n• expo-image-picker (for Expo)\n\nThen replace this placeholder with actual gallery implementation.',
      [{ text: 'OK', onPress: () => setLoading(false) }]
    );
    
    // Example implementation structure for when packages are installed:
    /*
    import { launchImageLibrary } from 'react-native-image-picker';
    
    launchImageLibrary({
      mediaType: 'mixed',
      quality: 0.8,
      selectionLimit: allowMultiple ? maxFiles : 1,
    }, (response) => {
      setLoading(false);
      if (response.assets && response.assets.length > 0) {
        const mediaItems = response.assets.map(asset => ({
          uri: asset.uri!,
          name: asset.fileName!,
          type: asset.type!,
          size: asset.fileSize!,
          mimeType: asset.type!,
          isImage: asset.type!.startsWith('image/'),
          isVideo: asset.type!.startsWith('video/'),
          isDocument: false,
        }));
        onMediaSelected(mediaItems);
        onDismiss();
      }
    });
    */
  };

  const openDocumentPicker = async () => {
    setLoading(true);
    
    Alert.alert(
      'Document Picker Setup',
      'To enable document selection, install:\n\n• react-native-document-picker\n• expo-document-picker (for Expo)\n\nThen replace this placeholder with actual document picker implementation.',
      [{ text: 'OK', onPress: () => setLoading(false) }]
    );
    
    // Example implementation structure for when packages are installed:
    /*
    import DocumentPicker from 'react-native-document-picker';
    
    try {
      const results = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: allowMultiple,
      });

      const mediaItems = results.map(result => ({
        uri: result.uri,
        name: result.name || 'document',
        type: result.type || 'application/octet-stream',
        size: result.size || 0,
        mimeType: result.type || 'application/octet-stream',
        isImage: false,
        isVideo: false,
        isDocument: true,
      }));

      onMediaSelected(mediaItems);
      onDismiss();
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick document');
      }
    } finally {
      setLoading(false);
    }
    */
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Media</Text>
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Setting up...</Text>
            </View>
          )}

          {!loading && (
            <>
              <List.Item
                title="Camera"
                description="Take a photo or video"
                left={props => <List.Icon {...props} icon="camera" />}
                onPress={openCamera}
                style={styles.listItem}
              />
              
              <Divider />
              
              <List.Item
                title="Gallery"
                description="Choose from photos and videos"
                left={props => <List.Icon {...props} icon="image-multiple" />}
                onPress={openGallery}
                style={styles.listItem}
              />
              
              <Divider />
              
              <List.Item
                title="Documents"
                description="Select files and documents"
                left={props => <List.Icon {...props} icon="file-document" />}
                onPress={openDocumentPicker}
                style={styles.listItem}
              />
              
              <View style={styles.buttonContainer}>
                <Button 
                  mode="outlined" 
                  onPress={onDismiss}
                  style={styles.cancelButton}
                >
                  Cancel
                </Button>
              </View>
            </>
          )}
        </Surface>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    padding: spacing.lg,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary,
    color: 'white',
  },
  listItem: {
    paddingVertical: spacing.sm,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  buttonContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButton: {
    minWidth: 120,
  },
});

export default MediaPickerModal; 