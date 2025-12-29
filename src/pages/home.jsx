import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/home.css';
import weatherImg from '../assets/weather.png';
import emergencyImg from '../assets/emergency.png';
import serviceImg from '../assets/service.png';

const Home = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Home'; }, []);

  // Simple Token Check: If no token exists, redirect to login
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const [currentHash, setCurrentHash] = useState(
    (typeof window !== 'undefined' && window.location.hash) ? window.location.hash : '#overview'
  );

  useEffect(() => {
    const onChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);

  const [cards] = useState([
    { id: 1, img: weatherImg, title: 'Weather', text: 'Sunny' },
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Normal' },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Maintenance' },
  ]);



  const handleLogout = async () => {
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
    navigate('/login');
  };

  return (
    <div className="Home-container">
      <div className="sidenavu">
        <a href="#overview" className="tab">Overview</a>
        <a href="#report" className="tab">Report</a>
        <a href="#emap" className="tab">Emergency Map</a>

        <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Log out">
          <svg className="logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logout-text">Log out</span>
        </button>
      </div>

      <main className="main-content">
        {(currentHash === '#overview' || currentHash === '') && (
          <section id="overview" className="overview">
            <h2 className="title">Overview</h2>
            <div className="overview-grid">
              {cards.map(c => (
                <div key={c.id} className="card">
                  <img src={c.img} alt={c.title} className="card-image" />
                  <h3 className="card-title">{c.title}</h3>
                  <div className="card-dash" aria-hidden="true" />
                  <p className="card-text">{c.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#report' && (
          <section id="report" className="report">
            <h2 className="title">Report</h2>
            <div className="fab-container">
              <button
                type="button"
                className="fab"
                onClick={() => alert('Primary action clicked!')}
                aria-label="Primary action"
              >
                +
              </button>
            </div>
          </section>
        )}
        {currentHash === '#emap' && (
          <section id="emap" className="emap">
            <h2 className="title">Emeregency Map</h2>
          </section>
        )}
      </main>
    </div>
  );
};

export default Home;