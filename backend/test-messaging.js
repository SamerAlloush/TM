#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_CONFIG = {
  // Replace these with real user credentials for testing
  user1: {
    email: 'user1@example.com',
    password: 'password123'
  },
  user2: {
    email: 'user2@example.com', 
    password: 'password123'
  }
};

class MessageTester {
  constructor() {
    this.user1Token = null;
    this.user1Id = null;
    this.user2Token = null;
    this.user2Id = null;
    this.conversationId = null;
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = level === 'error' ? '❌' : level === 'success' ? '✅' : '🔍';
    console.log(`${emoji} [${timestamp}] ${message}`);
  }

  async makeRequest(method, url, data = null, token = null) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${url}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (data) {
        config.data = data;
      }

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
    await this.log(`Attempting login for ${email}...`);
    
    const result = await this.makeRequest('POST', '/api/auth/login', {
      email,
      password
    });

    if (result.success) {
      await this.log(`Login successful for ${email}`, 'success');
      return {
        token: result.data.token,
        userId: result.data.data._id,
        user: result.data.data
      };
    } else {
      await this.log(`Login failed for ${email}: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async getUsers(token) {
    await this.log('Fetching available users...');
    
    const result = await this.makeRequest('GET', '/api/users', null, token);
    
    if (result.success) {
      await this.log(`Found ${result.data.data?.length || 0} users`, 'success');
      return result.data.data;
    } else {
      await this.log(`Failed to fetch users: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async createConversation(token, participantId) {
    await this.log(`Creating conversation with participant ${participantId}...`);
    
    const result = await this.makeRequest('POST', '/api/conversations', {
      participantId,
      type: 'direct'
    }, token);

    if (result.success) {
      await this.log(`Conversation created: ${result.data.data._id}`, 'success');
      return result.data.data._id;
    } else {
      await this.log(`Failed to create conversation: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async sendMessage(token, conversationId, content) {
    await this.log(`Sending message: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
    
    const result = await this.makeRequest('POST', `/api/conversations/${conversationId}/messages`, {
      content,
      type: 'text'
    }, token);

    if (result.success) {
      await this.log(`Message sent successfully: ${result.data.data._id}`, 'success');
      return result.data.data;
    } else {
      await this.log(`Failed to send message: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async getMessages(token, conversationId) {
    await this.log(`Fetching messages from conversation ${conversationId}...`);
    
    const result = await this.makeRequest('GET', `/api/conversations/${conversationId}/messages`, null, token);

    if (result.success) {
      await this.log(`Found ${result.data.data?.length || 0} messages`, 'success');
      return result.data.data;
    } else {
      await this.log(`Failed to fetch messages: ${JSON.stringify(result.error)}`, 'error');
      return null;
    }
  }

  async runFullTest() {
    console.log('\n🚀 Starting Messaging API Test\n');
    console.log('=' .repeat(50));

    try {
      // 1. Login both users
      const user1Login = await this.login(TEST_CONFIG.user1.email, TEST_CONFIG.user1.password);
      if (!user1Login) {
        await this.log('Cannot proceed without User 1 login', 'error');
        return false;
      }
      this.user1Token = user1Login.token;
      this.user1Id = user1Login.userId;

      const user2Login = await this.login(TEST_CONFIG.user2.email, TEST_CONFIG.user2.password);
      if (!user2Login) {
        await this.log('Cannot proceed without User 2 login', 'error');
        return false;
      }
      this.user2Token = user2Login.token;
      this.user2Id = user2Login.userId;

      // 2. Create conversation
      this.conversationId = await this.createConversation(this.user1Token, this.user2Id);
      if (!this.conversationId) {
        await this.log('Cannot proceed without conversation', 'error');
        return false;
      }

      // 3. Send messages
      const message1 = await this.sendMessage(
        this.user1Token, 
        this.conversationId, 
        'Hello from User 1! This is a test message.'
      );

      const message2 = await this.sendMessage(
        this.user2Token, 
        this.conversationId, 
        'Hi back from User 2! The messaging system is working! 🎉'
      );

      // 4. Fetch messages
      const messages = await this.getMessages(this.user1Token, this.conversationId);

      if (message1 && message2 && messages) {
        console.log('\n🎉 TEST COMPLETED SUCCESSFULLY! 🎉');
        console.log('\nMessages in conversation:');
        messages.forEach((msg, index) => {
          console.log(`  ${index + 1}. [${msg.sender.firstName}]: ${msg.content}`);
        });
        return true;
      } else {
        await this.log('Test completed with some failures', 'error');
        return false;
      }

    } catch (error) {
      await this.log(`Test failed with error: ${error.message}`, 'error');
      return false;
    }
  }

  async testHealthCheck() {
    await this.log('Testing backend health...');
    
    const result = await this.makeRequest('GET', '/health');
    
    if (result.success) {
      await this.log('Backend is healthy', 'success');
      return true;
    } else {
      await this.log('Backend health check failed', 'error');
      return false;
    }
  }
}

// Main execution
async function main() {
  const tester = new MessageTester();

  console.log('🧪 Messaging API Test Script');
  console.log('============================');
  console.log('\nBefore running this test, make sure:');
  console.log('1. Backend server is running on http://localhost:5000');
  console.log('2. You have valid user accounts with the credentials in TEST_CONFIG');
  console.log('3. MongoDB is connected and running\n');

  // Test health first
  const isHealthy = await tester.testHealthCheck();
  if (!isHealthy) {
    console.log('\n❌ Backend is not responding. Please start the server first.');
    process.exit(1);
  }

  // Run full test
  const success = await tester.runFullTest();
  
  if (success) {
    console.log('\n✅ All tests passed! Your messaging system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Check the logs above for details.');
    console.log('\nCommon fixes:');
    console.log('- Ensure user credentials in TEST_CONFIG are correct');
    console.log('- Check if users exist in the database');
    console.log('- Verify authentication tokens are valid');
    console.log('- Make sure conversations can be created between users');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MessageTester; 