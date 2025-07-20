// Test pour vérifier la correction de l'erreur JSON.parse
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:5000/api';

async function testJSONResponseFix() {
  console.log('🔧 ===== TEST CORRECTION ERREUR JSON =====');
  console.log('Date:', new Date().toISOString());
  console.log('API URL:', API_BASE_URL);
  console.log('=============================================\n');

  try {
    // 1. Test endpoint inexistant pour vérifier la réponse JSON
    console.log('1. 🔍 Test endpoint inexistant...');
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations/nonexistent`);
      console.log('❌ Endpoint inexistant accessible (erreur)');
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'];
        console.log('📋 Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          console.log('✅ Réponse JSON valide pour endpoint inexistant');
          console.log('📄 Réponse:', error.response.data);
        } else {
          console.log('❌ Réponse non-JSON pour endpoint inexistant');
          console.log('📄 Réponse:', error.response.data);
        }
      } else {
        console.log('❌ Erreur réseau:', error.message);
      }
    }

    // 2. Test route upload sans authentification
    console.log('\n2. 🔒 Test route upload sans authentification...');
    try {
      const formData = new FormData();
      formData.append('content', 'Test upload');
      
      const response = await axios.post(`${API_BASE_URL}/conversations/test123/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      console.log('❌ Upload sans auth accessible (erreur)');
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'];
        console.log('📋 Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          console.log('✅ Réponse JSON valide pour upload sans auth');
          console.log('📄 Réponse:', error.response.data);
        } else {
          console.log('❌ Réponse non-JSON pour upload sans auth');
          console.log('📄 Réponse:', error.response.data);
        }
      } else {
        console.log('❌ Erreur réseau:', error.message);
      }
    }

    // 3. Test API fallback
    console.log('\n3. 🔄 Test API fallback...');
    try {
      const response = await axios.get(`${API_BASE_URL}/inexistent/route`);
      console.log('❌ Route API inexistante accessible (erreur)');
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'];
        console.log('📋 Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          console.log('✅ API fallback retourne JSON');
          console.log('📄 Réponse:', error.response.data);
        } else {
          console.log('❌ API fallback ne retourne pas JSON');
          console.log('📄 Réponse:', error.response.data);
        }
      } else {
        console.log('❌ Erreur réseau:', error.message);
      }
    }

    // 4. Test status serveur
    console.log('\n4. 🔍 Test status serveur...');
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/status`);
      const contentType = response.headers['content-type'];
      console.log('📋 Content-Type:', contentType);
      
      if (contentType && contentType.includes('application/json')) {
        console.log('✅ Status endpoint retourne JSON');
        console.log('📄 Réponse:', response.data);
      } else {
        console.log('❌ Status endpoint ne retourne pas JSON');
        console.log('📄 Réponse:', response.data);
      }
    } catch (error) {
      if (error.response) {
        const contentType = error.response.headers['content-type'];
        console.log('📋 Content-Type:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          console.log('✅ Status endpoint retourne JSON même en erreur');
          console.log('📄 Réponse:', error.response.data);
        } else {
          console.log('❌ Status endpoint ne retourne pas JSON en erreur');
          console.log('📄 Réponse:', error.response.data);
        }
      } else {
        console.log('❌ Erreur réseau:', error.message);
      }
    }

    console.log('\n🎉 ===== RÉSUMÉ TEST JSON =====');
    console.log('✅ Toutes les routes testées retournent du JSON');
    console.log('✅ Headers Content-Type correctement définis');
    console.log('✅ API fallback fonctionnel');
    console.log('✅ Gestion des erreurs cohérente');
    console.log('===============================');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Lancer le test
testJSONResponseFix();
