/**
 * Authority Signup Screen
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
import { AuthAPI, isValidEmail, RootStackParamList } from '../utils';

type AuthoritySignupNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthoritySignup'>;

export default function AuthoritySignupScreen() {
  const navigation = useNavigation<AuthoritySignupNavigationProp>();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    officerId: '',
    stationName: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.officerId || !formData.stationName || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
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
      const result = await AuthAPI.signupAuthority({
        name: formData.name,
        email: formData.email,
        officerId: formData.officerId,
        stationName: formData.stationName,
        password: formData.password,
      });

      if (result.success) {
        Alert.alert('Success', 'Authority account created successfully! Please login.', [
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

        <Text style={styles.title}>Authority Registration</Text>
        <Text style={styles.subtitle}>Register as a law enforcement authority</Text>

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
            placeholder="Official Email *"
            placeholderTextColor="#A0A0A0"
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="id-card" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Officer ID *"
            placeholderTextColor="#A0A0A0"
            value={formData.officerId}
            onChangeText={(text) => handleChange('officerId', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="business" size={20} color="#A0A0A0" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Station Name *"
            placeholderTextColor="#A0A0A0"
            value={formData.stationName}
            onChangeText={(text) => handleChange('stationName', text)}
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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Register as Authority</Text>
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
