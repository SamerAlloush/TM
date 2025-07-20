import { messagingAPI } from './api';
import { WebFile } from '../components/WebFileUpload';

export interface WebUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface WebUploadResult {
  success: boolean;
  data?: any;
  error?: string;
}

class WebMediaUploadService {
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly maxFiles = 10;

  /**
   * Validate files before upload
   */
  validateFiles(files: WebFile[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (files.length === 0) {
      errors.push('No files selected');
      return { valid: false, errors };
    }

    if (files.length > this.maxFiles) {
      errors.push(`Maximum ${this.maxFiles} files allowed`);
    }

    for (const file of files) {
      if (file.size > this.maxFileSize) {
        errors.push(`File ${file.name} is too large. Maximum size is ${Math.round(this.maxFileSize / (1024 * 1024))}MB`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload files to conversation
   */
  async uploadFiles(
    conversationId: string,
    content: string,
    files: WebFile[],
    onProgress?: (progress: WebUploadProgress) => void
  ): Promise<WebUploadResult> {
    try {
      console.log('📎 Starting web file upload:', {
        conversationId,
        contentLength: content.length,
        filesCount: files.length,
        files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });

      // Validate files
      const validation = this.validateFiles(files);
      if (!validation.valid) {
        console.log('❌ File validation failed:', validation.errors);
        return {
          success: false,
          error: validation.errors.join('\n')
        };
      }

      console.log('📎 Validation terminée, fichiers prêts à être envoyés:', files);

      // Create FormData
      const formData = new FormData();
      
      // Add content - use '[Media]' if empty
      const messageContent = content.trim() || '[Media]';
      formData.append('content', messageContent);
      
      // Add files with proper validation
      files.forEach((webFile, index) => {
        console.log(`📎 Adding file ${index + 1}:`, {
          name: webFile.name,
          size: webFile.size,
          type: webFile.type
        });
        
        // Ensure we're appending a proper File object
        if (webFile.file instanceof File) {
          formData.append('files', webFile.file, webFile.name);
        } else {
          // Convert to blob if needed
          const blob = new Blob([webFile.file], { type: webFile.type });
          formData.append('files', blob, webFile.name);
        }
      });

      console.log('✅ FormData created successfully');
      console.log('📦 FormData contents:', {
        content: messageContent,
        filesCount: files.length,
        files: files.map(f => f.name)
      });
      console.log('📦 Sending to endpoint:', `/api/conversations/${conversationId}/upload`);

      // Upload with progress tracking
      const response = await this.uploadWithProgress(
        `/api/conversations/${conversationId}/upload`,
        formData,
        onProgress
      );

      if (response.success) {
        console.log('✅ Web file upload successful');
        return {
          success: true,
          data: response.data
        };
      } else {
        console.log('❌ Web file upload failed:', response.error);
        return {
          success: false,
          error: response.error || 'Upload failed'
        };
      }
    } catch (error: any) {
      console.error('❌ Web file upload error:', error);
      return {
        success: false,
        error: error.message || 'Upload failed'
      };
    }
  }

  /**
   * Upload with progress tracking
   */
  private async uploadWithProgress(
    url: string,
    formData: FormData,
    onProgress?: (progress: WebUploadProgress) => void
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress: WebUploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          };
          onProgress(progress);
        }
      });

      // Response handling
      xhr.addEventListener('load', () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Check content type
            const contentType = xhr.getResponseHeader('Content-Type');
            console.log('📋 Response Content-Type:', contentType);
            
            if (!contentType || !contentType.includes('application/json')) {
              console.error('❌ Invalid JSON response - Content-Type:', contentType);
              console.error('❌ Response text:', xhr.responseText);
              resolve({
                success: false,
                error: 'Invalid JSON response from server'
              });
              return;
            }
            
            let response;
            try {
              response = JSON.parse(xhr.responseText);
            } catch (jsonError) {
              console.error('🚨 JSON parse error:', jsonError);
              console.error('🚨 Response text:', xhr.responseText);
              resolve({
                success: false,
                error: 'Invalid JSON response from server'
              });
              return;
            }
            
            console.log('📡 Upload response:', response);
            resolve({
              success: true,
              data: response.message || response.data || response
            });
          } else {
            console.log('❌ Upload failed with status:', xhr.status);
            let errorMessage = 'Upload failed';
            
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              errorMessage = errorResponse.message || errorResponse.error || errorMessage;
            } catch (e) {
              // Fallback to text response if JSON parse fails
              const text = xhr.responseText;
              console.error('🚨 Erreur serveur :', text);
              errorMessage = text || `HTTP Error ${xhr.status}`;
            }
            
            resolve({
              success: false,
              error: errorMessage
            });
          }
        } catch (error) {
          console.error('❌ Error parsing upload response:', error);
          resolve({
            success: false,
            error: 'Invalid server response'
          });
        }
      });

      // Error handling
      xhr.addEventListener('error', () => {
        console.log('❌ Upload network error');
        resolve({
          success: false,
          error: 'Network error'
        });
      });

      xhr.addEventListener('timeout', () => {
        console.log('❌ Upload timeout');
        resolve({
          success: false,
          error: 'Upload timeout'
        });
      });

      // Configure and send request
      xhr.open('POST', url);
      
      // Add authorization header
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Set timeout
      xhr.timeout = 30000; // 30 seconds

      console.log('🚀 Sending upload request to:', url);
      xhr.send(formData);
    });
  }

  /**
   * Send message with files
   */
  async sendMessageWithFiles(
    conversationId: string,
    content: string,
    files: WebFile[]
  ): Promise<WebUploadResult> {
    return this.uploadFiles(conversationId, content, files);
  }

  /**
   * Get file type information
   */
  getFileTypeInfo(file: WebFile): {
    type: string;
    icon: string;
    color: string;
  } {
    if (file.isImage) {
      return { type: 'Image', icon: '🖼️', color: '#4CAF50' };
    }
    if (file.isVideo) {
      return { type: 'Video', icon: '🎥', color: '#FF5722' };
    }
    if (file.isAudio) {
      return { type: 'Audio', icon: '🎵', color: '#9C27B0' };
    }
    if (file.type.includes('pdf')) {
      return { type: 'PDF', icon: '📄', color: '#F44336' };
    }
    if (file.type.includes('word') || file.type.includes('document')) {
      return { type: 'Document', icon: '📝', color: '#2196F3' };
    }
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) {
      return { type: 'Spreadsheet', icon: '📊', color: '#4CAF50' };
    }
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
      return { type: 'Presentation', icon: '📽️', color: '#FF9800' };
    }
    if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('archive')) {
      return { type: 'Archive', icon: '📦', color: '#795548' };
    }
    return { type: 'File', icon: '📄', color: '#607D8B' };
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const webMediaUploadService = new WebMediaUploadService();
export default webMediaUploadService; 