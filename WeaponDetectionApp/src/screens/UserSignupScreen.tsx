/**
 * User Signup Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthAPI, isValidEmail, isValidPhone, RootStackParamList } from '../utils';

type UserSignupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserSignup'>;

export default function UserSignupScreen() {
  const navigation = useNavigation<UserSignupNavigationProp>();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    cctvName: '',
    rtspUrl: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!isValidPhone(formData.phone)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthAPI.signupUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        cctvName: formData.cctvName,
        rtspUrl: formData.rtspUrl,
        location: formData.location,
      });

      if (result.success) {
        Alert.alert('Success', 'Account created successfully! Please login.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to create account');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>User Registration</Text>
        <Text style={styles.subtitle}>Create your account to get started</Text>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name *"
            placeholderTextColor="#A0A0A0"
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="mail" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email Address *"
            placeholderTextColor="#A0A0A0"
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="call" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Phone Number *"
            placeholderTextColor="#A0A0A0"
            value={formData.phone}
            onChangeText={(text) => handleChange('phone', text)}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock-closed" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            placeholderTextColor="#A0A0A0"
            value={formData.password}
            onChangeText={(text) => handleChange('password', text)}
            secureTextEntry={!passwordVisible}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Icon name={passwordVisible ? "eye-off" : "eye"} size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock-closed" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password *"
            placeholderTextColor="#A0A0A0"
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange('confirmPassword', text)}
            secureTextEntry={!passwordVisible}
          />
        </View>

        {/* CCTV Information */}
        <Text style={styles.sectionTitle}>CCTV Configuration (Optional)</Text>

        <View style={styles.inputContainer}>
          <Icon name="videocam" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="CCTV Name"
            placeholderTextColor="#A0A0A0"
            value={formData.cctvName}
            onChangeText={(text) => handleChange('cctvName', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="link" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="RTSP URL (rtsp://...)"
            placeholderTextColor="#A0A0A0"
            value={formData.rtspUrl}
            onChangeText={(text) => handleChange('rtspUrl', text)}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="location" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Location"
            placeholderTextColor="#A0A0A0"
            value={formData.location}
            onChangeText={(text) => handleChange('location', text)}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomContainer}>
          <Text style={styles.bottomText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101C26',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A9AA8',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3EA0FF',
    marginBottom: 15,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#24384A',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#FF6D00',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  bottomText: {
    color: '#8A9AA8',
    fontSize: 14,
  },
  linkText: {
    color: '#FF6D00',
    fontSize: 14,
  },
});
