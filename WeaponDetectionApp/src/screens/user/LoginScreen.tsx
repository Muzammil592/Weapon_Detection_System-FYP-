/**
 * Login Screen
 * Main authentication screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthAPI, useAuth, isValidEmail, RootStackParamList } from '../../utils';

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();
  const { login, error: authError, clearError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password Modal State
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Show auth errors
  useEffect(() => {
    if (authError) {
      setError(authError);
      clearError();
    }
  }, [authError, clearError]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await login({ email, password });
      // Navigation is handled by AppNavigator based on isAuthenticated state
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    
    if (!isValidEmail(forgotEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setForgotLoading(true);
    try {
      const result = await AuthAPI.forgotPassword(forgotEmail);
      
      if (result.success) {
        setForgotSuccess(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to send reset email');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setForgotModalVisible(false);
    setForgotEmail('');
    setForgotSuccess(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Security System</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#7B9198"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputContainer}>
          <Icon name="lock-closed" size={20} color="#7B9198" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#7B9198"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeIcon}>
            <Icon name={passwordVisible ? "eye-off" : "eye"} size={20} color="#7B9198" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => setForgotModalVisible(true)}>
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>
        <View style={styles.bottomContainer}>
          <Text style={styles.bottomText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('UserSignup')}>
            <Text style={styles.linkText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomContainer}>
          <Text style={styles.bottomText}>Authority Signup? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('AuthoritySignup')}>
            <Text style={styles.linkText}>Click Here</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Forgot Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={forgotModalVisible}
        onRequestClose={closeForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={closeForgotModal}>
              <Icon name="close" size={24} color="#1E333B" />
            </TouchableOpacity>
            
            {forgotSuccess ? (
              <>
                <Icon name="checkmark-circle" size={64} color="#4CAF50" style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Email Sent!</Text>
                <Text style={styles.modalText}>
                  Check your email for password reset instructions.
                </Text>
                <TouchableOpacity style={styles.modalButton} onPress={closeForgotModal}>
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Icon name="lock-open" size={64} color="#1E6574" style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Forgot Password</Text>
                <Text style={styles.modalText}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
                <View style={styles.modalInputContainer}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#7B9198"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, forgotLoading && styles.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#164B58',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    borderRadius: 24,
    backgroundColor: '#F4F8F9',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E333B',
    marginBottom: 20,
  },
  error: {
    color: '#D95B57',
    marginBottom: 10,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
  eyeIcon: {
    padding: 5,
  },
  button: {
    width: '100%',
    backgroundColor: '#1E6574',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
  },
  linkText: {
    color: '#1E6574',
    fontSize: 14,
  },
  bottomContainer: {
    flexDirection: 'row',
    marginTop: 15,
  },
  bottomText: {
    color: '#67808A',
    fontSize: 14,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  modalIcon: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E333B',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#67808A',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#E2ECEF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1E333B',
  },
  modalButton: {
    width: '100%',
    backgroundColor: '#1E6574',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
