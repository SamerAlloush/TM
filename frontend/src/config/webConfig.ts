// Web-specific configuration
export const webConfig = {
  // API Configuration
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
    timeout: 30000, // 30 seconds
    uploadTimeout: 60000, // 60 seconds for uploads
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    allowedTypes: [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      
      // Videos
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv',
      'video/webm',
      'video/mkv',
      
      // Audio
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'audio/aac',
      'audio/flac',
      
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml',
      
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
      
      // Code files
      'application/x-python-code',
      'text/x-python',
      'text/x-java-source',
      'text/x-c++src',
      'text/x-c',
      'text/x-php',
      'text/x-ruby',
      'text/x-perl',
      'text/x-shellscript',
      'text/x-sql',
      'text/x-yaml',
      'text/x-toml',
      'text/x-ini',
      'text/x-markdown',
      
      // Other common types
      'application/octet-stream', // Generic binary
    ],
    
    // File type icons and colors
    fileTypes: {
      image: { icon: '🖼️', color: '#4CAF50', label: 'Image' },
      video: { icon: '🎥', color: '#FF5722', label: 'Video' },
      audio: { icon: '🎵', color: '#9C27B0', label: 'Audio' },
      pdf: { icon: '📄', color: '#F44336', label: 'PDF' },
      document: { icon: '📝', color: '#2196F3', label: 'Document' },
      spreadsheet: { icon: '📊', color: '#4CAF50', label: 'Spreadsheet' },
      presentation: { icon: '📽️', color: '#FF9800', label: 'Presentation' },
      archive: { icon: '📦', color: '#795548', label: 'Archive' },
      code: { icon: '💻', color: '#607D8B', label: 'Code' },
      file: { icon: '📄', color: '#607D8B', label: 'File' },
    }
  },

  // UI Configuration
  ui: {
    // Upload progress
    showProgress: true,
    progressUpdateInterval: 100, // ms
    
    // File preview
    imagePreviewSize: { width: 200, height: 150 },
    thumbnailSize: { width: 60, height: 60 },
    
    // Messages
    maxMessageLength: 1000,
    typingIndicatorTimeout: 3000, // ms
    
    // Animations
    animationDuration: 300, // ms
  },

  // Socket Configuration
  socket: {
    reconnectAttempts: 5,
    reconnectDelay: 1000, // ms
    heartbeatInterval: 30000, // ms
  },

  // Storage Configuration
  storage: {
    // Local storage keys
    tokenKey: 'chat_token',
    userKey: 'chat_user',
    settingsKey: 'chat_settings',
    
    // Session storage keys
    tempFilesKey: 'temp_upload_files',
    draftMessagesKey: 'draft_messages',
  },

  // Feature flags
  features: {
    webFileUpload: true,
    imagePreview: true,
    dragAndDrop: true,
    pasteFromClipboard: true,
    keyboardShortcuts: true,
    realTimeTyping: true,
    messageReactions: true,
    messageReplies: true,
    messageSearch: true,
    fileDownload: true,
    mediaGallery: true,
  },

  // Debug configuration
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'info', // 'error', 'warn', 'info', 'debug'
    logUploads: true,
    logSocketEvents: true,
    logAPIRequests: true,
  }
};

// Helper functions
export const getFileTypeInfo = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return webConfig.upload.fileTypes.image;
  }
  if (mimeType.startsWith('video/')) {
    return webConfig.upload.fileTypes.video;
  }
  if (mimeType.startsWith('audio/')) {
    return webConfig.upload.fileTypes.audio;
  }
  if (mimeType === 'application/pdf') {
    return webConfig.upload.fileTypes.pdf;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return webConfig.upload.fileTypes.document;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return webConfig.upload.fileTypes.spreadsheet;
  }
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return webConfig.upload.fileTypes.presentation;
  }
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
    return webConfig.upload.fileTypes.archive;
  }
  if (mimeType.includes('code') || mimeType.includes('script') || mimeType.includes('text/')) {
    return webConfig.upload.fileTypes.code;
  }
  return webConfig.upload.fileTypes.file;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isValidFileType = (mimeType: string): boolean => {
  return webConfig.upload.allowedTypes.includes(mimeType);
};

export const isValidFileSize = (size: number): boolean => {
  return size <= webConfig.upload.maxFileSize;
};

export default webConfig; 