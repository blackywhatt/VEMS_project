import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import '../style/Form.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email || !password) {
      setError('All fields are required');
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
        console.log('Login successful!', data);
        alert('Login successful! Welcome ' + data.user.name);

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
          <a href="#">Forgot password?</a>
        </p>
        <p className="text-navigation">
          Don't have an account? <a href="Register">Register</a>
        </p>
      </div>
    </div>
  );
};

export default Login;