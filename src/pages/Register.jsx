import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/Form.css';
const Register = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Register'; }, []);

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

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    id: '',          
    password: '',
    confirmPassword: ''
  });
  
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

  const { name, email, id, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Client-side validation
    if (!name || !email || !id || !password || !confirmPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    // Make sure the name isn't too short or just spaces
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      setLoading(false);
      return;
    }

    // Check if the email looks like a real email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Ensure ID only has letters and numbers to prevent weird characters
    const idRegex = /^[a-zA-Z0-9]+$/;
    if (!idRegex.test(id)) {
      setError('ID must contain only letters and numbers');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Require a stronger password with at least 8 chars and a number
    if (password.length < 8 || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a number');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          id,           
          password
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        alert('Registration successful! You can now log in.');

        navigate('/login');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Unable to connect to server. Please try again later.');
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
                Logout & Register
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2>Register</h2>

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="id">ID</label>
                <input
                  type="text"
                  id="id"
                  name="id"
                  value={id}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="input-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="button"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register'}
              </button>
            </form>

            <p className="text-navigation">
              Already have an account? <a href="/login">Sign In</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;