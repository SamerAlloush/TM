# 🧪 **Messaging API Test Script**

This guide helps you manually test the messaging API to debug issues.

## 📋 **Prerequisites**

1. **Backend server running** on `http://localhost:5000`
2. **Valid authentication token** (login first)
3. **Valid user IDs** for testing
4. **Valid conversation ID** (create conversation first)

---

## 🔐 **Step 1: Get Authentication Token**

### Login with cURL:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

### Expected Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "_id": "USER_ID_HERE",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "role": "Employee"
  }
}
```

**📝 Save the `token` and `_id` for next steps!**

---

## 👥 **Step 2: Get Available Users**

```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**📝 Pick another user's `_id` to message with!**

---

## 💬 **Step 3: Create or Get Conversation**

### Create Direct Conversation:
```bash
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "participantId": "OTHER_USER_ID_HERE",
    "type": "direct"
  }'
```

### Alternative Format (Array):
```bash
curl -X POST http://localhost:5000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "participants": ["OTHER_USER_ID_HERE"],
    "type": "direct"
  }'
```

### Expected Response:
```json
{
  "success": true,
  "data": {
    "_id": "CONVERSATION_ID_HERE",
    "participants": [...],
    "type": "direct",
    "lastActivity": "2024-01-15T10:30:00.000Z"
  }
}
```

**📝 Save the conversation `_id`!**

---

## 📨 **Step 4: Send Message (THE MAIN TEST)**

### Test Message:
```bash
curl -X POST http://localhost:5000/api/conversations/CONVERSATION_ID_HERE/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "content": "Hello! This is a test message from cURL.",
    "type": "text"
  }'
```

### Expected Success Response:
```json
{
  "success": true,
  "data": {
    "_id": "MESSAGE_ID_HERE",
    "conversation": "CONVERSATION_ID_HERE",
    "sender": {
      "_id": "YOUR_USER_ID",
      "firstName": "John",
      "lastName": "Doe",
      "email": "user@example.com"
    },
    "content": "Hello! This is a test message from cURL.",
    "type": "text",
    "status": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Message sent successfully"
}
```

---

## 🛠️ **Debugging Common Errors**

### ❌ **401 Unauthorized**
```json
{
  "success": false,
  "error": "Not authorized to access this route",
  "message": "Authentication token is required"
}
```
**Fix:** Check your token is valid and included in Authorization header.

### ❌ **403 Forbidden** 
```json
{
  "success": false,
  "message": "You are not a participant in this conversation",
  "error": "NOT_PARTICIPANT"
}
```
**Fix:** Ensure you're a participant in the conversation.

### ❌ **404 Not Found**
```json
{
  "success": false,
  "message": "Conversation not found",
  "error": "CONVERSATION_NOT_FOUND"
}
```
**Fix:** Check the conversation ID is correct.

### ❌ **400 Bad Request**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["Content is required"]
}
```
**Fix:** Check your request payload format.

---

## 🔍 **Advanced Debugging**

### Test Debug Endpoint:
```bash
curl -X POST http://localhost:5000/api/conversations/debug \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "test": "data",
    "content": "Debug test message"
  }'
```

### Get Messages in Conversation:
```bash
curl -X GET http://localhost:5000/api/conversations/CONVERSATION_ID_HERE/messages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Health Check:
```bash
curl -X GET http://localhost:5000/health
```

---

## 📱 **Postman Collection**

### **Collection Variables:**
- `baseUrl`: `http://localhost:5000`
- `token`: `{{LOGIN_TOKEN_HERE}}`
- `conversationId`: `{{CONVERSATION_ID_HERE}}`

### **Request Examples:**

1. **Login** - `POST {{baseUrl}}/api/auth/login`
2. **Get Users** - `GET {{baseUrl}}/api/users` (Auth: Bearer {{token}})
3. **Create Conversation** - `POST {{baseUrl}}/api/conversations` (Auth: Bearer {{token}})
4. **Send Message** - `POST {{baseUrl}}/api/conversations/{{conversationId}}/messages` (Auth: Bearer {{token}})

---

## 🎯 **Expected Payload Shapes**

### **Send Message Payload:**
```json
{
  "content": "Your message here",      // Required: string, 1-5000 chars
  "type": "text",                     // Optional: text|image|video|document|audio|contact|location|system
  "replyTo": "MESSAGE_ID"             // Optional: MongoDB ObjectId
}
```

### **Create Conversation Payload:**
```json
{
  "participantId": "USER_ID",         // Option 1: Single participant ID
  "participants": ["USER_ID_1"],      // Option 2: Array of participant IDs
  "type": "direct",                   // Optional: direct|group (default: direct)
  "name": "Chat Name"                 // Optional: For group chats
}
```

---

## 🚀 **Quick Test Commands**

Replace placeholders with your actual values:

```bash
# Get your token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r '.token')

# Get available users
curl -s -X GET http://localhost:5000/api/users -H "Authorization: Bearer $TOKEN" | jq '.data[] | {_id, firstName, lastName, email}'

# Create conversation (replace OTHER_USER_ID)
CONV_ID=$(curl -s -X POST http://localhost:5000/api/conversations -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"participantId":"OTHER_USER_ID","type":"direct"}' | jq -r '.data._id')

# Send message
curl -X POST http://localhost:5000/api/conversations/$CONV_ID/messages -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"content":"Test message from script!","type":"text"}'
```

---

## ✅ **Validation Checklist**

- [ ] Backend server is running on port 5000
- [ ] Authentication token is valid and not expired
- [ ] Content-Type header is set to `application/json`
- [ ] Authorization header includes `Bearer ` prefix
- [ ] Conversation ID is a valid MongoDB ObjectId (24 hex characters)
- [ ] Message content is not empty and under 5000 characters
- [ ] User is a participant in the conversation
- [ ] Network connectivity is working (test with `/health` endpoint) 