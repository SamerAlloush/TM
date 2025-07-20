#!/usr/bin/env node

const axios = require('axios');
const { io } = require('socket.io-client');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_CONFIG = {
  user1: { email: 'user1@example.com', password: 'password123' },
  user2: { email: 'user2@example.com', password: 'password123' }
};

class ParticipantValidationTester {
  constructor() {
    this.user1Token = null;
    this.user1Id = null;
    this.user2Token = null;
    this.user2Id = null;
    this.conversationId = null;
    this.socketUser1 = null;
    this.socketUser2 = null;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = {
      error: '❌',
      success: '✅',
      warning: '⚠️',
      info: '🔍'
    }[level] || '🔍';
    console.log(`${emoji} [${timestamp}] ${message}`);
  }

  async makeRequest(method, url, data = null, token = null) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${url}`,
        headers: { 'Content-Type': 'application/json' }
      };

      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (data) config.data = data;

      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  async login(email, password) {
    this.log(`Logging in ${email}...`);
    const result = await this.makeRequest('POST', '/api/auth/login', { email, password });
    
    if (result.success) {
      this.log(`✅ Login successful: ${email}`, 'success');
      return { token: result.data.token, userId: result.data.data._id, user: result.data.data };
    } else {
      this.log(`❌ Login failed: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async testConversationCreation() {
    this.log('\n🧪 Testing Conversation Creation and Participant Validation...');
    
    // 1. Login both users
    const user1Login = await this.login(TEST_CONFIG.user1.email, TEST_CONFIG.user1.password);
    if (!user1Login) return false;
    this.user1Token = user1Login.token;
    this.user1Id = user1Login.userId;

    const user2Login = await this.login(TEST_CONFIG.user2.email, TEST_CONFIG.user2.password);
    if (!user2Login) return false;
    this.user2Token = user2Login.token;
    this.user2Id = user2Login.userId;

    this.log(`User 1 ID: ${this.user1Id}`);
    this.log(`User 2 ID: ${this.user2Id}`);

    // 2. Create conversation (User 1 creates with User 2)
    this.log('\n📞 Creating conversation...');
    const convResult = await this.makeRequest('POST', '/api/conversations', {
      participantId: this.user2Id,
      type: 'direct'
    }, this.user1Token);

    if (!convResult.success) {
      this.log(`❌ Conversation creation failed: ${JSON.stringify(convResult.error)}`, 'error');
      return false;
    }

    this.conversationId = convResult.data.data._id;
    this.log(`✅ Conversation created: ${this.conversationId}`, 'success');
    this.log(`Participants: ${JSON.stringify(convResult.data.data.participants.map(p => ({ id: p._id, name: `${p.firstName} ${p.lastName}` })))}`);

    return true;
  }

  async testMessageSending() {
    this.log('\n📨 Testing Message Sending...');
    
    // Test User 1 sending message
    this.log('User 1 sending message...');
    const msg1Result = await this.makeRequest('POST', `/api/conversations/${this.conversationId}/messages`, {
      content: 'Test message from User 1',
      type: 'text'
    }, this.user1Token);

    if (msg1Result.success) {
      this.log('✅ User 1 message sent successfully!', 'success');
    } else {
      this.log(`❌ User 1 message failed: ${JSON.stringify(msg1Result.error, null, 2)}`, 'error');
      this.log(`Status: ${msg1Result.status}`);
      
      if (msg1Result.error.debug) {
        this.log('Debug info:', 'warning');
        console.log(JSON.stringify(msg1Result.error.debug, null, 2));
      }
    }

    // Test User 2 sending message
    this.log('\nUser 2 sending message...');
    const msg2Result = await this.makeRequest('POST', `/api/conversations/${this.conversationId}/messages`, {
      content: 'Test reply from User 2',
      type: 'text'
    }, this.user2Token);

    if (msg2Result.success) {
      this.log('✅ User 2 message sent successfully!', 'success');
    } else {
      this.log(`❌ User 2 message failed: ${JSON.stringify(msg2Result.error, null, 2)}`, 'error');
      this.log(`Status: ${msg2Result.status}`);
      
      if (msg2Result.error.debug) {
        this.log('Debug info:', 'warning');
        console.log(JSON.stringify(msg2Result.error.debug, null, 2));
      }
    }

    return msg1Result.success && msg2Result.success;
  }

