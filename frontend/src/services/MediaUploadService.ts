import axios, { AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

// Conditional import for expo-file-system (not available on web)
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try {
    FileSystem = require('expo-file-system');
  } catch (error) {
    console.warn('expo-file-system not available:', error);
  }
}

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

export interface MediaFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  mimeType?: string;
  isImage?: boolean;
  isVideo?: boolean;
  isDocument?: boolean;
}

export interface UploadProgress {
  fileId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

export type UploadProgressCallback = (progress: number) => void;

class MediaUploadService {
  private abortControllers: Map<string, AbortController> = new Map();

  public async validateFiles(files: MediaFile[]): Promise<void> {
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    const maxFiles = 10;

    if (files.length > maxFiles) {
      throw new Error(`Maximum ${maxFiles} files allowed`);
    }

    for (const file of files) {
      if (file.size > maxFileSize) {
        throw new Error(`File ${file.name} exceeds maximum size of 100MB`);
      }
    }
  }

  public async uploadFiles(
    files: MediaFile[],
    conversationId: string,
    content: string = '',
    onProgress?: UploadProgressCallback
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('content', content);

      // Add each file to FormData
      for (const file of files) {
        if (Platform.OS === 'web') {
          // For web platform, use the file directly
          formData.append('files', file as any);
        } else {
          // For native platforms, use expo-file-system
          if (!FileSystem) {
            throw new Error('FileSystem not available on this platform');
          }
          
          const fileUri = Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);

          if (!fileInfo.exists) {
            throw new Error(`File not found: ${file.name}`);
          }

          formData.append('files', {
            uri: fileUri,
            type: file.type,
            name: file.name,
          } as any);
        }
      }

      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);

      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      };

      const response = await axios.post(
        `${API_BASE_URL}/conversations/${conversationId}/upload`,
        formData,
        config
      );

      this.abortControllers.delete(conversationId);
      return response.data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }
      throw error;
    }
  }

  public cancelUpload(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }

  public getFileTypeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('text/') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml')) return '💻';
    return '📎';
  }

  public formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  public isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  public isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  public isAudio(mimeType: string): boolean {
    return mimeType.startsWith('audio/');
  }

  public isDocument(mimeType: string): boolean {
    return mimeType.includes('document') || 
           mimeType === 'application/pdf' || 
           mimeType.startsWith('text/');
  }

  public isArchive(mimeType: string): boolean {
    return mimeType.includes('zip') || 
           mimeType.includes('rar') || 
           mimeType.includes('7z') || 
           mimeType.includes('tar');
  }

  public isCode(mimeType: string): boolean {
    return mimeType.includes('javascript') || 
           mimeType.includes('json') || 
           mimeType.includes('xml') || 
           mimeType.includes('html') || 
           mimeType.includes('css') || 
           mimeType.includes('python') || 
           mimeType.includes('java') || 
           mimeType.includes('c++') || 
           mimeType.includes('c#') || 
           mimeType.includes('php') || 
           mimeType.includes('ruby') || 
           mimeType.includes('go') || 
           mimeType.includes('rust') || 
           mimeType.includes('swift') || 
           mimeType.includes('kotlin');
  }
}

export const mediaUploadService = new MediaUploadService(); 