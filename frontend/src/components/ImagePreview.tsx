import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { platformMediaUploadService } from '../services/PlatformMediaUploadService';

export interface PreviewFile {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUri?: string;
  file?: File | any;
}

interface ImagePreviewProps {
  files: PreviewFile[];
  onRemoveFile: (fileId: string) => void;
  maxWidth?: number;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  files,
  onRemoveFile,
  maxWidth = 300,
}) => {
  if (files.length === 0) {
    return null;
  }

  console.log('📎 Validation terminée, fichiers prêts à être envoyés:', files);

  const handleRemoveFile = (fileId: string) => {
    Alert.alert(
      'Supprimer le fichier',
      'Êtes-vous sûr de vouloir supprimer ce fichier?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onRemoveFile(fileId),
        },
      ]
    );
  };

  const renderFilePreview = (file: PreviewFile) => {
    const isImage = platformMediaUploadService.isImage(file.type);
    const isVideo = platformMediaUploadService.isVideo(file.type);
    const isAudio = platformMediaUploadService.isAudio(file.type);
    const isDocument = platformMediaUploadService.isDocument(file.type);
    
    const fileIcon = platformMediaUploadService.getFileTypeIcon(file.type);
    const fileSize = platformMediaUploadService.formatFileSize(file.size);

    return (
      <View key={file.id} style={styles.filePreviewContainer}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFile(file.id)}
        >
          <Ionicons name="close-circle" size={24} color="#ff4444" />
        </TouchableOpacity>

        {isImage && file.previewUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: file.previewUri }}
              style={[styles.imagePreview, { maxWidth }]}
              resizeMode="cover"
            />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{fileSize}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.fileContainer, { maxWidth }]}>
            <View style={styles.fileIconContainer}>
              <Text style={styles.fileIcon}>{fileIcon}</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{fileSize}</Text>
              <View style={styles.fileTypeContainer}>
                {isVideo && <Text style={styles.fileType}>Vidéo</Text>}
                {isAudio && <Text style={styles.fileType}>Audio</Text>}
                {isDocument && <Text style={styles.fileType}>Document</Text>}
                {!isVideo && !isAudio && !isDocument && (
                  <Text style={styles.fileType}>Fichier</Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {files.map(renderFilePreview)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  filePreviewContainer: {
    marginRight: 12,
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    width: 200,
  },
  fileIconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    paddingTop: 8,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  fileTypeContainer: {
    alignSelf: 'flex-start',
  },
  fileType: {
    fontSize: 9,
    color: '#888',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default ImagePreview;
