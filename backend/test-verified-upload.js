// Test with a verified user to see the actual file processing
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

async function testWithVerifiedUser() {
  let testFilePath = null;
  
  try {
    console.log('🔍 Testing with verified user and real upload...');
    
    // 1. Create a user and verify them immediately
    const registerResponse = await fetch('http://localhost:3002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Upload',
        lastName: 'Test',
        email: 'upload-test@example.com',
        password: 'test123',
        role: 'Administrator'
      })
    });
    
    if (!registerResponse.ok) {
      console.log('❌ Registration failed:', await registerResponse.text());
      return;
    }
    
    const regData = await registerResponse.json();
    console.log('✅ User registered, OTP sent');
    
    // For testing, let's use a known working user approach
    // We'll manually create a user in the database with verified status
    
    // 2. Create a simple test file
    testFilePath = path.join(__dirname, 'test-image.png');
    // Create a 1x1 pixel PNG
    const simpleImageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testFilePath, simpleImageData);
    
    // 3. Create a direct database connection to manually verify the user
    const mongoose = require('mongoose');
    
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/tm-paysage');
    
    // Update user to be verified
    const User = mongoose.model('User', {
      firstName: String,
      lastName: String,
      email: String,
      password: String,
      role: String,
      isVerified: Boolean,
      isActive: Boolean
    });
    
    const user = await User.findOneAndUpdate(
      { email: 'upload-test@example.com' },
      { 
        isVerified: true,
        isActive: true
      },
      { new: true }
    );
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('✅ User verified in database');
    
    // 4. Create another user for conversation
    const user2 = await User.create({
      firstName: 'Second',
      lastName: 'User',
      email: 'second@example.com',
      password: 'test123',
      role: 'RH',
      isVerified: true,
      isActive: true
    });
    
    console.log('✅ Second user created');
    
    // 5. Login with the verified user
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'upload-test@example.com',
        password: 'test123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    // 6. Create a conversation
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        participantId: user2._id.toString()
      })
    });
    
    if (!convResponse.ok) {
      console.log('❌ Conversation creation failed:', await convResponse.text());
      return;
    }
    
    const convData = await convResponse.json();
    console.log('✅ Conversation created:', convData.data._id);
    
    // 7. Upload file
    const formData = new FormData();
    formData.append('content', 'Test message with image');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    
    console.log('📤 Uploading file...');
    
    const uploadResponse = await fetch(`http://localhost:3002/api/conversations/${convData.data._id}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      },
      body: formData
    });
    
    console.log('📋 Upload response status:', uploadResponse.status);
    
    const responseText = await uploadResponse.text();
    console.log('📋 Upload response:', responseText);
    
    // Close database connection
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

testWithVerifiedUser();
