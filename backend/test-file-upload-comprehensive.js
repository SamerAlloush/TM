const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

// Test the file upload process with real data
async function testFileUploadWithRealData() {
  try {
    console.log('🔍 Testing file upload with real data...');
    
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload');
    
    // First, get all users to find valid user IDs
    const usersResponse = await fetch('http://localhost:3002/api/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!usersResponse.ok) {
      console.log('❌ Failed to fetch users, trying to create test user...');
      
      // Try to register a test user
      const registerResponse = await fetch('http://localhost:3002/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'password123',
          role: 'Administrator' // Use valid role
        })
      });
      
      if (!registerResponse.ok) {
        console.log('❌ Failed to register test user');
        return;
      }
      
      console.log('✅ Test user registered');
    }
    
    // Try to login
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
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
    
    // Get users to find a participant
    const usersResponse2 = await fetch('http://localhost:3002/api/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!usersResponse2.ok) {
      console.error('❌ Failed to fetch users:', await usersResponse2.text());
      return;
    }
    
    const usersData = await usersResponse2.json();
    const users = usersData.users || usersData.data || usersData;
    
    if (!users || users.length === 0) {
      console.error('❌ No users found');
      return;
    }
    
    // Find a participant (not the current user)
    const currentUser = loginData.user;
    const participant = users.find(u => u._id !== currentUser._id);
    
    if (!participant) {
      console.error('❌ No other participants found');
      return;
    }
    
    console.log('✅ Found participant:', participant.firstName, participant.lastName);
    
    // Test conversation creation
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        participantId: participant._id
      })
    });
    
    if (!convResponse.ok) {
      console.error('❌ Conversation creation failed:', await convResponse.text());
      return;
    }
    
    const convData = await convResponse.json();
    const conversationId = convData.data._id;
    console.log('✅ Conversation created:', conversationId);
    
    // Create FormData with the correct field name
    const formData = new FormData();
    formData.append('content', 'Test message with file');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-file.txt',
      contentType: 'text/plain'
    });
    
    console.log('📎 FormData created with test file');
    
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
        
        // Check if files were actually processed
        if (uploadData.files && uploadData.files.length > 0) {
          console.log('✅ Files processed:', uploadData.files.length);
          uploadData.files.forEach((file, index) => {
            console.log(`File ${index + 1}:`, {
              name: file.originalName,
              size: file.size,
              url: file.url
            });
          });
        } else {
          console.log('❌ No files processed');
        }
        
        // Check if message was created with attachments
        if (uploadData.message && uploadData.message.attachments) {
          console.log('✅ Message attachments:', uploadData.message.attachments.length);
        } else {
          console.log('❌ No attachments in message');
        }
        
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
testFileUploadWithRealData();
