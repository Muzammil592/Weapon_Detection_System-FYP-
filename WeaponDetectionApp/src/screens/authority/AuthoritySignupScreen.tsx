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
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthAPI, isValidEmail, RootStackParamList } from '../../utils';

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
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

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
        setPendingEmail(formData.email.trim().toLowerCase());
        setOtpCode('');
        setOtpModalVisible(true);
        Alert.alert('OTP Sent', 'A verification OTP has been sent to your email.');
      } else {
        Alert.alert('Error', result.error || 'Failed to create account');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const normalizedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    if (!pendingEmail) {
      Alert.alert('Error', 'No pending signup found. Please register again.');
      setOtpModalVisible(false);
      return;
    }

    setOtpLoading(true);
    try {
      const result = await AuthAPI.verifySignupOtp({
        email: pendingEmail,
        role: 'authority',
        otp: normalizedOtp,
      });

      if (result.success) {
        setOtpModalVisible(false);
        Alert.alert('Success', 'Authority account verified and created successfully! Please login.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Error', result.error || 'OTP verification failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingEmail) {
      Alert.alert('Error', 'No pending signup found. Please register again.');
      return;
    }

    setResendLoading(true);
    try {
      const result = await AuthAPI.resendSignupOtp({
        email: pendingEmail,
        role: 'authority',
      });

      if (result.success) {
        Alert.alert('OTP Sent', 'A new OTP has been sent to your email.');
      } else {
        Alert.alert('Error', result.error || 'Failed to resend OTP');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#1E333B" />
        </TouchableOpacity>

        <Text style={styles.title}>Authority Registration</Text>
        <Text style={styles.subtitle}>Register as a law enforcement authority</Text>

        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name *"
            placeholderTextColor="#7B9198"
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="mail" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Official Email *"
            placeholderTextColor="#7B9198"
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="id-card" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Officer ID *"
            placeholderTextColor="#7B9198"
            value={formData.officerId}
            onChangeText={(text) => handleChange('officerId', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="business" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Station Name *"
            placeholderTextColor="#7B9198"
            value={formData.stationName}
            onChangeText={(text) => handleChange('stationName', text)}
          />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock-closed" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            placeholderTextColor="#7B9198"
            value={formData.password}
            onChangeText={(text) => handleChange('password', text)}
            secureTextEntry={!passwordVisible}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Icon name={passwordVisible ? 'eye-off' : 'eye'} size={20} color="#7B9198" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock-closed" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password *"
            placeholderTextColor="#7B9198"
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

      <Modal
        visible={otpModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Email OTP</Text>
            <Text style={styles.modalDescription}>
              Enter the 6-digit OTP sent to {pendingEmail || formData.email}.
            </Text>

            <View style={styles.otpInputContainer}>
              <Icon name="keypad" size={20} color="#7B9198" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="6-digit OTP"
                placeholderTextColor="#7B9198"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, otpLoading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={otpLoading}
            >
              {otpLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, resendLoading && styles.buttonDisabled]}
              onPress={handleResendOtp}
              disabled={resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator color="#1E6574" />
              ) : (
                <Text style={styles.secondaryButtonText}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8F9',
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
    color: '#1E333B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#67808A',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2ECEF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#1E333B',
    fontSize: 16,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#1E6574',
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
    color: '#67808A',
    fontSize: 14,
  },
  linkText: {
    color: '#1E6574',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#F4F8F9',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E333B',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#67808A',
    marginBottom: 16,
  },
  otpInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2ECEF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1E6574',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1E6574',
    fontSize: 16,
    fontWeight: '600',
  },
});
