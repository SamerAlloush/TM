// API Configuration
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000/api' 
  : 'https://your-production-api.com/api';

// Media Upload Configuration
export const MEDIA_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  supportedTypes: {
    image: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
      'image/svg+xml', 'image/bmp', 'image/tiff', 'image/x-icon'
    ],
    video: [
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
      'video/webm', 'video/x-flv', 'video/3gpp', 'video/x-ms-wmv'
    ],
    audio: [
      'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac',
      'audio/x-m4a', 'audio/webm', 'audio/3gpp', 'audio/mp4'
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml',
      'text/xml',
      'text/markdown'
    ],
    archive: [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip'
    ],
    code: [
      'text/javascript',
      'application/javascript',
      'text/typescript',
      'application/json',
      'text/html',
      'text/css',
      'text/xml',
      'application/xml',
      'text/markdown',
      'text/x-python',
      'text/x-java',
      'text/x-c',
      'text/x-cpp',
      'text/x-csharp',
      'text/x-php',
      'text/x-ruby',
      'text/x-go',
      'text/x-rust',
      'text/x-swift',
      'text/x-kotlin'
    ]
  }
};

// Socket.IO Configuration
export const SOCKET_CONFIG = {
  url: __DEV__ 
    ? 'http://localhost:5000' 
    : 'https://your-production-api.com',
  options: {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true
  }
};

// UI Configuration
export const UI_CONFIG = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    disabled: '#C7C7CC'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24
  }
};

// Upload Configuration
export const UPLOAD_CONFIG = {
  chunkSize: 1024 * 1024, // 1MB chunks
  retryAttempts: 3,
  retryDelay: 1000,
  progressInterval: 100
}; 