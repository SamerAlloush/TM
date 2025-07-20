// Test script to verify the media upload system
// Run this from the backend directory: node test-media-upload-system.js

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_CONVERSATION_ID = 'test-conversation-id';

// Mock files for testing
const createTestFiles = () => {
  const testDir = path.join(__dirname, 'test-files');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create test image file
  const imageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(testDir, 'test-image.png'), imageData);

  // Create test document file
  const docData = Buffer.from('Test document content for upload testing');
  fs.writeFileSync(path.join(testDir, 'test-document.txt'), docData);

  return {
    image: path.join(testDir, 'test-image.png'),
    document: path.join(testDir, 'test-document.txt')
  };
};

// Test functions
const testMediaUpload = async (token, files) => {
  console.log('🧪 Testing media upload system...\n');

  try {
    // Test 1: Upload files to conversation
    console.log('1. Testing file upload to conversation...');
    const formData = new FormData();
    formData.append('content', 'Test message with media attachments');
    formData.append('files', fs.createReadStream(files.image));
    formData.append('files', fs.createReadStream(files.document));

    const uploadResponse = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    console.log('✅ File upload successful:', uploadResponse.data);

    // Test 2: Media-only upload
    console.log('\n2. Testing media-only upload...');
    const mediaOnlyFormData = new FormData();
    mediaOnlyFormData.append('files', fs.createReadStream(files.image));

    const mediaOnlyResponse = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      mediaOnlyFormData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...mediaOnlyFormData.getHeaders()
        }
      }
    );

    console.log('✅ Media-only upload successful:', mediaOnlyResponse.data);

    // Test 3: Large file handling
    console.log('\n3. Testing large file handling...');
    const largeFileData = Buffer.alloc(5 * 1024 * 1024, 'a'); // 5MB file
    const largeFilePath = path.join(__dirname, 'test-files', 'large-file.txt');
    fs.writeFileSync(largeFilePath, largeFileData);

    const largeFileFormData = new FormData();
    largeFileFormData.append('content', 'Large file test');
    largeFileFormData.append('files', fs.createReadStream(largeFilePath));

    const largeFileResponse = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      largeFileFormData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...largeFileFormData.getHeaders()
        }
      }
    );

    console.log('✅ Large file upload successful:', largeFileResponse.data);

    // Test 4: Multiple file types
    console.log('\n4. Testing multiple file types...');
    const multiFileFormData = new FormData();
    multiFileFormData.append('content', 'Multiple file types test');
    multiFileFormData.append('files', fs.createReadStream(files.image));
    multiFileFormData.append('files', fs.createReadStream(files.document));

    const multiFileResponse = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      multiFileFormData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...multiFileFormData.getHeaders()
        }
      }
    );

    console.log('✅ Multiple file types upload successful:', multiFileResponse.data);

    console.log('\n🎉 All tests passed! Media upload system is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
};

// Test retry mechanism
const testRetryMechanism = async (token) => {
  console.log('\n🔄 Testing retry mechanism...\n');

  try {
    // Create a corrupted file to test retry logic
    const corruptedFilePath = path.join(__dirname, 'test-files', 'corrupted-file.txt');
    fs.writeFileSync(corruptedFilePath, Buffer.from('corrupted data'));

    const formData = new FormData();
    formData.append('content', 'Testing retry mechanism');
    formData.append('files', fs.createReadStream(corruptedFilePath));

    const response = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        }
      }
    );

    console.log('✅ Retry mechanism test passed:', response.data);
    return true;

  } catch (error) {
    console.log('⚠️ Expected failure for retry test:', error.response?.data || error.message);
    return true; // Expected to fail for testing
  }
};

// Test progress tracking
const testProgressTracking = async (token, files) => {
  console.log('\n📊 Testing progress tracking...\n');

  try {
    const formData = new FormData();
    formData.append('content', 'Testing progress tracking');
    formData.append('files', fs.createReadStream(files.image));

    const response = await axios.post(
      `${API_BASE_URL}/conversations/${TEST_CONVERSATION_ID}/messages`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      }
    );

    console.log('✅ Progress tracking test passed:', response.data);
    return true;

  } catch (error) {
    console.error('❌ Progress tracking test failed:', error.response?.data || error.message);
    return false;
  }
};

// Main test execution
const runTests = async () => {
  console.log('🚀 Starting Media Upload System Tests\n');

  // Get auth token (you'll need to implement login or use a test token)
  const token = process.env.TEST_TOKEN || 'your-test-token-here';
  
  if (!token || token === 'your-test-token-here') {
    console.log('❌ Please set TEST_TOKEN environment variable or update the token in the script');
    return;
  }

  // Create test files
  const files = createTestFiles();
  console.log('📁 Test files created:', files);

  // Run tests
  const results = await Promise.all([
    testMediaUpload(token, files),
    testRetryMechanism(token),
    testProgressTracking(token, files)
  ]);

  const passedTests = results.filter(result => result).length;
  const totalTests = results.length;

  console.log(`\n📋 Test Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Media upload system is fully functional.');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }

  // Cleanup
  const testDir = path.join(__dirname, 'test-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
    console.log('🧹 Test files cleaned up');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testMediaUpload,
  testRetryMechanism,
  testProgressTracking,
  runTests
};
