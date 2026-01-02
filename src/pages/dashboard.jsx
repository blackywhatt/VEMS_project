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

  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { document.title = 'Dashboard'; }, []);

  // Auth check & load role
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
      // Verify admin status with backend
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

  const [reports, setReports] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sosRequests, setSosRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const fetchNotes = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/notes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mappedNotes = data.map(n => {
          let parsed = { title: 'Note', description: n.content };
          try { parsed = JSON.parse(n.content); } catch (e) {}
          return {
            id: n.id,
            title: parsed.title,
            content: parsed.description || n.content,
            created_at: new Date(n.submitted_at).toLocaleString()
          };
        });
        setNotes(mappedNotes);
      }
    } catch (e) { console.error(e); }
  };

  const fetchAnnouncements = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    // Fetch data
    const token = localStorage.getItem('token');
    if (token) {
        fetch('http://localhost:5000/api/reports', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                const mapped = data.map(r => {
                    let parsed = { title: 'Report', category: '', description: r.content };
                    try { parsed = JSON.parse(r.content); } catch (e) {}
                    return {
                        id: r.id,
                        title: parsed.title,
                        category: parsed.category,
                        content: parsed.description || r.content,
                        created_at: new Date(r.submitted_at).toLocaleString()
                    };
                });
                setReports(mapped);
            })
            .catch(err => console.error(err));
        
        fetchNotes();
        fetchAnnouncements();
    }
  }, [currentHash]);

  useEffect(() => {
    if (currentHash === '#urgent') {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('http://localhost:5000/api/sos_requests', {
           headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setSosRequests(data))
        .catch(err => console.error(err));
      }
    }
  }, [currentHash]);

  const fetchVillageStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/village_status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmergencyInput(data.emergency_status);
        setServiceInput(data.service_status);
        updateCardText(2, data.emergency_status);
        updateCardText(4, data.service_status);
      }
    } catch (e) { console.error(e); }
  };

  const [cards, setCards] = useState(() => [
    { id: 1, img: weatherImg, title: 'Weather', text: 'Sunny' },
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Loading...' },
    { id: 3, img: reportsImg, title: "Today's Reports", text: reports.length.toString() },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Loading...' },
  ]);

  const updateCardText = (id, newText) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, text: newText } : c)));
  };

  useEffect(() => {
    fetchVillageStatus();
  }, []);

  useEffect(() => {
    updateCardText(3, reports.length.toString());
  }, [reports]);

  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState([]);
  const [newItem, setNewItem] = useState({ title: '', content: '' });

  useEffect(() => {
    // Hide form on tab switch
    setShowForm(false);
  }, [currentHash]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 3) {
      etFiles([]);
    } else {
      setFiles(e.target.files);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    if (currentHash === '#announcements') {
      try {
        const res = await fetch('http://localhost:5000/api/submit_announcement', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            title: newItem.title,
            content: newItem.content
          })
        });
        if (res.ok) {
          setShowForm(false);
          setNewItem({ title: '', content: '' });
          fetchAnnouncements();
        }
      } catch (e) { console.error(e); }
      return;
    }

    const contentPayload = JSON.stringify({
      title: newItem.title,
      description: newItem.content
    });

    const formData = new FormData();
    formData.append('content', contentPayload);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('http://localhost:5000/api/submit_note', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setShowForm(false);
        setNewItem({ title: '', content: '' });
        setFiles([]);
        fetchNotes();
      }
    } catch (e) { console.error(e); }
  };

  // Manage form state
  const [emergencyInput, setEmergencyInput] = useState(
    'Normal'
  );
  const [serviceInput, setServiceInput] = useState(
    'Maintenance'
  );

  const applyUpdates = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/update_village_status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          emergency_status: emergencyInput,
          service_status: serviceInput
        })
      });
      if (res.ok) {
        showNotification('Statuses updated!', 'success');
        fetchVillageStatus();
      }
    } catch (e) { console.error(e); }
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

  const getStatusColor = (text) => {
    const map = {
      'Normal': '#10b981', 'High Alert': '#f59e0b', 'Critical': '#ef4444',
      'Operational': '#10b981', 'Maintenance': '#f59e0b', 'Down': '#ef4444'
    };
    return map[text] || '#000';
  };

  const getTabClass = (hash) => {
    const isActive = currentHash === hash || (hash === '#overview' && currentHash === '');
    return isActive ? 'dash-tab active' : 'dash-tab';
  };

  return (
    <div className="dashboard-container">
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white', padding: '15px 25px', borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', animation: 'fadeIn 0.5s'
        }}>
          {notification.message}
        </div>
      )}

      <div className="dash-sidenav">
        <a href="#overview" className={getTabClass('#overview')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Overview
        </a>
        <a href="#reports" className={getTabClass('#reports')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Reports
        </a>
        <a href="#urgent" className={getTabClass('#urgent')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Urgent
        </a>
        <a href="#announcements" className={getTabClass('#announcements')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
          Announcements
        </a>
        <a href="#manage" className={getTabClass('#manage')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          Manage
        </a>
        <a href="#notes" className={getTabClass('#notes')}>
          <svg className="dash-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Notes
        </a>

        <button 
          type="button" 
          className="dash-logout-btn" 
          onClick={handleLogout} 
          aria-label="Log out" 
        >
          <svg className="dash-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logout-text">Log out</span>
        </button>
      </div>

      <main className="dash-main-content">
        {(currentHash === '#overview' || currentHash === '') && (
          <section id="overview" className="dashboard-section">
            <h2 className="dash-section-title">Overview</h2>
            <div className="dash-overview-grid">
              {cards.map(c => (
                <div key={c.id} className="dashboard-card">
                  <img src={c.img} alt={c.title} className="dashboard-card-image" />
                  <h3 className="dashboard-card-title">{c.title}</h3>
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text dashboard-card-text-large" style={{ color: getStatusColor(c.text) }}>{c.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#reports' && (
          <section id="reports" className="dashboard-section">
            <h2 className="dash-section-title">Emergency Reports</h2>
            <div className="dash-overview-grid">
              {reports.map(item => (
                <div key={item.id} className="dashboard-card" style={{ borderLeft: '5px solid #d9534f' }}>
                  <h3 className="dashboard-card-title">{item.title}</h3>
                  {item.category && <small style={{ color: '#d9534f', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{item.category}</small>}
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text">{item.content}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>
                    {item.created_at}
                  </small>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#urgent' && (
          <section id="urgent" className="dashboard-section">
            <h2 className="dash-section-title">Urgent SOS Requests</h2>
            <div className="dash-overview-grid">
              {sosRequests.map(item => (
                <div key={item.id} className="dashboard-card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <h3 className="dashboard-card-title" style={{ color: '#ef4444' }}>SOS SIGNAL</h3>
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text"><strong>User ID:</strong> {item.user_id}</p>
                  <p className="dashboard-card-text"><strong>Location:</strong> {item.latitude}, {item.longitude}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>
                    Received: {new Date(item.created_at).toLocaleString()}
                  </small>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#announcements' && (
          <section id="announcements" className="dashboard-section">
            <h2 className="dash-section-title">Announcements</h2>
            
            {showForm && (
              <div className="dash-modal-overlay">
                <div className="dash-modal-card">
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>New Announcement</h3>
                  <form onSubmit={handleAddItem}>
                    <div className="dash-form-group">
                      <input 
                        type="text" 
                        placeholder="Title" 
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        required
                        className="dash-note-input"
                      />
                    </div>
                    <div className="dash-form-group">
                      <textarea 
                        placeholder="Content" 
                        value={newItem.content}
                        onChange={(e) => setNewItem({...newItem, content: e.target.value})}
                        required
                        className="dash-note-textarea"
                      />
                    </div>
                    <button type="submit" className="dash-btn-submit">Post</button>
                    <button type="button" onClick={() => setShowForm(false)} className="dash-btn-cancel">Cancel</button>
                  </form>
                </div>
              </div>
            )}

            <div className="dash-overview-grid">
              {announcements.map(item => (
                <div key={item.id} className="dashboard-card">
                  <h3 className="dashboard-card-title">{item.title}</h3>
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text">{item.content}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>
                    Posted: {new Date(item.created_at).toLocaleString()}
                  </small>
                </div>
              ))}
            </div>

            <div className="dash-fab-container">
              <button
                type="button"
                className="dash-fab"
                onClick={() => setShowForm(true)}
                aria-label="Add new announcement"
              >
                +
              </button>
            </div>
          </section>
        )}

        {/* Admin-only section */}
        {currentHash === '#manage' && user?.role === 'head' && (
          <section id="manage" className="dashboard-section">
            <h2 className="dash-section-title">Manage Statuses</h2>
            <form className="dash-manage-form" onSubmit={e => e.preventDefault()}>
              <div className="dash-form-row">
                <label htmlFor="emergency" className="dash-form-label">Emergency Status</label>
                <select
                  id="emergency"
                  value={emergencyInput}
                  onChange={e => setEmergencyInput(e.target.value)}
                  className="dash-form-input"
                >
                  <option value="Normal">Normal</option>
                  <option value="High Alert">High Alert</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="dash-form-row">
                <label htmlFor="service" className="dash-form-label">Service Status</label>
                <select
                  id="service"
                  value={serviceInput}
                  onChange={e => setServiceInput(e.target.value)}
                  className="dash-form-input"
                >
                  <option value="Operational">Operational</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Down">Down</option>
                </select>
              </div>

              <div className="dash-form-row">
                <button type="button" className="dash-primary-btn" onClick={applyUpdates}>
                  Update
                </button>
              </div>

              <p className="dash-manage-note">Click "Update" to apply changes to Overview.</p>
            </form>
          </section>
        )}

        {(currentHash === '#notes') && (
          <section id="notes" className="dashboard-section">
            <h2 className="dash-section-title">Notes</h2>
            
            {showForm && (
              <div className="dash-modal-overlay">
                <div className="dash-modal-card">
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>New Note</h3>
                  <form onSubmit={handleAddItem}>
                    <div className="dash-form-group">
                      <input 
                        type="text" 
                        placeholder="Title" 
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        required
                        className="dash-note-input"
                      />
                    </div>
                    <div className="dash-form-group">
                      <textarea 
                        placeholder="Content" 
                        value={newItem.content}
                        onChange={(e) => setNewItem({...newItem, content: e.target.value})}
                        required
                        className="dash-note-textarea"
                      />
                    </div>
                    <div className="dash-form-group">
                      <label style={{display:'block', marginBottom:'5px', color:'#000'}}>Attachments (Max 3):</label>
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileChange}
                        className="dash-note-input"
                      />
                    </div>
                    <button type="submit" className="dash-btn-submit">Submit</button>
                    <button type="button" onClick={() => setShowForm(false)} className="dash-btn-cancel">Cancel</button>
                  </form>
                </div>
              </div>
            )}

            <div className="dash-overview-grid">
              {notes.map(item => (
                <div key={item.id} className="dashboard-card">
                  <h3 className="dashboard-card-title">{item.title}</h3>
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text">{item.content}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>
                    {item.created_at}
                  </small>
                </div>
              ))}
            </div>

            <div className="dash-fab-container">
              <button
                type="button"
                className="dash-fab"
                onClick={() => setShowForm(true)}
                aria-label="Add new note"
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