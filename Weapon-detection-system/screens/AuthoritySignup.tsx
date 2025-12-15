import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AuthAPI } from '../app/utilities';

export default function AuthoritySignup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [stationName, setStationName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await AuthAPI.signupAuthority({
        name: fullName,
        email,
        officerId,
        stationName,
        password,
      });
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Authority Registration</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.pillButton}>
          <Text style={styles.pillText}>Police Officer</Text>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your government-issued email"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your officer ID"
          placeholderTextColor="#9CA3AF"
          value={officerId}
          onChangeText={setOfficerId}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your station name"
          placeholderTextColor="#9CA3AF"
          value={stationName}
          onChangeText={setStationName}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm your password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!confirmPasswordVisible}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        
        <TouchableOpacity style={styles.button} onPress={handleCreateAccount}>
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already registered? </Text>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Text style={styles.linkText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    padding: 15,
  },
  pageLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  pillButton: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 24,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  linkText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  error: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
  },
});