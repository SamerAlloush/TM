const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

// Test the file upload process
async function testFileUpload() {
  try {
    console.log('🔍 Testing file upload process...');
    
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload');
    
    // Create FormData
    const formData = new FormData();
    formData.append('content', 'Test message with file');
    formData.append('files', fs.createReadStream(testFilePath), 'test-file.txt');
    
    console.log('📎 FormData created with test file');
    
    // Test login first
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'samer@example.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');
    
    // Test conversation creation
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        participantId: '675fe123456789abcdef0002' // Example participant ID
      })
    });
    
    if (!convResponse.ok) {
      console.error('❌ Conversation creation failed:', await convResponse.text());
      return;
    }
    
    const convData = await convResponse.json();
    const conversationId = convData.data._id;
    console.log('✅ Conversation created:', conversationId);
    
    // Test file upload
    const uploadResponse = await fetch(`http://localhost:3002/api/conversations/${conversationId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    console.log('📋 Upload response status:', uploadResponse.status);
    console.log('📋 Upload response headers:', uploadResponse.headers.raw());
    
    const responseText = await uploadResponse.text();
    console.log('📋 Upload response text:', responseText);
    
    if (uploadResponse.ok) {
      try {
        const uploadData = JSON.parse(responseText);
        console.log('✅ Upload successful:', uploadData);
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        console.error('Response was:', responseText);
      }
    } else {
      console.error('❌ Upload failed');
    }
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testFileUpload();
