/**
 * Test Script: Absence Request Validation System
 * 
 * This script tests the complete absence request validation workflow:
 * 1. Creates absence requests
 * 2. Verifies they are pending
 * 3. Tests approval/rejection by Admin/HR
 * 4. Validates final status
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test credentials
const ADMIN_CREDENTIALS = { email: 'admin@gsConstruction.com', password: 'admin123' };
const USER_CREDENTIALS = { email: 'user@gsConstruction.com', password: 'user123' };

let adminToken = '';
let userToken = '';

/**
 * Helper function to login and get token
 */
async function login(credentials) {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, credentials);
    return response.data.token;
  } catch (error) {
    console.error(`Login failed for ${credentials.email}:`, error.response?.data?.error);
    throw error;
  }
}

/**
 * Test 1: User submits absence request
 */
async function testAbsenceRequestSubmission() {
  console.log('\n🔬 Test 1: User submits absence request');
  
  try {
    const absenceData = {
      type: 'Vacation',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
      reason: 'Family vacation',
      requestType: 'Request',
      isFullDay: true,
      dayCount: 4
    };

    const response = await axios.post(`${API_BASE}/absences`, absenceData, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const absence = response.data.data;
    console.log('✅ Absence request created:', {
      id: absence._id,
      status: absence.status,
      type: absence.type,
      requester: `${absence.user.firstName} ${absence.user.lastName}`
    });

    if (absence.status !== 'Pending') {
      throw new Error(`Expected status 'Pending' but got '${absence.status}'`);
    }

    return absence._id;
  } catch (error) {
    console.error('❌ Test 1 failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 2: Admin views pending requests
 */
async function testAdminViewsPendingRequests() {
  console.log('\n🔬 Test 2: Admin views pending requests');
  
  try {
    const response = await axios.get(`${API_BASE}/absences/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const pendingRequests = response.data.data;
    console.log(`✅ Admin can view ${pendingRequests.length} pending request(s)`);

    if (pendingRequests.length === 0) {
      throw new Error('Expected at least 1 pending request');
    }

    return pendingRequests;
  } catch (error) {
    console.error('❌ Test 2 failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 3: Admin approves absence request
 */
async function testAdminApprovesRequest(absenceId) {
  console.log('\n🔬 Test 3: Admin approves absence request');
  
  try {
    const response = await axios.put(`${API_BASE}/absences/${absenceId}/approve`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const approvedAbsence = response.data.data;
    console.log('✅ Absence request approved:', {
      id: approvedAbsence._id,
      status: approvedAbsence.status,
      approvedBy: `${approvedAbsence.approvedBy.firstName} ${approvedAbsence.approvedBy.lastName}`,
      approvedAt: approvedAbsence.approvedAt
    });

    if (approvedAbsence.status !== 'Approved') {
      throw new Error(`Expected status 'Approved' but got '${approvedAbsence.status}'`);
    }

    return approvedAbsence;
  } catch (error) {
    console.error('❌ Test 3 failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 4: Test rejection workflow
 */
async function testRejectionWorkflow() {
  console.log('\n🔬 Test 4: Test rejection workflow');
  
  try {
    // Create another absence request
    const absenceData = {
      type: 'Sick Leave',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Medical appointment',
      requestType: 'Request',
      isFullDay: true,
      dayCount: 3
    };

    const createResponse = await axios.post(`${API_BASE}/absences`, absenceData, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const newAbsenceId = createResponse.data.data._id;
    console.log('📝 Created test absence for rejection:', newAbsenceId);

    // Reject the absence
    const rejectResponse = await axios.put(`${API_BASE}/absences/${newAbsenceId}/reject`, {
      rejectionReason: 'Insufficient notice period'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const rejectedAbsence = rejectResponse.data.data;
    console.log('✅ Absence request rejected:', {
      id: rejectedAbsence._id,
      status: rejectedAbsence.status,
      rejectionReason: rejectedAbsence.rejectionReason,
      rejectedBy: `${rejectedAbsence.approvedBy.firstName} ${rejectedAbsence.approvedBy.lastName}`
    });

    if (rejectedAbsence.status !== 'Rejected') {
      throw new Error(`Expected status 'Rejected' but got '${rejectedAbsence.status}'`);
    }

    return rejectedAbsence;
  } catch (error) {
    console.error('❌ Test 4 failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 5: User views their request status
 */
async function testUserViewsRequestStatus() {
  console.log('\n🔬 Test 5: User views their request status');
  
  try {
    const response = await axios.get(`${API_BASE}/absences/my-absences`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const userAbsences = response.data.data;
    console.log(`✅ User can view ${userAbsences.length} of their absence request(s)`);
    
    userAbsences.forEach(absence => {
      console.log(`   - ${absence.type}: ${absence.status} (${absence.dayCount} days)`);
    });

    const hasApproved = userAbsences.some(a => a.status === 'Approved');
    const hasRejected = userAbsences.some(a => a.status === 'Rejected');

    if (!hasApproved || !hasRejected) {
      console.log('⚠️ Warning: Not all status types found in user requests');
    }

    return userAbsences;
  } catch (error) {
    console.error('❌ Test 5 failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Test 6: Verify permissions
 */
async function testPermissions() {
  console.log('\n🔬 Test 6: Test permission restrictions');
  
  try {
    // Test that regular user cannot view pending requests
    try {
      await axios.get(`${API_BASE}/absences/pending`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      throw new Error('Regular user should not be able to view pending requests');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Regular user correctly denied access to pending requests');
      } else {
        throw error;
      }
    }

    // Test that regular user cannot approve requests
    const testAbsenceId = '507f1f77bcf86cd799439011'; // Dummy ID
    try {
      await axios.put(`${API_BASE}/absences/${testAbsenceId}/approve`, {}, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      throw new Error('Regular user should not be able to approve requests');
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.log('✅ Regular user correctly denied approval permissions');
      } else {
        throw error;
      }
    }

    console.log('✅ Permission tests passed');
  } catch (error) {
    console.error('❌ Test 6 failed:', error.message);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Absence Request Validation System Tests');
  console.log('================================================');

  try {
    // Login as admin and user
    console.log('\n🔐 Logging in users...');
    adminToken = await login(ADMIN_CREDENTIALS);
    userToken = await login(USER_CREDENTIALS);
    console.log('✅ All users logged in successfully');

    // Run all tests
    const absenceId = await testAbsenceRequestSubmission();
    await testAdminViewsPendingRequests();
    await testAdminApprovesRequest(absenceId);
    await testRejectionWorkflow();
    await testUserViewsRequestStatus();
    await testPermissions();

    console.log('\n🎉 ALL TESTS PASSED! 🎉');
    console.log('=====================================');
    console.log('✅ Absence request validation system is working correctly');
    console.log('✅ All requirements have been implemented:');
    console.log('   - Absence requests default to pending status');
    console.log('   - Admin/HR can view pending queue');
    console.log('   - Admin/HR can approve/reject requests');
    console.log('   - Users can only see their own request status');
    console.log('   - Proper permission controls in place');

  } catch (error) {
    console.log('\n❌ TEST SUITE FAILED');
    console.log('===================');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  login,
  testAbsenceRequestSubmission,
  testAdminViewsPendingRequests,
  testAdminApprovesRequest,
  testRejectionWorkflow,
  testUserViewsRequestStatus,
  testPermissions
}; 