  async testSocketConnections() {
    this.log('\n🔌 Testing Socket.IO Connections...');
    
    return new Promise((resolve) => {
      let user1Connected = false;
      let user2Connected = false;
      let connectionTimer;

      const checkComplete = () => {
        if (user1Connected && user2Connected) {
          clearTimeout(connectionTimer);
          this.log('✅ Both users connected to Socket.IO!', 'success');
          resolve(true);
        }
      };

      // User 1 Socket
      this.socketUser1 = io(BASE_URL, {
        auth: { token: this.user1Token },
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.socketUser1.on('connect', () => {
        this.log('✅ User 1 socket connected', 'success');
        user1Connected = true;
        checkComplete();
      });

      this.socketUser1.on('connect_error', (error) => {
        this.log(`❌ User 1 socket connection error: ${error.message}`, 'error');
      });

      this.socketUser1.on('disconnect', (reason) => {
        this.log(`⚠️ User 1 socket disconnected: ${reason}`, 'warning');
      });

      // User 2 Socket
      this.socketUser2 = io(BASE_URL, {
        auth: { token: this.user2Token },
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.socketUser2.on('connect', () => {
        this.log('✅ User 2 socket connected', 'success');
        user2Connected = true;
        checkComplete();
      });

      this.socketUser2.on('connect_error', (error) => {
        this.log(`❌ User 2 socket connection error: ${error.message}`, 'error');
      });

      this.socketUser2.on('disconnect', (reason) => {
        this.log(`⚠️ User 2 socket disconnected: ${reason}`, 'warning');
      });

      // Timeout after 15 seconds
      connectionTimer = setTimeout(() => {
        this.log('⏰ Socket connection timeout', 'warning');
        resolve(user1Connected || user2Connected);
      }, 15000);
    });
  }

  async testSocketMessaging() {
    if (!this.socketUser1 || !this.socketUser2) {
      this.log('❌ Sockets not connected, skipping socket messaging test', 'error');
      return false;
    }

    this.log('\n💬 Testing Socket.IO Messaging...');

    return new Promise((resolve) => {
      let messageReceived = false;

      // Set up message listener on User 2
      this.socketUser2.on('message:new', (data) => {
        this.log('✅ User 2 received message via socket!', 'success');
        this.log(`Message: ${data.message.content}`);
        messageReceived = true;
        resolve(true);
      });

      // User 1 sends message via socket
      this.socketUser1.emit('message:send', {
        conversationId: this.conversationId,
        content: 'Socket test message from User 1',
        type: 'text'
      });

      this.log('📤 User 1 sent message via socket...');

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!messageReceived) {
          this.log('⏰ Socket message timeout - no message received', 'warning');
          resolve(false);
        }
      }, 10000);
    });
  }

  cleanup() {
    if (this.socketUser1) {
      this.socketUser1.disconnect();
      this.log('🔌 User 1 socket disconnected');
    }
    if (this.socketUser2) {
      this.socketUser2.disconnect();
      this.log('🔌 User 2 socket disconnected');
    }
  }

  async runFullTest() {
    console.log('\n🧪 PARTICIPANT VALIDATION & SOCKET.IO TEST');
    console.log('=' .repeat(60));
    console.log('\nThis test will:');
    console.log('1. Login two users');
    console.log('2. Create a conversation between them');
    console.log('3. Test HTTP message sending (where 403 error occurs)');
    console.log('4. Test Socket.IO connections');
    console.log('5. Test Socket.IO messaging\n');

    try {
      // Test 1: Conversation Creation
      const convSuccess = await this.testConversationCreation();
      if (!convSuccess) {
        this.log('❌ Conversation creation failed, stopping test', 'error');
        return false;
      }

      // Test 2: HTTP Message Sending
      const msgSuccess = await this.testMessageSending();
      
      // Test 3: Socket Connections
      const socketSuccess = await this.testSocketConnections();
      
      // Test 4: Socket Messaging
      let socketMsgSuccess = false;
      if (socketSuccess) {
        socketMsgSuccess = await this.testSocketMessaging();
      }

      // Summary
      console.log('\n📊 TEST RESULTS SUMMARY');
      console.log('=' .repeat(40));
      console.log(`Conversation Creation: ${convSuccess ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`HTTP Message Sending: ${msgSuccess ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Socket.IO Connection: ${socketSuccess ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Socket.IO Messaging: ${socketMsgSuccess ? '✅ PASS' : '❌ FAIL'}`);

      if (!msgSuccess) {
        console.log('\n🔍 TROUBLESHOOTING TIPS:');
        console.log('- Check backend logs for participant validation debugging');
        console.log('- Verify user IDs are properly formatted (ObjectId vs string)');
        console.log('- Ensure conversation participants array includes both users');
        console.log('- Check authentication token is valid');
      }

      if (!socketSuccess) {
        console.log('\n🔌 SOCKET.IO TROUBLESHOOTING:');
        console.log('- Check authentication token format');
        console.log('- Verify backend Socket.IO server is running');
        console.log('- Check network connectivity and firewall settings');
        console.log('- Review backend socket authentication logs');
      }

      return msgSuccess && socketSuccess;

    } catch (error) {
      this.log(`💥 Test failed with error: ${error.message}`, 'error');
      return false;
    } finally {
      this.cleanup();
    }
  }
}

// Run the test
async function main() {
  const tester = new ParticipantValidationTester();
  
  console.log('🔧 Prerequisites:');
  console.log('1. Backend server running on http://localhost:5000');
  console.log('2. User accounts with credentials in TEST_CONFIG');
  console.log('3. MongoDB connected\n');

  const success = await tester.runFullTest();
  
  if (success) {
    console.log('\n🎉 ALL TESTS PASSED! Your messaging system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Check the logs above and backend console for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ParticipantValidationTester; 