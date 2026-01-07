import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/Form.css';
import '../style/Register.css';
const Register = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Register'; }, []);

  const [showLoggedInPrompt, setShowLoggedInPrompt] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Check if user is already logged in
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
    phone_number: '',
    id: '',          
    password: '',
    confirmPassword: '',
    assigned_village: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [villages, setVillages] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/villages')
      .then(res => res.json())
      .then(data => setVillages(data))
      .catch(err => console.error("Failed to fetch villages", err));
  }, []);

  // Handle logout
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

  // Handle navigation back
  const handleGoBack = () => {
    if (loggedInUser?.role === 'head') {
      navigate('/dashboard');
    } else {
      navigate('/home');
    }
  };

  const { name, email, phone_number, id, password, confirmPassword, assigned_village } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!name || !email || !phone_number || !id || !password || !confirmPassword || !assigned_village) {
      setError('All fields are required, including village selection');
      setLoading(false);
      return;
    }

    // Validate name length and format
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (name.trim().length < 5 || !nameRegex.test(name)) {
      setError('Name must be at least 5 characters long and contain only letters');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Validate phone number
    const phoneRegex = /^[0-9+\-\s]{9,15}$/;
    if (!phoneRegex.test(phone_number)) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    // Validate ID format
    const idRegex = /^[a-zA-Z0-9]+$/;
    if (id.length < 6 || !idRegex.test(id)) {
      setError('ID must be at least 6 characters long and contain only letters and numbers');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
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
          phone_number,
          id,           
          password,
          assigned_village
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
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
    <div className="register-container">
      <div className="register-form">
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

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message" style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #c3e6cb' }}>{success}</div>}

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
                <label htmlFor="phone_number">Phone Number</label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={phone_number}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder="e.g. 0123456789"
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

              <div className="input-group">
                <label htmlFor="assigned_village">Village</label>
                <select
                  id="assigned_village"
                  name="assigned_village"
                  value={assigned_village}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={{ width: '100%', padding: '16px 20px', border: '2px solid #92400e', borderRadius: '8px', fontSize: '18px', backgroundColor: '#ffffff' }}
                >
                  <option value="">Select a Village</option>
                  {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
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
              Already have an account? <Link to="/login">Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;