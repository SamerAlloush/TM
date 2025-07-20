// Create a temporary test route to bypass auth and test multer directly
const express = require('express');
const app = express();

// Simple test server to debug multer
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer with disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('🔍 Multer destination callback called');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log('🔍 Multer filename callback called:', file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

console.log('📁 Multer configured with disk storage');

// Test route
app.post('/test-upload', upload.array('files', 5), (req, res) => {
  console.log('🔍 ===== MULTER TEST =====');
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('Files count:', req.files ? req.files.length : 0);
  
  if (req.files && req.files.length > 0) {
    req.files.forEach((file, index) => {
      console.log(`File ${index + 1}:`, {
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      });
      
      // Check if file exists on disk
      const exists = fs.existsSync(file.path);
      console.log(`File exists on disk: ${exists}`);
    });
  }
  
  res.json({
    success: true,
    files: req.files || [],
    body: req.body
  });
});

const port = 3003;
app.listen(port, () => {
  console.log(`🚀 Multer test server running on port ${port}`);
});

// Test function to use this server
async function testMulterDirectly() {
  console.log('Testing multer directly...');
  
  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const FormData = require('form-data');
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  // Create test file
  const testFilePath = path.join(__dirname, 'test-file.txt');
  fs.writeFileSync(testFilePath, 'This is a test file');
  
  // Create FormData
  const formData = new FormData();
  formData.append('content', 'Test message');
  formData.append('files', fs.createReadStream(testFilePath), {
    filename: 'test-file.txt',
    contentType: 'text/plain'
  });
  
  try {
    const response = await fetch(`http://localhost:${port}/test-upload`, {
      method: 'POST',
      body: formData
    });
    
    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response:', result);
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  process.exit(0);
}

// Run test after server starts
setTimeout(testMulterDirectly, 2000);
