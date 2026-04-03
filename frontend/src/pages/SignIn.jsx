import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi';
import { FaGoogle } from 'react-icons/fa';
import { auth, provider, signInWithPopup } from '../firebase';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveAuthAndRedirect = (data) => {
    localStorage.setItem('userInfo', JSON.stringify(data));
    navigate('/chat');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/login`, { email, password });
      saveAuthAndRedirect(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const { data } = await axios.post(`${API_URL}/google`, {
        name: user.displayName,
        email: user.email,
        googleId: user.uid,
        avatarUrl: user.photoURL
      });
      saveAuthAndRedirect(data);
    } catch (err) {
      if (err.code === 'auth/configuration-not-found') {
        setError('Google Auth not enabled in Firebase Console. Please enable it.');
      } else {
        setError(err.response?.data?.message || 'Google Sign In failed');
      }
      console.error('Google Auth Error:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.47 2 2 6.47 2 12C2 17.53 6.47 22 12 22C17.53 22 22 17.53 22 12C22 6.47 17.53 2 12 2ZM15 14L12 17L9 14V11H15V14ZM12 7C13.1 7 14 7.9 14 9C14 10.1 13.1 11 12 11C10.9 11 10 10.1 10 9C10 7.9 10.9 7 12 7Z" fill="white"/>
          </svg>
        </div>
        <div className="auth-title">Connect</div>
      </div>

      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p>Enter your credentials to access your workspace.</p>

        {error && <div style={{color: '#ef4444', fontSize: '12px', marginBottom: '15px'}}>{error}</div>}

        <form onSubmit={handleSignIn}>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-container">
              <FiMail className="input-icon" />
              <input
                type="email"
                placeholder="name@company.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ marginBottom: 0 }}>Password</label>
              <Link to="#" style={{ fontSize: '11px', fontWeight: 500 }}>Forgot Password?</Link>
            </div>
            <div className="input-container" style={{ marginTop: '8px' }}>
              <FiLock className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'} <FiArrowRight />
          </button>
        </form>

        <div className="divider">Or Continue With</div>

        <div className="social-auth">
          <button type="button" className="btn-social" onClick={handleGoogleAuth}>
            <FaGoogle style={{ color: '#fff' }} /> Google
          </button>
        </div>
      </div>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </div>
    </div>
  );
};

export default SignIn;
