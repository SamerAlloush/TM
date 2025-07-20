import { fileProcessingService } from './fileProcessingService';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
  attempts?: number;
}

class UploadRetryService {
  private defaultOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  /**
   * Retry file upload with exponential backoff
   */
  async retryUpload<T>(
    uploadFunction: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<UploadResult> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Upload attempt ${attempt}/${config.maxRetries}`);
        const result = await uploadFunction();
        
        console.log(`✅ Upload successful on attempt ${attempt}`);
        return {
          success: true,
          data: result,
          attempts: attempt
        };
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Upload failed on attempt ${attempt}:`, error);
        
        if (attempt === config.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        console.log(`⏱️ Retrying in ${delay}ms...`);
        await this.delay(delay);
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Upload failed after all retries',
      attempts: config.maxRetries
    };
  }

  /**
   * Retry file processing specifically
   */
  async retryFileProcessing(
    file: Express.Multer.File,
    onProgress?: (progress: number) => void,
    options: Partial<RetryOptions> = {}
  ): Promise<UploadResult> {
    return this.retryUpload(
      () => fileProcessingService.processFile(file, onProgress),
      options
    );
  }

  /**
   * Batch retry for multiple files
   */
  async retryBatchUpload<T>(
    uploadFunctions: Array<() => Promise<T>>,
    options: Partial<RetryOptions> = {}
  ): Promise<UploadResult[]> {
    const results = await Promise.allSettled(
      uploadFunctions.map(uploadFn => this.retryUpload(uploadFn, options))
    );
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { success: false, error: 'Promise rejected' }
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED',
      'NETWORK_ERROR',
      'TIMEOUT'
    ];
    
    return retryableErrors.some(errorCode => 
      error.message.includes(errorCode) || 
      error.name.includes(errorCode)
    );
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate file before upload
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    // Check file size
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      };
    }

    // Check if file type is supported
    if (!fileProcessingService.isSupported(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not supported`
      };
    }

    return { valid: true };
  }

  /**
   * Process files with retry logic and progress tracking
   */
  async processFilesWithRetry(
    files: Express.Multer.File[],
    onProgress?: (fileIndex: number, fileProgress: number, totalProgress: number) => void,
    options: Partial<RetryOptions> = {}
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file first
      const validation = this.validateFile(file);
      if (!validation.valid) {
        results.push({
          success: false,
          error: validation.error,
          attempts: 0
        });
        continue;
      }
      
      // Process file with retry
      const result = await this.retryFileProcessing(
        file,
        (progress) => {
          const totalProgress = Math.round(((i + progress / 100) / files.length) * 100);
          onProgress?.(i, progress, totalProgress);
        },
        options
      );
      
      results.push(result);
    }
    
    return results;
  }
}

export const uploadRetryService = new UploadRetryService();
export default uploadRetryService;
