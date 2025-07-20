import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { IconButton, Surface, Chip } from 'react-native-paper';
import { colors, spacing, fontSize } from '../theme/colors';

export interface WebFile {
  file: File;
  preview?: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  isDocument: boolean;
}

interface WebFileUploadProps {
  onFilesSelected: (files: WebFile[]) => void;
  selectedFiles: WebFile[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
}

const WebFileUpload: React.FC<WebFileUploadProps> = ({
  onFilesSelected,
  selectedFiles,
  onRemoveFile,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024 // 50MB default
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File ${file.name} is too large. Maximum size is ${Math.round(maxFileSize / (1024 * 1024))}MB`;
    }

    // Check file count
    if (selectedFiles.length >= maxFiles) {
      return `Maximum ${maxFiles} files allowed`;
    }

    return null;
  };

  const createFilePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    console.log('📎 Files selected from web input:', files.length);

    const validFiles: WebFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        continue;
      }

      const preview = await createFilePreview(file);
      
      const webFile: WebFile = {
        file,
        preview,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage: file.type.startsWith('image/'),
        isVideo: file.type.startsWith('video/'),
        isAudio: file.type.startsWith('audio/'),
        isDocument: !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')
      };

      validFiles.push(webFile);
    }

    if (errors.length > 0) {
      Alert.alert('File Upload Error', errors.join('\n'));
    }

    if (validFiles.length > 0) {
      console.log('✅ Valid files ready for upload:', validFiles.length);
      onFilesSelected(validFiles);
    }

    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: WebFile): string => {
    if (file.isImage) return '🖼️';
    if (file.isVideo) return '🎥';
    if (file.isAudio) return '🎵';
    if (file.type.includes('pdf')) return '📄';
    if (file.type.includes('word') || file.type.includes('document')) return '📝';
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return '📊';
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) return '📽️';
    if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('archive')) return '📦';
    return '📄';
  };

  return (
    <View style={styles.container}>
      {/* Hidden file input for web */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* File selection button */}
      <TouchableOpacity
        style={[styles.uploadButton, disabled && styles.uploadButtonDisabled]}
        onPress={() => fileInputRef.current?.click()}
        disabled={disabled}
      >
        <IconButton
          icon="paperclip"
          size={20}
          iconColor={disabled ? colors.textSecondary : colors.primary}
        />
        <Text style={[styles.uploadButtonText, disabled && styles.uploadButtonTextDisabled]}>
          Attach Files
        </Text>
      </TouchableOpacity>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <View style={styles.filesContainer}>
          <Text style={styles.filesTitle}>
            Selected Files ({selectedFiles.length}/{maxFiles})
          </Text>
          
          {selectedFiles.map((file, index) => (
            <Surface key={index} style={styles.fileItem}>
              <View style={styles.fileInfo}>
                {file.isImage && file.preview ? (
                  <Image source={{ uri: file.preview }} style={styles.filePreview} />
                ) : (
                  <View style={styles.fileIconContainer}>
                    <Text style={styles.fileIcon}>{getFileIcon(file)}</Text>
                  </View>
                )}
                
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(file.size)}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemoveFile(index)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </Surface>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  uploadButtonTextDisabled: {
    color: colors.textSecondary,
  },
  filesContainer: {
    marginTop: spacing.sm,
  },
  filesTitle: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: 8,
    elevation: 1,
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filePreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  removeButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WebFileUpload; 