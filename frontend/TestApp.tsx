import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function TestApp() {
  console.log('🧪 TestApp is rendering...');
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TM Paysage Site Manager</Text>
      <Text style={styles.subtitle}>Test App is Working!</Text>
      <Text style={styles.debug}>✅ React Native</Text>
      <Text style={styles.debug}>✅ Expo</Text>
      <Text style={styles.debug}>✅ TypeScript</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E86AB',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 32,
    textAlign: 'center',
  },
  debug: {
    fontSize: 16,
    color: '#27AE60',
    marginVertical: 4,
  },
}); 