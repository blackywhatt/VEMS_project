import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from "react-router-dom";
import '../style/Form.css';

const Login = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Login'; }, []);

  const [showLoggedInPrompt, setShowLoggedInPrompt] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Check if a user is already logged in when the component mounts
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setLoggedInUser(JSON.parse(user));
      setShowLoggedInPrompt(true);
    }
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Handler for the prompt's "Logout" button
  const handlePromptLogout = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('http://localhost:5000/api/logout', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        console.error("Logout API call failed:", error);
      }
    }
    localStorage.clear();
    setShowLoggedInPrompt(false);
    setLoggedInUser(null);
  };

  // Handler for the prompt's "Go Back" button
  const handleGoBack = () => {
    if (loggedInUser?.role === 'head') {
      navigate('/dashboard');
    } else {
      navigate('/home');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email || !password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    // Check if the email format is valid before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email,
          password: password
        })
      });
      const data = await response.json();
      if (response.ok) {
        
        // Store the token and user info securely in local storage
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect based on user role
        if (data.user.role === 'head') {
          navigate('/dashboard');
        } else if (data.user.role === 'super') {
          navigate('/super');
        } else {
          navigate('/home');
        }
      } else {
        setError(data.message || 'Login failed');
      }

    } catch (err) {
      console.error('Error:', err);
      setError('Unable to connect to server. Make sure Flask is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="form">
        {showLoggedInPrompt ? (
          <div className="logged-in-prompt">
            <h2>Already Logged In</h2>
            <p>You are currently logged in as <strong>{loggedInUser?.name}</strong>.</p>
            <div className="prompt-actions">
              <button className="button" onClick={handleGoBack}>
                Go to {loggedInUser?.role === 'head' ? 'Dashboard' : 'Home'}
              </button>
              <button className="button-secondary" onClick={handlePromptLogout}>
                Logout & Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2>Login</h2>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="button"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-navigation">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
            <p className="text-navigation">
              Don't have an account? <Link to="/register">Register</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;