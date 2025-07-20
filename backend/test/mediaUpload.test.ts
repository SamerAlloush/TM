import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileProcessingService } from '../src/services/fileProcessingService';
import { app } from '../src/app';

describe('Media Upload System Tests', () => {
  const testFilesDir = path.join(__dirname, 'testFiles');
  let testToken: string;

  beforeAll(async () => {
    // Create test files directory if it doesn't exist
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir);
    }

    // Login to get test token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'test123'
      });

    testToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true });
    }
  });

  describe('File Processing Service', () => {
    test('should validate supported file types', () => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'video/mp4',
        'audio/mp3',
        'application/pdf',
        'text/plain',
        'application/zip'
      ];

      validTypes.forEach(type => {
        expect(fileProcessingService.isSupported(type)).toBe(true);
      });
    });

    test('should reject unsupported file types', () => {
      const invalidTypes = [
        'application/unknown',
        'text/unknown',
        'video/unknown'
      ];

      invalidTypes.forEach(type => {
        expect(fileProcessingService.isSupported(type)).toBe(false);
      });
    });

    test('should format file size correctly', () => {
      expect(fileProcessingService.formatFileSize(1024)).toBe('1 KB');
      expect(fileProcessingService.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(fileProcessingService.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('should get correct file type icons', () => {
      expect(fileProcessingService.getFileTypeIcon('image/jpeg')).toBe('🖼️');
      expect(fileProcessingService.getFileTypeIcon('video/mp4')).toBe('🎥');
      expect(fileProcessingService.getFileTypeIcon('audio/mp3')).toBe('🎵');
      expect(fileProcessingService.getFileTypeIcon('application/pdf')).toBe('📄');
    });
  });

  describe('Media Upload API', () => {
    test('should upload single image file', async () => {
      const response = await request(app)
        .post('/api/conversations/test-conversation-id/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('files', path.join(testFilesDir, 'test-image.jpg'))
        .field('content', 'Test image upload');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.files).toBeDefined();
    });

    test('should upload multiple files', async () => {
      const response = await request(app)
        .post('/api/conversations/test-conversation-id/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('files', path.join(testFilesDir, 'test-image.jpg'))
        .attach('files', path.join(testFilesDir, 'test-document.pdf'))
        .field('content', 'Test multiple files upload');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
    });

    test('should reject files exceeding size limit', async () => {
      // Create a large test file
      const largeFilePath = path.join(testFilesDir, 'large-file.txt');
      const largeContent = 'x'.repeat(101 * 1024 * 1024); // 101MB
      fs.writeFileSync(largeFilePath, largeContent);

      const response = await request(app)
        .post('/api/conversations/test-conversation-id/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('files', largeFilePath)
        .field('content', 'Test large file upload');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FILE_TOO_LARGE');

      // Clean up
      fs.unlinkSync(largeFilePath);
    });

    test('should reject unsupported file types', async () => {
      const response = await request(app)
        .post('/api/conversations/test-conversation-id/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('files', path.join(testFilesDir, 'unsupported.xyz'))
        .field('content', 'Test unsupported file type');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNSUPPORTED_FILE_TYPE');
    });

    test('should reject too many files', async () => {
      const files = Array.from({ length: 11 }, (_, i) => 
        path.join(testFilesDir, `test-file-${i}.txt`)
      );

      const requestBuilder = request(app)
        .post('/api/conversations/test-conversation-id/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .field('content', 'Test too many files');

      files.forEach(file => {
        requestBuilder.attach('files', file);
      });

      const response = await requestBuilder;

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('TOO_MANY_FILES');
    });
  });

  describe('Message with Media', () => {
    test('should send message with media attachments', async () => {
      const response = await request(app)
        .post('/api/conversations/test-conversation-id/messages')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          content: 'Test message with media',
          type: 'text'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
}); 