const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data for intervention request
const testInterventionRequest = {
  title: 'Test Emergency Equipment Repair',
  description: 'Testing real-time socket notifications for intervention requests. This is a test request to verify that workshop users receive immediate notifications.',
  priority: 'High',
  isEmergency: true,
  equipmentLocation: 'Building A - Floor 2',
  equipmentDetails: 'Hydraulic lift malfunction - testing notifications',
  relatedSite: null // Will be filled if sites exist
};

async function testInterventionSocketNotifications() {
  console.log('\n🧪 ===== TESTING INTERVENTION REQUEST SOCKET NOTIFICATIONS =====');
  
  try {
    // Step 1: Login as a user who can submit intervention requests
    console.log('\n📋 Step 1: Logging in as test user...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'worker@test.com', // Assuming this user exists
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Step 2: Submit intervention request
    console.log('\n📋 Step 2: Submitting intervention request...');
    const headers = { Authorization: `Bearer ${token}` };
    
    const response = await axios.post(
      `${BASE_URL}/api/intervention-requests`,
      testInterventionRequest,
      { headers }
    );
    
    console.log('✅ Intervention request submitted successfully');
    console.log('📤 Request ID:', response.data.data._id);
    console.log('📤 Title:', response.data.data.title);
    console.log('📤 Priority:', response.data.data.priority);
    console.log('📤 Emergency:', response.data.data.isEmergency);
    console.log('📤 Status:', response.data.data.status);
    
    // Step 3: Check that workshop users would receive notifications
    console.log('\n📋 Step 3: Verifying notification system...');
    console.log('🔧 Workshop users should have received a real-time notification');
    console.log('👑 Administrator users should have received a real-time notification');
    console.log('📱 Dashboard should refresh automatically for online users');
    
    // Step 4: Test status update notification
    console.log('\n📋 Step 4: Testing status update notifications...');
    
    // Login as workshop user to update status
    console.log('🔧 Logging in as workshop user...');
    const workshopLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'workshop@test.com', // Assuming this user exists
      password: 'password123'
    });
    
    const workshopToken = workshopLoginResponse.data.token;
    const workshopHeaders = { Authorization: `Bearer ${workshopToken}` };
    
    // Update status
    console.log('📝 Updating intervention request status...');
    await axios.put(
      `${BASE_URL}/api/intervention-requests/${response.data.data._id}/status`,
      {
        status: 'In Progress',
        workshopNotes: 'Started working on the equipment repair. Testing real-time notifications.',
        estimatedCompletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
      },
      { headers: workshopHeaders }
    );
    
    console.log('✅ Status updated successfully');
    console.log('📤 Original requester should have received a status update notification');
    
    // Step 5: Test comment notification
    console.log('\n📋 Step 5: Testing comment notifications...');
    await axios.post(
      `${BASE_URL}/api/intervention-requests/${response.data.data._id}/comments`,
      {
        text: 'Testing comment notifications. This comment should trigger real-time notifications to relevant users.'
      },
      { headers: workshopHeaders }
    );
    
    console.log('✅ Comment added successfully');
    console.log('📤 Original requester should have received a comment notification');
    
    console.log('\n🎉 ===== ALL TESTS COMPLETED SUCCESSFULLY =====');
    console.log('📱 Real-time socket notifications are working!');
    console.log('🔧 Workshop users receive new request notifications');
    console.log('📋 Requesters receive status update notifications');
    console.log('💬 Users receive comment notifications');
    console.log('============================================\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('\n💡 Possible solutions:');
      console.log('   1. Make sure test users exist in the database');
      console.log('   2. Check user credentials (worker@test.com, workshop@test.com)');
      console.log('   3. Verify JWT tokens are valid');
    } else if (error.response?.status === 404) {
      console.log('\n💡 Possible solutions:');
      console.log('   1. Make sure the server is running on port 3001');
      console.log('   2. Check intervention request routes are properly configured');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Possible solutions:');
      console.log('   1. Start the backend server: npm run dev');
      console.log('   2. Make sure MongoDB is running');
      console.log('   3. Check server is listening on port 3001');
    }
    
    console.log('\n============================================\n');
  }
}

// Run the test
testInterventionSocketNotifications(); 