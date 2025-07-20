// Platform-aware media upload service
import { Platform } from 'react-native';

// Import MediaFile type
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

export type UploadProgressCallback = (progress: number) => void;

class PlatformMediaUploadService {
  private nativeService: any = null;
  private webService: any = null;

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    if (Platform.OS === 'web') {
      try {
        const { default: webService } = await import('../services/WebMediaUploadService');
        this.webService = webService;
      } catch (error) {
        console.warn('WebMediaUploadService not available:', error);
      }
    } else {
      try {
        const { mediaUploadService } = await import('../services/MediaUploadService');
        this.nativeService = mediaUploadService;
      } catch (error) {
        console.warn('MediaUploadService not available:', error);
      }
    }
  }

  public async uploadFiles(
    files: MediaFile[],
    conversationId: string,
    content: string = '',
    onProgress?: UploadProgressCallback
  ): Promise<any> {
    if (Platform.OS === 'web') {
      if (!this.webService) {
        await this.initializeServices();
      }
      return this.webService?.uploadFiles(files, conversationId, content, onProgress);
    } else {
      if (!this.nativeService) {
        await this.initializeServices();
      }
      return this.nativeService?.uploadFiles(files, conversationId, content, onProgress);
    }
  }

  public async validateFiles(files: MediaFile[]): Promise<void> {
    if (Platform.OS === 'web') {
      if (!this.webService) {
        await this.initializeServices();
      }
      return this.webService?.validateFiles(files);
    } else {
      if (!this.nativeService) {
        await this.initializeServices();
      }
      return this.nativeService?.validateFiles(files);
    }
  }

  public cancelUpload(conversationId: string): void {
    if (Platform.OS === 'web') {
      this.webService?.cancelUpload(conversationId);
    } else {
      this.nativeService?.cancelUpload(conversationId);
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

export const platformMediaUploadService = new PlatformMediaUploadService();
export default platformMediaUploadService;
