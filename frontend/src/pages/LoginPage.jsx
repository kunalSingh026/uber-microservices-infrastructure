import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import apiClient from '../api/apiClient';

function LoginPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      return null;
    }
  });

  const [loginError, setLoginError] = useState(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect straight to booking page
  if (currentUser) {
    return <Navigate to="/customer" replace />;
  }

  useEffect(() => {
    const initializeGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "406723043892-65aqhp2t3ma2gbls5r613s4niki1d6om.apps.googleusercontent.com",
          callback: handleCredentialResponse
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleBtnParent"),
          { theme: "outline", size: "large", width: "320", shape: "pill" }
        );
      }
    };

    // Poll until Google client library is loaded
    const interval = setInterval(() => {
      if (window.google) {
        initializeGoogle();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await apiClient.post('/api/v1/passenger/auth/google', { token: response.credential });
      localStorage.setItem('user', JSON.stringify(res.data));
      setCurrentUser(res.data);
      navigate('/customer');
    } catch (err) {
      console.error("Google login authentication error:", err);
      setLoginError(err.userFriendlyMessage || "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      padding: '24px',
      color: '#0f172a'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03), 0 20px 25px -5px rgba(0, 0, 0, 0.05)',
        borderRadius: '24px',
        padding: '48px 40px',
        textAlign: 'center',
        maxWidth: '440px',
        width: '100%',
        animation: 'fadeIn 0.8s ease-out'
      }}>
        {/* Logo Badge */}
        <div style={{
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '64px',
          height: '64px',
          backgroundColor: '#000000',
          borderRadius: '16px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: '0 10px 20px -10px rgba(0, 0, 0, 0.3)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '36px', fontWeight: 'bold' }}>local_taxi</span>
        </div>

        <h1 style={{
          fontSize: '30px',
          fontWeight: '800',
          letterSpacing: '-1.2px',
          color: '#000000',
          margin: '0 0 10px 0'
        }}>
          Uber Sign In
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#475569',
          margin: '0 0 32px 0',
          lineHeight: '1.6',
          fontWeight: '500'
        }}>
          Please verify your Google Account identity to book and manage ride requests.
        </p>

        {/* Loader or Error message */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div className="spinner" style={{
              width: '28px',
              height: '28px',
              border: '3px solid rgba(0, 0, 0, 0.05)',
              borderTop: '3px solid #000000',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ fontSize: '13px', color: '#475569' }}>Authenticating session...</span>
          </div>
        )}

        {loginError && (
          <div style={{
            padding: '14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '12px',
            color: '#dc2626',
            fontSize: '13px',
            lineHeight: '1.5',
            marginBottom: '24px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>error</span>
            <span>{loginError}</span>
          </div>
        )}

        {/* Google Sign-In Target */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50px',
          marginBottom: '16px'
        }}>
          <div id="googleBtnParent"></div>
        </div>

        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '24px', fontWeight: '500' }}>
          By signing in, you agree to system telemetry audits.
        </div>
      </div>

      {/* Global Styles for Spinner & FadeIn */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;
