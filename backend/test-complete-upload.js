// Complete end-to-end file upload test
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

async function createCompleteFileUploadTest() {
  let testFilePath = null;
  let testTextPath = null;
  
  try {
    console.log('🔍 ===== COMPLETE FILE UPLOAD TEST =====');
    
    // 1. Create two test users
    console.log('👤 Creating test users...');
    
    const user1Response = await fetch('http://localhost:3002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'User',
        lastName: 'One',
        email: 'user1@test.com',
        password: 'test123',
        role: 'Administrator'
      })
    });
    
    const user2Response = await fetch('http://localhost:3002/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'User',
        lastName: 'Two',
        email: 'user2@test.com',
        password: 'test123',
        role: 'RH'
      })
    });
    
    console.log('User 1 registration:', user1Response.status);
    console.log('User 2 registration:', user2Response.status);
    
    // 2. Use the existing verified user from previous test
    const token = await getValidToken();
    if (!token) {
      console.log('❌ Could not get valid token');
      return;
    }
    
    // 3. Get users list to find participants
    const usersResponse = await fetch('http://localhost:3002/api/users', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!usersResponse.ok) {
      console.log('❌ Failed to get users list');
      return;
    }
    
    const usersData = await usersResponse.json();
    console.log('📋 Users found:', usersData.users?.length || 0);
    
    if (!usersData.users || usersData.users.length < 2) {
      console.log('❌ Need at least 2 users for conversation');
      return;
    }
    
    // 4. Create a conversation between users
    const currentUser = usersData.users.find(u => u.email === 'test@example.com');
    const otherUser = usersData.users.find(u => u.email !== 'test@example.com');
    
    if (!currentUser || !otherUser) {
      console.log('❌ Could not find suitable users for conversation');
      return;
    }
    
    console.log('👥 Creating conversation between:', currentUser.email, 'and', otherUser.email);
    
    const convResponse = await fetch('http://localhost:3002/api/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        participantId: otherUser._id
      })
    });
    
    if (!convResponse.ok) {
      console.log('❌ Failed to create conversation:', await convResponse.text());
      return;
    }
    
    const convData = await convResponse.json();
    const conversationId = convData.data._id;
    console.log('✅ Conversation created:', conversationId);
    
    // 5. Create test files
    console.log('📁 Creating test files...');
    
    // Create a simple PNG image
    testFilePath = path.join(__dirname, 'test-image.png');
    const simpleImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testFilePath, simpleImageData);
    
    // Create a text document
    testTextPath = path.join(__dirname, 'test-document.txt');
    fs.writeFileSync(testTextPath, 'This is a test document with some content for upload testing.');
    
    console.log('📎 Test files created');
    
    // 6. Create FormData with files
    const formData = new FormData();
    formData.append('content', 'Here are some files for you!');
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    formData.append('files', fs.createReadStream(testTextPath), {
      filename: 'test-document.txt',
      contentType: 'text/plain'
    });
    
    console.log('📦 FormData created with 2 files');
    
    // 7. Upload files to conversation
    console.log('📤 Uploading files...');
    
    const uploadResponse = await fetch(`http://localhost:3002/api/conversations/${conversationId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    console.log('📋 Upload response status:', uploadResponse.status);
    
    const responseText = await uploadResponse.text();
    console.log('📋 Upload response length:', responseText.length);
    
    if (uploadResponse.ok) {
      try {
        const uploadData = JSON.parse(responseText);
        console.log('✅ ===== UPLOAD SUCCESS =====');
        console.log('📊 Files processed:', uploadData.files?.length || 0);
        console.log('💬 Message created:', !!uploadData.message);
        console.log('📎 Message attachments:', uploadData.message?.attachments?.length || 0);
        console.log('🔗 Message content:', uploadData.message?.content || 'No content');
        console.log('🏷️ Message type:', uploadData.message?.type || 'No type');
        
        // Show detailed file info
        if (uploadData.files && uploadData.files.length > 0) {
          console.log('📋 ===== FILE DETAILS =====');
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
        
        // Show attachment details
        if (uploadData.message?.attachments && uploadData.message.attachments.length > 0) {
          console.log('📎 ===== ATTACHMENT DETAILS =====');
          uploadData.message.attachments.forEach((attachment, index) => {
            console.log(`Attachment ${index + 1}:`, {
              fileName: attachment.fileName,
              originalName: attachment.originalName,
              size: attachment.size,
              url: attachment.url,
              mimeType: attachment.mimeType
            });
          });
        }
        
        // Check if files were actually saved to disk
        console.log('💾 ===== DISK VERIFICATION =====');
        if (uploadData.files && uploadData.files.length > 0) {
          const uploadDir = path.join(__dirname, 'uploads');
          uploadData.files.forEach((file, index) => {
            const filePath = path.join(uploadDir, file.fileName);
            const exists = fs.existsSync(filePath);
            console.log(`File ${index + 1} on disk:`, exists ? '✅ EXISTS' : '❌ MISSING');
            if (exists) {
              const stats = fs.statSync(filePath);
              console.log(`  Size: ${stats.size} bytes`);
            }
          });
        }
        
        console.log('✅ ===== TEST COMPLETED SUCCESSFULLY =====');
        
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        console.error('Response text:', responseText);
      }
    } else {
      console.error('❌ Upload failed');
      console.error('Response text:', responseText);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    // Clean up test files
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (testTextPath && fs.existsSync(testTextPath)) {
      fs.unlinkSync(testTextPath);
    }
  }
}

async function getValidToken() {
  try {
    // Try to use the existing verified user
    const loginResponse = await fetch('http://localhost:3002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login successful with existing user');
      return loginData.token;
    }
    
    console.log('❌ Login failed, user may not be verified');
    return null;
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return null;
  }
}

// Run the complete test
createCompleteFileUploadTest();
