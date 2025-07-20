import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

export interface ProcessedFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  thumbnailUrl?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    format?: string;
    codec?: string;
    sampleRate?: number;
    channels?: number;
    pages?: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  mimeType?: string;
  size?: number;
}

class FileProcessingService {
  private readonly uploadDir = 'uploads';
  private readonly thumbnailsDir = 'uploads/thumbnails';
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly maxFiles = 10;

  // Supported file types
  private readonly supportedTypes = {
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
  };

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [this.uploadDir, this.thumbnailsDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  public isSupported(mimeType: string): boolean {
    const allTypes = [
      ...this.supportedTypes.image,
      ...this.supportedTypes.video,
      ...this.supportedTypes.audio,
      ...this.supportedTypes.document,
      ...this.supportedTypes.archive,
      ...this.supportedTypes.code
    ];
    return allTypes.includes(mimeType);
  }

  public validateFile(file: Express.Multer.File): FileValidationResult {
    // Check file size
    if (file.size > this.maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds limit of ${this.maxFileSize / (1024 * 1024)}MB`
      };
    }

    // Check if file type is supported
    if (!this.isSupported(file.mimetype)) {
      return {
        isValid: false,
        error: `File type ${file.mimetype} is not supported`
      };
    }

    return {
      isValid: true,
      mimeType: file.mimetype,
      size: file.size
    };
  }

  public async processFile(file: Express.Multer.File, onProgress?: (progress: number) => void): Promise<ProcessedFile> {
    const fileId = uuidv4();
    const extension = path.extname(file.originalname);
    const fileName = `${fileId}${extension}`;
    
    // With diskStorage, file is already saved - use the existing path
    const filePath = file.path || path.join(this.uploadDir, fileName);
    const url = `/uploads/${path.basename(filePath)}`;

    if (onProgress) onProgress(10); // File received

    // Verify file exists on disk
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on disk: ${filePath}`);
    }

    if (onProgress) onProgress(30); // File verified

    // Get actual file size from disk
    const stats = fs.statSync(filePath);
    const actualSize = stats.size;

    console.log('📎 Processing file:', {
      originalName: file.originalname,
      fileName: path.basename(filePath),
      filePath,
      size: actualSize,
      mimeType: file.mimetype,
      url
    });

    // Process based on file type
    const processedFile: ProcessedFile = {
      id: fileId,
      originalName: file.originalname,
      fileName: path.basename(filePath),
      mimeType: file.mimetype,
      size: actualSize,
      url,
      path: filePath,
      metadata: {}
    };

    if (onProgress) onProgress(50); // Processing started

    // Generate thumbnail and extract metadata based on file type
    if (this.supportedTypes.image.includes(file.mimetype)) {
      await this.processImage(processedFile);
    } else if (this.supportedTypes.video.includes(file.mimetype)) {
      await this.processVideo(processedFile);
    } else if (this.supportedTypes.audio.includes(file.mimetype)) {
      await this.processAudio(processedFile);
    } else if (file.mimetype === 'application/pdf') {
      await this.processPDF(processedFile);
    }

    if (onProgress) onProgress(100); // Processing complete

    return processedFile;
  }

  private async processImage(file: ProcessedFile): Promise<void> {
    try {
      const image = sharp(file.path);
      const metadata = await image.metadata();

      // Update metadata
      file.metadata.width = metadata.width;
      file.metadata.height = metadata.height;
      file.metadata.format = metadata.format;

      // Generate thumbnail
      const thumbnailName = `thumb_${file.fileName}`;
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);
      
      await image
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      file.thumbnailUrl = `/uploads/thumbnails/${thumbnailName}`;
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  private async processVideo(file: ProcessedFile): Promise<void> {
    try {
      // Extract video metadata
      const metadata = await this.getVideoMetadata(file.path);
      file.metadata = { ...file.metadata, ...metadata };

      // Generate thumbnail
      const thumbnailName = `thumb_${file.fileName}.jpg`;
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailName);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(file.path)
          .screenshots({
            timestamps: ['00:00:01'],
            filename: thumbnailName,
            folder: this.thumbnailsDir,
            size: '200x200'
          })
          .on('end', () => {
            file.thumbnailUrl = `/uploads/thumbnails/${thumbnailName}`;
            resolve();
          })
          .on('error', reject);
      });
    } catch (error) {
      console.error('Error processing video:', error);
    }
  }

  private async processAudio(file: ProcessedFile): Promise<void> {
    try {
      const metadata = await this.getAudioMetadata(file.path);
      file.metadata = { ...file.metadata, ...metadata };
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }

  private async processPDF(file: ProcessedFile): Promise<void> {
    try {
      // For PDFs, we could extract text, page count, etc.
      // For now, just store basic info
      file.metadata.format = 'pdf';
    } catch (error) {
      console.error('Error processing PDF:', error);
    }
  }

  private async getVideoMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
        const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          width: videoStream?.width,
          height: videoStream?.height,
          codec: videoStream?.codec_name,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels
        });
      });
    });
  }

  private async getAudioMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          codec: audioStream?.codec_name,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels
        });
      });
    });
  }

  public async deleteFile(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, fileName);
      const thumbnailPath = path.join(this.thumbnailsDir, `thumb_${fileName}`);

      // Delete main file
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }

      // Delete thumbnail if exists
      if (fs.existsSync(thumbnailPath)) {
        await unlinkAsync(thumbnailPath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  public getFileTypeIcon(mimeType: string): string {
    if (this.supportedTypes.image.includes(mimeType)) return '🖼️';
    if (this.supportedTypes.video.includes(mimeType)) return '🎥';
    if (this.supportedTypes.audio.includes(mimeType)) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (this.supportedTypes.document.includes(mimeType)) return '📝';
    if (this.supportedTypes.archive.includes(mimeType)) return '📦';
    if (this.supportedTypes.code.includes(mimeType)) return '💻';
    return '📎';
  }

  public formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  public getMaxFileSize(): number {
    return this.maxFileSize;
  }

  public getMaxFiles(): number {
    return this.maxFiles;
  }

  public getSupportedTypes(): any {
    return this.supportedTypes;
  }
}

export const fileProcessingService = new FileProcessingService(); 