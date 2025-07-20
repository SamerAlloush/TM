const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

// Direct file upload test - test the multer configuration
async function testDirectFileUpload() {
  try {
    console.log('🔍 Testing direct file upload (no auth)...');
    
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload');
    
    // Create FormData with proper field names
    const formData = new FormData();
    formData.append('content', 'Test message with file');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });
    
    console.log('📎 FormData created with test file');
    
    // Test the endpoint directly (this will fail auth but show multer behavior)
    const uploadResponse = await fetch('http://localhost:3002/api/conversations/test/upload', {
      method: 'POST',
      body: formData
    });
    
    console.log('📋 Upload response status:', uploadResponse.status);
    console.log('📋 Upload response headers:', uploadResponse.headers.raw());
    
    const responseText = await uploadResponse.text();
    console.log('📋 Upload response text:', responseText);
    
    // We expect a 401 (unauthorized) but we want to see if multer processed the files
    // Check server logs for file processing messages
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Test with direct multer endpoint if it exists
async function testMulterConfig() {
  try {
    console.log('🔍 Testing multer configuration...');
    
    // Check if uploads directory exists
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      console.log('📁 Uploads directory does not exist');
    } else {
      console.log('📁 Uploads directory exists');
      const files = fs.readdirSync(uploadDir);
      console.log('📁 Files in uploads directory:', files.length);
    }
    
    // Create test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload');
    
    // Test with form-data
    const formData = new FormData();
    formData.append('content', 'Test message');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });
    
    console.log('📎 Testing form-data structure...');
    
    // Get form-data headers
    const headers = formData.getHeaders();
    console.log('📋 Form-data headers:', headers);
    
    // Test endpoint (expect 401 but check for multer processing)
    const response = await fetch('http://localhost:3002/api/conversations/675fe123456789abcdef0001/upload', {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    console.log('📋 Response status:', response.status);
    const responseText = await response.text();
    console.log('📋 Response text:', responseText);
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Multer test error:', error);
  }
}

// Run tests
testDirectFileUpload().then(() => {
  return testMulterConfig();
});
