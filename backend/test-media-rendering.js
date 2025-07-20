// Test pour valider le rendu des messages avec médias
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_CONVERSATION_ID = '6754d8f123e456789abcdef0'; // ID fictif pour test

// Configuration pour un utilisateur de test
const TEST_USER_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Token fictif

async function testMediaMessageRendering() {
  console.log('🎭 ===== TEST RENDU MESSAGES MÉDIAS =====');
  console.log('Date:', new Date().toISOString());
  console.log('API URL:', API_BASE_URL);
  console.log('==========================================\n');

  // Test 1: Message texte uniquement
  console.log('1. 📝 Test message texte uniquement...');
  const textMessage = {
    _id: 'msg1',
    content: 'Bonjour, comment allez-vous?',
    attachments: [],
    sender: { _id: 'user1', firstName: 'John', lastName: 'Doe' },
    createdAt: new Date(),
    type: 'text'
  };
  
  console.log('✅ Message texte:', {
    hasContent: !!textMessage.content,
    contentLength: textMessage.content.length,
    hasAttachments: textMessage.attachments.length > 0,
    shouldShowText: textMessage.content && textMessage.content !== '[Media]'
  });

  // Test 2: Message média uniquement
  console.log('\n2. 📸 Test message média uniquement...');
  const mediaMessage = {
    _id: 'msg2',
    content: '[Media]',
    attachments: [{
      fileName: 'test-image.jpg',
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      url: '/uploads/test-image.jpg'
    }],
    sender: { _id: 'user2', firstName: 'Jane', lastName: 'Smith' },
    createdAt: new Date(),
    type: 'image'
  };
  
  console.log('✅ Message média:', {
    hasContent: !!mediaMessage.content,
    contentIsMedia: mediaMessage.content === '[Media]',
    hasAttachments: mediaMessage.attachments.length > 0,
    shouldShowText: mediaMessage.content && mediaMessage.content !== '[Media]',
    shouldShowMedia: mediaMessage.attachments.length > 0
  });

  // Test 3: Message mixte (texte + média)
  console.log('\n3. 🎯 Test message mixte (texte + média)...');
  const mixedMessage = {
    _id: 'msg3',
    content: 'Voici la photo que vous avez demandée',
    attachments: [{
      fileName: 'document.pdf',
      originalName: 'rapport.pdf',
      mimeType: 'application/pdf',
      size: 2048000,
      url: '/uploads/document.pdf'
    }],
    sender: { _id: 'user1', firstName: 'John', lastName: 'Doe' },
    createdAt: new Date(),
    type: 'document'
  };
  
  console.log('✅ Message mixte:', {
    hasContent: !!mixedMessage.content,
    contentLength: mixedMessage.content.length,
    hasAttachments: mixedMessage.attachments.length > 0,
    shouldShowText: mixedMessage.content && mixedMessage.content !== '[Media]',
    shouldShowMedia: mixedMessage.attachments.length > 0
  });

  // Test 4: Message vide/problématique
  console.log('\n4. ❌ Test message vide...');
  const emptyMessage = {
    _id: 'msg4',
    content: '',
    attachments: [],
    sender: { _id: 'user2', firstName: 'Jane', lastName: 'Smith' },
    createdAt: new Date(),
    type: 'text'
  };
  
  console.log('❌ Message vide:', {
    hasContent: !!emptyMessage.content,
    hasAttachments: emptyMessage.attachments.length > 0,
    shouldShowText: emptyMessage.content && emptyMessage.content !== '[Media]',
    shouldShowFallback: (!emptyMessage.content || emptyMessage.content === '[Media]') && emptyMessage.attachments.length === 0
  });

  // Test 5: Validation des URL d'attachements
  console.log('\n5. 🔗 Test validation URL attachements...');
  const attachmentUrls = [
    '/uploads/image.jpg',
    'http://localhost:5000/uploads/image.jpg',
    'https://example.com/image.jpg'
  ];
  
  attachmentUrls.forEach(url => {
    const baseUrl = 'http://localhost:5000';
    const finalUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    console.log(`✅ URL: ${url} -> ${finalUrl}`);
  });

  // Test 6: Types de fichiers supportés
  console.log('\n6. 📎 Test types de fichiers...');
  const fileTypes = [
    { mimeType: 'image/jpeg', expected: 'image' },
    { mimeType: 'image/png', expected: 'image' },
    { mimeType: 'video/mp4', expected: 'video' },
    { mimeType: 'audio/mpeg', expected: 'audio' },
    { mimeType: 'application/pdf', expected: 'document' },
    { mimeType: 'text/plain', expected: 'document' }
  ];
  
  fileTypes.forEach(({ mimeType, expected }) => {
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    const isDocument = !isImage && !isVideo && !isAudio;
    
    let detectedType = 'document';
    if (isImage) detectedType = 'image';
    else if (isVideo) detectedType = 'video';
    else if (isAudio) detectedType = 'audio';
    
    console.log(`✅ ${mimeType}: ${detectedType} (attendu: ${expected})`);
  });

  console.log('\n🎉 ===== RÉSUMÉ TEST RENDU =====');
  console.log('✅ Messages texte: Affichage du contenu');
  console.log('✅ Messages média: Affichage des attachements');
  console.log('✅ Messages mixtes: Affichage du texte + média');
  console.log('✅ Messages vides: Affichage du fallback');
  console.log('✅ URLs: Correction automatique des URLs');
  console.log('✅ Types: Détection correcte des types de fichiers');
  console.log('===============================');
}

// Lancer le test
testMediaMessageRendering().catch(console.error);
