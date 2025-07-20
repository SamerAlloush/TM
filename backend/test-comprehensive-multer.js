// Test that simulates browser FormData behavior
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

// Create a test that mimics browser File objects
function createMockFile(filePath, name, type) {
  const buffer = fs.readFileSync(filePath);
  
  // Create a mock File-like object
  const mockFile = {
    name: name,
    size: buffer.length,
    type: type,
    arrayBuffer: () => Promise.resolve(buffer),
    stream: () => {
      const { Readable } = require('stream');
      return Readable.from(buffer);
    },
    text: () => Promise.resolve(buffer.toString())
  };
  
  return mockFile;
}

async function testBrowserLikeUpload() {
  console.log('🔍 Testing browser-like file upload...');
  
  try {
    // Create test file
    const testFilePath = path.join(__dirname, 'test-browser-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for browser-like upload');
    
    // Create mock File objects like browser would
    const mockFile = createMockFile(testFilePath, 'test-browser-file.txt', 'text/plain');
    
    console.log('📁 Mock file created:', {
      name: mockFile.name,
      size: mockFile.size,
      type: mockFile.type
    });
    
    // Test with our standalone server
    const formData = new FormData();
    formData.append('content', 'Test message from browser-like upload');
    
    // Try different ways to append the file
    console.log('📎 Testing different file append methods...');
    
    // Method 1: Direct buffer
    const fileBuffer = fs.readFileSync(testFilePath);
    formData.append('files', fileBuffer, {
      filename: mockFile.name,
      contentType: mockFile.type
    });
    
    console.log('📦 FormData created with buffer method');
    
    const response = await fetch('http://localhost:3003/test-upload', {
      method: 'POST',
      body: formData
    });
    
    console.log('📋 Response status:', response.status);
    const result = await response.json();
    console.log('📋 Response:', result);
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Browser-like test error:', error);
  }
}

// Test the issue with the main server
async function testMainServerFileUpload() {
  console.log('🔍 Testing main server file upload with valid auth...');
  
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    // Create a simple test - just send message with file directly to messages endpoint
    const testFilePath = path.join(__dirname, 'test-main-server.txt');
    fs.writeFileSync(testFilePath, 'Test file for main server');
    
    const formData = new FormData();
    formData.append('content', 'Test message with file');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-main-server.txt',
      contentType: 'text/plain'
    });
    
    // Test the messages endpoint directly (it should have the same multer setup)
    const uploadResponse = await fetch('http://localhost:3002/api/conversations/test-conv/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      },
      body: formData
    });
    
    console.log('📋 Messages endpoint response status:', uploadResponse.status);
    const responseText = await uploadResponse.text();
    console.log('📋 Messages endpoint response:', responseText);
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Main server test error:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting comprehensive file upload tests...');
  
  // Test 1: Browser-like upload to standalone server
  await testBrowserLikeUpload();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Main server with auth
  await testMainServerFileUpload();
  
  console.log('✅ All tests completed');
}

runTests();
