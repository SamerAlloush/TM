// Test script to simulate the exact frontend file upload behavior
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

// Test the exact frontend behavior
async function testFrontendFileUpload() {
  try {
    console.log('🔍 Testing frontend file upload behavior...');
    
    // Create a simple image file (simulate user upload)
    const testFilePath = path.join(__dirname, 'test-image.png');
    const simpleImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testFilePath, simpleImageData);
    
    // Create FormData exactly like the frontend
    const formData = new FormData();
    
    // Add content (text message)
    formData.append('content', 'Hello with image!');
    
    // Add files exactly like frontend - multiple files
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    
    // Add another file
    const testTextPath = path.join(__dirname, 'test-doc.txt');
    fs.writeFileSync(testTextPath, 'This is a test document');
    formData.append('files', fs.createReadStream(testTextPath), {
      filename: 'test-doc.txt',
      contentType: 'text/plain'
    });
    
    console.log('📎 FormData created with 2 files');
    
    // First step: verify our OTP user from previous test
    const otpVerifyResponse = await fetch('http://localhost:3002/api/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        otp: '444674'
      })
    });
    
    if (!otpVerifyResponse.ok) {
      console.log('❌ OTP verification failed, trying to login directly');
      
      // Try to login with an admin account if it exists
      const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@tm-paysage.com',
          password: 'admin123'
        })
      });
      
      if (!loginResponse.ok) {
        console.log('❌ Admin login failed, creating new test user');
        
        // Create and immediately verify a new user
        const newUserResponse = await fetch('http://localhost:3002/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: 'Upload',
            lastName: 'Test',
            email: 'upload@test.com',
            password: 'test123',
            role: 'Administrator'
          })
        });
        
        if (!newUserResponse.ok) {
          console.log('❌ New user registration failed');
          return;
        }
        
        console.log('✅ New user registered, need to verify OTP');
        return;
      }
      
      const loginData = await loginResponse.json();
      console.log('✅ Admin login successful');
      
      // Now test the file upload
      await testUploadWithToken(loginData.token, formData);
      
    } else {
      const otpData = await otpVerifyResponse.json();
      console.log('✅ OTP verification successful');
      
      // Now test the file upload
      await testUploadWithToken(otpData.token, formData);
    }
    
    // Clean up
    fs.unlinkSync(testFilePath);
    fs.unlinkSync(testTextPath);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

async function testUploadWithToken(token, formData) {
  try {
    console.log('🔍 Testing file upload with valid token...');
    
    // Create a conversation first (simplified)
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!convResponse.ok) {
      console.log('❌ Failed to get conversations');
      return;
    }
    
    const convData = await convResponse.json();
    let conversationId = null;
    
    if (convData.data && convData.data.length > 0) {
      conversationId = convData.data[0]._id;
      console.log('✅ Using existing conversation:', conversationId);
    } else {
      console.log('❌ No conversations found');
      return;
    }
    
    // Now test the file upload
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
        console.log('✅ Upload successful!');
        console.log('Files processed:', uploadData.files?.length || 0);
        console.log('Message created:', !!uploadData.message);
        console.log('Attachments:', uploadData.message?.attachments?.length || 0);
        
        // Show detailed file info
        if (uploadData.files && uploadData.files.length > 0) {
          uploadData.files.forEach((file, index) => {
            console.log(`File ${index + 1}:`, {
              originalName: file.originalName,
              fileName: file.fileName,
              size: file.size,
              url: file.url,
              mimeType: file.mimeType
            });
          });
        }
        
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
      }
    } else {
      console.error('❌ Upload failed');
    }
    
  } catch (error) {
    console.error('❌ Upload test error:', error);
  }
}

// Run the test
testFrontendFileUpload();
