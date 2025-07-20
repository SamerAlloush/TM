import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileProcessingService } from '../services/fileProcessingService';
import { uploadRetryService } from '../services/uploadRetryService';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadDir);
}

// Configure multer storage - USE DISK STORAGE FOR BETTER FILE HANDLING
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('🔍 Multer file filter:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
    size: file.size
  });
  
  if (fileProcessingService.isSupported(file.mimetype)) {
    console.log('✅ File type supported:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ File type not supported:', file.mimetype);
    cb(new Error(`File type ${file.mimetype} is not supported`));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: fileProcessingService.getMaxFileSize(),
    files: fileProcessingService.getMaxFiles()
  }
});

console.log('📁 Multer configured with disk storage:', {
  uploadDir,
  maxFileSize: fileProcessingService.getMaxFileSize() / (1024 * 1024) + 'MB',
  maxFiles: fileProcessingService.getMaxFiles()
});

// Error handler middleware
const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: `File size exceeds limit of ${fileProcessingService.getMaxFileSize() / (1024 * 1024)}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_FILES',
        message: `Too many files (maximum ${fileProcessingService.getMaxFiles()})`
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message
    });
  }
  
  if (err.message && err.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      error: 'UNSUPPORTED_FILE_TYPE',
      message: err.message
    });
  }

  return next(err);
};

// File processing middleware with disk storage support
const processUploadedFiles = async (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || !Array.isArray(files) || files.length === 0) {
    console.log('📎 No files to process');
    (req as any).processedFiles = [];
    return next();
  }

  try {
    console.log(`📎 Processing ${files.length} uploaded files...`);
    
    const socketManager = require('../config/socket').getSocketManager();
    const conversationId = req.params.conversationId || req.params.id;
    
    // Start processing notification
    if (socketManager && conversationId) {
      socketManager.emitToConversation(
        conversationId,
        'upload:progress',
        {
          conversationId,
          progress: 0,
          status: 'processing',
          totalFiles: files.length
        }
      );
    }

    // Process files directly from disk
    const processedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      console.log(`📎 Processing file ${i + 1}/${files.length}:`, {
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      });
      
      try {
        // Verify file exists on disk
        if (!fs.existsSync(file.path)) {
          console.error(`❌ File not found on disk: ${file.path}`);
          continue;
        }
        
        // Get actual file stats
        const stats = fs.statSync(file.path);
        
        // Create processed file object directly from disk file
        const processedFile = {
          id: file.filename.split('.')[0], // Use filename as ID
          originalName: file.originalname,
          fileName: file.filename,
          mimeType: file.mimetype,
          size: stats.size,
          url: `/uploads/${file.filename}`,
          path: file.path,
          metadata: {}
        };
        
        processedFiles.push(processedFile);
        console.log(`✅ File processed successfully: ${processedFile.fileName}`);
        
        // Progress update
        const progress = Math.round(((i + 1) / files.length) * 100);
        if (socketManager && conversationId) {
          socketManager.emitToConversation(
            conversationId,
            'upload:progress',
            {
              conversationId,
              progress,
              status: 'processing',
              currentFile: file.originalname,
              fileIndex: i + 1,
              totalFiles: files.length
            }
          );
        }
        
      } catch (fileError) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileError);
      }
    }

    // Attach processed files to request
    (req as any).processedFiles = processedFiles;
    
    console.log(`✅ Successfully processed ${processedFiles.length}/${files.length} files`);
    
    // Final progress update
    if (socketManager && conversationId) {
      socketManager.emitToConversation(
        conversationId,
        'upload:complete',
        {
          conversationId,
          progress: 100,
          status: 'complete',
          totalFiles: processedFiles.length,
          successCount: processedFiles.length,
          failedCount: files.length - processedFiles.length
        }
      );
    }
    
    next();
  } catch (error) {
    console.error('❌ Error in file processing middleware:', error);
    
    // Clean up uploaded files on error
    if (files && Array.isArray(files)) {
      files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`🗑️ Cleaned up file: ${file.path}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup file ${file.path}:`, cleanupError);
          }
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'FILE_PROCESSING_ERROR',
      message: 'Failed to process uploaded files'
    });
  }
};

// Upload progress tracking middleware
const trackUploadProgress = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Emit upload completion event if files were processed
    if ((req as any).processedFiles && (req as any).processedFiles.length > 0) {
      const socketManager = require('../config/socket').getSocketManager();
      if (socketManager) {
        const uploadData = {
          conversationId: req.params.conversationId || req.params.id,
          files: (req as any).processedFiles,
          uploadedBy: (req as any).user?._id,
          uploadType: req.body.content ? 'mixed' : 'media-only',
          timestamp: new Date().toISOString()
        };
        
        // Emit to conversation participants
        socketManager.emitToConversation(
          req.params.conversationId || req.params.id,
          'media_upload_complete',
          uploadData
        );
        
        // Also emit upload progress completion
        socketManager.emitToConversation(
          req.params.conversationId || req.params.id,
          'upload:progress',
          {
            conversationId: req.params.conversationId || req.params.id,
            progress: 100,
            status: 'complete',
            files: (req as any).processedFiles
          }
        );
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

export const mediaUpload = {
  single: (fieldName: string) => [
    upload.single(fieldName),
    handleUploadError,
    processUploadedFiles,
    trackUploadProgress
  ],
  array: (fieldName: string, maxCount?: number) => [
    upload.array(fieldName, maxCount),
    handleUploadError,
    processUploadedFiles,
    trackUploadProgress
  ],
  fields: (fields: multer.Field[]) => [
    upload.fields(fields),
    handleUploadError,
    processUploadedFiles,
    trackUploadProgress
  ]
}; 