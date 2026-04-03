import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiArrowRight, FiAtSign } from 'react-icons/fi';
import { FaGoogle } from 'react-icons/fa';
import { auth, provider, signInWithPopup } from '../firebase';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

const SignUp = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveAuthAndRedirect = (data) => {
    localStorage.setItem('userInfo', JSON.stringify(data));
    navigate('/chat');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!agree) {
      setError("Please agree to the Terms and Conditions.");
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      const { data } = await axios.post(`${API_URL}/register`, { fullName, email, password, username });
      saveAuthAndRedirect(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
        setError(err.response?.data?.message || 'Google Sign Up failed');
      }
      console.error('Google Auth Error:', err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="brand-logo" style={{ borderRadius: '50%', background: '#22272E', boxShadow: 'none', width: '48px', height: '48px' }}>
           <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#669DFF' }}>C</span>
        </div>
      </div>

      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2>Create Account</h2>
            <p style={{ margin: 0 }}>Join the real-time workspace for modern teams.</p>
        </div>

        {error && <div style={{color: '#ef4444', fontSize: '12px', marginBottom: '15px'}}>{error}</div>}

        <form onSubmit={handleSignUp}>
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-container">
              <FiUser className="input-icon" />
              <input
                type="text"
                placeholder="Alex Rivers"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username</label>
            <div className="input-container">
              <FiAtSign className="input-icon" />
              <input
                type="text"
                placeholder="alex_rivers"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-container">
              <FiMail className="input-icon" />
              <input
                type="email"
                placeholder="alex@workspace.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-container">
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

          <div className="form-group checkbox-container" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '15px' }}>
            <input 
               type="checkbox" 
               id="terms" 
               checked={agree}
               onChange={(e) => setAgree(e.target.checked)}
               style={{ marginTop: '4px', accentColor: 'var(--primary-blue)', width: '16px', height: '16px' }}
            />
            <label htmlFor="terms" style={{ textTransform: 'none', color: 'var(--text-secondary)', fontWeight: 400, fontSize: '13px', lineHeight: '1.4', margin: 0 }}>
              I agree to the <Link to="#">Terms and Conditions</Link> and privacy policy.
            </label>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '20px' }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'} <FiArrowRight />
          </button>
        </form>

        <div className="divider">Or Join With</div>

        <div className="social-auth">
          <button type="button" className="btn-social" onClick={handleGoogleAuth}>
            <FaGoogle style={{ color: '#fff' }} /> Google
          </button>
        </div>
      </div>

      <div className="auth-footer" style={{ marginTop: '20px' }}>
        Already have an account? <Link to="/signin" style={{ fontWeight: 600 }}>Sign In</Link>
      </div>
    </div>
  );
};

export default SignUp;
