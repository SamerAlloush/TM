#!/bin/bash

# Email Testing Script with curl commands
# Based on the External Email Sending Test Guide

BASE_URL="http://localhost:5000"
JWT_TOKEN="${1:-}"
TEST_EMAIL="${2:-test@example.com}"

echo "🧪 Email System curl Test Suite"
echo "==============================="
echo ""

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ No JWT token provided"
    echo "Usage: $0 <JWT_TOKEN> [TEST_EMAIL]"
    echo "Example: $0 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... your-email@gmail.com"
    echo ""
    echo "Running unauthenticated tests only..."
    echo ""
fi

echo "🎯 Testing endpoint: $BASE_URL"
echo "📧 Test email: $TEST_EMAIL"
echo ""

# Test 1: Server Health Check
echo "1️⃣ Testing server health..."
curl -s -X GET "$BASE_URL/api/health" \
  -H "Content-Type: application/json" | \
  python3 -m json.tool 2>/dev/null || echo "Server not responding or not JSON"
echo ""

# Test 2: Gmail SMTP Test (No auth required)
echo "2️⃣ Testing Gmail SMTP configuration..."
curl -s -X POST "$BASE_URL/api/mail/test-gmail-smtp" \
  -H "Content-Type: application/json" | \
  python3 -m json.tool 2>/dev/null || echo "Failed to get response"
echo ""

# Test 3: Email System Diagnostic (No auth required)
echo "3️⃣ Testing email system diagnostic..."
curl -s -X POST "$BASE_URL/api/mail/test-system" \
  -H "Content-Type: application/json" \
  -d "{\"testEmail\": \"$TEST_EMAIL\"}" | \
  python3 -m json.tool 2>/dev/null || echo "Failed to get response"
echo ""

if [ -n "$JWT_TOKEN" ]; then
    echo "🔐 Running authenticated tests..."
    echo ""

    # Test 4: Basic Text Email
    echo "4️⃣ Testing basic text email..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": \"$TEST_EMAIL\",
        \"subject\": \"curl Test - Basic Text\",
        \"body\": \"This is a basic text email sent via curl test.\",
        \"type\": \"notification\"
      }" | python3 -m json.tool 2>/dev/null || echo "Failed to send email"
    echo ""

    # Test 5: HTML Email
    echo "5️⃣ Testing HTML email..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": \"$TEST_EMAIL\",
        \"subject\": \"curl Test - HTML Format\",
        \"body\": \"<h1>HTML Test Email</h1><p>This is an <strong>HTML</strong> email with <em>formatting</em>.</p><ul><li>Test item 1</li><li>Test item 2</li></ul>\",
        \"type\": \"notification\"
      }" | python3 -m json.tool 2>/dev/null || echo "Failed to send HTML email"
    echo ""

    # Test 6: Special Characters
    echo "6️⃣ Testing special characters..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": \"$TEST_EMAIL\",
        \"subject\": \"curl Test - Special Characters: éñ中文🚀\",
        \"body\": \"Testing special characters: éñ中文🚀\\nEmojis: 🎉 ✅ 🔥 💡\\nAccents: áéíóú àèìòù âêîôû\",
        \"type\": \"notification\"
      }" | python3 -m json.tool 2>/dev/null || echo "Failed to send special characters email"
    echo ""

    # Test 7: Invalid Email Format
    echo "7️⃣ Testing invalid email format (should fail)..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": \"invalid-email-format\",
        \"subject\": \"curl Test - Invalid Email\",
        \"body\": \"This should fail validation\"
      }" | python3 -m json.tool 2>/dev/null || echo "Request failed as expected"
    echo ""

    # Test 8: Missing Required Fields
    echo "8️⃣ Testing missing required fields (should fail)..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": \"$TEST_EMAIL\"
      }" | python3 -m json.tool 2>/dev/null || echo "Request failed as expected"
    echo ""

    # Test 9: Multiple Recipients
    echo "9️⃣ Testing multiple recipients..."
    curl -s -X POST "$BASE_URL/api/mail/send" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "{
        \"to\": [\"$TEST_EMAIL\", \"test2@example.com\"],
        \"subject\": \"curl Test - Multiple Recipients\",
        \"body\": \"This email is sent to multiple recipients via curl test.\"
      }" | python3 -m json.tool 2>/dev/null || echo "Multiple recipients not supported or failed"
    echo ""

else
    echo "⚠️ Skipping authenticated tests (no JWT token provided)"
    echo ""
fi

# Test 10: Unauthenticated Request (should fail)
echo "🔒 Testing unauthenticated request (should fail)..."
curl -s -X POST "$BASE_URL/api/mail/send" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Unauthorized Test\",
    \"body\": \"This should fail\"
  }" | python3 -m json.tool 2>/dev/null || echo "Request failed as expected"
echo ""

# Test 11: Invalid Token (should fail)
echo "🔑 Testing invalid token (should fail)..."
curl -s -X POST "$BASE_URL/api/mail/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-12345" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Invalid Token Test\",
    \"body\": \"This should fail\"
  }" | python3 -m json.tool 2>/dev/null || echo "Request failed as expected"
echo ""

echo "✅ curl Test Suite Complete!"
echo ""
echo "💡 Next Steps:"
echo "   - Check your email inbox ($TEST_EMAIL) for test messages"
echo "   - Review server logs for any errors"
echo "   - Run comprehensive test: node test-email-comprehensive.js"
echo "   - Test from React Native app UI" 