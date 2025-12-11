import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function UserSignup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cctvName, setCctvName] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [location, setLocation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    try {
      const response = await fetch('http://10.75.26.41:5000/api/auth/signup/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email,
          phone,
          password,
          cctvName,
          rtspUrl,
          location,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('User registered successfully');
        router.push('/');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create User Account</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <View style={styles.inputContainer}>
          <Ionicons name="person" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#A0A0A0"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="mail" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#A0A0A0"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="call" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#A0A0A0"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#A0A0A0"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIcon}>
            <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={20} color="#9E9E9E" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#A0A0A0"
            secureTextEntry={!confirmPasswordVisible}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} style={styles.eyeIcon}>
            <Ionicons name={confirmPasswordVisible ? "eye-off" : "eye"} size={20} color="#9E9E9E" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.sectionTitle}>Connect Your CCTV</Text>
        
        <View style={styles.inputContainer}>
          <Ionicons name="camera" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="CCTV Camera Name"
            placeholderTextColor="#A0A0A0"
            value={cctvName}
            onChangeText={setCctvName}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="link" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Camera RTSP/Video Stream URL"
            placeholderTextColor="#A0A0A0"
            value={rtspUrl}
            onChangeText={setRtspUrl}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Ionicons name="pin" size={20} color="#9E9E9E" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Camera Location"
            placeholderTextColor="#A0A0A0"
            value={location}
            onChangeText={setLocation}
          />
        </View>
        
        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.authorityLink} onPress={() => router.push('/authority-signup')}>
          <Text style={styles.authorityText}>For Authority SignUp click here</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.link} onPress={() => router.push('/')}>
          <Text style={styles.footerText}>Already have an account? <Text style={styles.linkText}>Login</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 24,
  },
  card: {
    width: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    height: 48,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  eyeIcon: {
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555555',
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#333333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  authorityLink: {
    marginTop: 16,
    padding: 10,
  },
  authorityText: {
    fontSize: 14,
    color: '#1A73E8',
    textAlign: 'center',
    fontWeight: '600',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  link: {
    marginTop: 18,
  },
  footerText: {
    fontSize: 13,
    color: '#333333',
    textAlign: 'center',
  },
  linkText: {
    color: '#1A73E8',
    textDecorationLine: 'underline',
  },
  error: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
  },
});