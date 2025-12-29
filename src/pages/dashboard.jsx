import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/dashboard.css';
import weatherImg from '../assets/weather.png';
import emergencyImg from '../assets/emergency.png';
import reportsImg from '../assets/reports.png';
import serviceImg from '../assets/service.png';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => { document.title = 'Dashboard'; }, []);

  // Check for authentication and load user role
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!storedUser || !token) {
      navigate('/login');
    } else {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.role !== 'head') {
        navigate('/home');
        return;
      }
      // SECURITY: If user claims to be admin, verify with the backend immediately
      if (parsedUser.role === 'head') {
        fetch('http://localhost:5000/api/admin_only', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => {
            if (!res.ok) {
              console.warn("Security Alert: Invalid token or fake role detected.");
              localStorage.clear();
              navigate('/login');
            }
          });
      }
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

  const [cards, setCards] = useState([
    { id: 1, img: weatherImg, title: 'Weather', text: 'Sunny' },
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Normal' },
    { id: 3, img: reportsImg, title: "Today's Reports", text: '10' },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Maintenance' },
  ]);

  const updateCardText = (id, newText) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, text: newText } : c)));
  };

  // Local inputs for Manage form; updates applied when user clicks Update
  const [emergencyInput, setEmergencyInput] = useState(
    () => cards.find(c => c.id === 2)?.text || ''
  );
  const [serviceInput, setServiceInput] = useState(
    () => cards.find(c => c.id === 4)?.text || ''
  );

  useEffect(() => {
    if (currentHash === '#manage') {
      setEmergencyInput(cards.find(c => c.id === 2)?.text || '');
      setServiceInput(cards.find(c => c.id === 4)?.text || '');
    }
  }, [currentHash, cards]);

  const applyUpdates = () => {
    updateCardText(2, emergencyInput);
    updateCardText(4, serviceInput);
  };

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
    <div className="dashboard-container">
      <div className="sidenav">
        <a href="#overview" className="tab">Overview</a>
        <a href="#reports" className="tab">Reports</a>
        <a href="#manage" className="tab">Manage</a>
        <a href="#stats" className="tab">Statistics</a>
        <a href="#notes" className="tab">Notes</a>

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

        {currentHash === '#reports' && (
          <section id="reports" className="reports">
            <h2 className="title">Reports</h2>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ali</td>
                  <td>29</td>
                  <td>Male</td>
                  <td>28/12/2025</td>
                  <td>10:30 AM</td>
                  <td>Report A</td>
                </tr>
                <tr>
                  <td>Noor</td>
                  <td>34</td>
                  <td>Female</td>
                  <td>12/12/2025</td>
                  <td>11:00 AM</td>
                  <td>Report B</td>
                </tr>
                <tr>
                  <td>Abu</td>
                  <td>41</td>
                  <td>Male</td>
                  <td>10/12/2025</td>
                  <td>12:15 PM</td>
                  <td>Report C</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Only render Manage section if user is admin */}
        {currentHash === '#manage' && user?.role === 'head' && (
          <section id="manage" className="manage">
            <h2 className="title">Manage Statuses</h2>
            <form className="manage-form" onSubmit={e => e.preventDefault()}>
              <div className="form-row">
                <label htmlFor="emergency">Emergency Status</label>
                <input
                  id="emergency"
                  type="text"
                  value={emergencyInput}
                  onChange={e => setEmergencyInput(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label htmlFor="service">Service Status</label>
                <input
                  id="service"
                  type="text"
                  value={serviceInput}
                  onChange={e => setServiceInput(e.target.value)}
                />
              </div>

              <div className="form-row">
                <button type="button" className="btn btn-primary" onClick={applyUpdates}>
                  Update
                </button>
              </div>

              <p className="manage-note">Click "Update" to apply changes to Overview.</p>
            </form>
          </section>
        )}

        {currentHash === '#stats' && (
          <section id="stats" className="stats">
            <h2 className="title">Statistics</h2>
            {/* Empty section for stats */}
          </section>
        )}
        {currentHash === '#notes' && (
          <section id="notes" className="stats">
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
      </main>
    </div>
  );
};

export default Dashboard;