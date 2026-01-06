import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/super.css';
import weatherImg from '../assets/weather.png';
import emergencyImg from '../assets/emergency.png';
import reportsImg from '../assets/reports.png';
import serviceImg from '../assets/service.png';

const Super = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { document.title = 'Supervisor Dashboard'; }, []);

  // Auth check for 'super' role
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!storedUser || !token) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'super') {
      // If role is not super, deny access and redirect
      localStorage.clear();
      navigate('/login');
      return;
    }

    const fetchInitialData = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/villages', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const allVillages = await res.json();
          if (parsedUser.village_ids && parsedUser.village_ids.length > 0) {
            const userVillages = allVillages.filter(v => parsedUser.village_ids.includes(v.id));
            setAccessibleVillages(userVillages);
            if (userVillages.length > 0) {
              setSelectedVillageId(userVillages[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch villages", e);
      }
    };

    setUser(parsedUser);    fetchInitialData();

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
  const [sosRequests, setSosRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [accessibleVillages, setAccessibleVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '' });

  const [overviewCards, setOverviewCards] = useState([
    { id: 1, img: weatherImg, title: 'Weather', text: 'Loading...' },
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Loading...' },
    { id: 3, img: reportsImg, title: "Today's Reports", text: 'Loading...' },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Loading...' },
  ]);

  const updateCardText = (id, newText) => {
    setOverviewCards(prev => prev.map(c => (c.id === id ? { ...c, text: newText } : c)));
  };

  const getStatusColor = (text) => {
    const map = {
      'Normal': '#10b981', 'High Alert': '#f59e0b', 'Critical': '#ef4444',
      'Operational': '#10b981', 'Maintenance': '#f59e0b', 'Down': '#ef4444'
    };
    return map[text] || '#000';
  };

  const fetchAnnouncements = async (villageId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:5000/api/announcements?village_id=${villageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchSOSRequests =  async (villageId) => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`http://localhost:5000/api/sos_requests?village_id=${villageId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setSosRequests(data))
      .catch(err => console.error(err));
    }
  };

  const resolveSOS = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    await fetch(`http://localhost:5000/api/sos_requests/${id}/resolve`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    setSosRequests(prev => prev.map(sos => sos.id === id ? { ...sos, status: 'Resolved' } : sos));
  };

  const refreshSOS = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    await fetch('http://localhost:5000/api/sos_requests/cleanup', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    fetchSOSRequests(selectedVillageId);
  };

  const fetchReports = async (villageId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/reports?village_id=${villageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('Failed to fetch reports:', res.status);
        return;
      }

      const data = await res.json();
      const mapped = data.map(r => {
        let parsed = { title: 'Report', category: '', description: r.content };
        try { parsed = JSON.parse(r.content); } catch {}

        return {
          id: r.id,
          title: parsed.title || 'Villager Report',
          category: parsed.category || 'General',
          content: parsed.description || r.content,
          created_at: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'No Date'
        };
      });
      setReports(mapped);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  useEffect(() => {
    if (!selectedVillageId) return;

    const villageName = accessibleVillages.find(v => v.id === parseInt(selectedVillageId))?.name || '';

    const fetchOverviewData = async () => {
      const token = localStorage.getItem('token');
      try {
        const statusRes = await fetch(`http://localhost:5000/api/village_status?village_id=${selectedVillageId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (statusRes.ok) {
          const data = await statusRes.json();
          updateCardText(2, data.emergency_status);
          updateCardText(3, (data.todays_reports || 0).toString());
          updateCardText(4, data.service_status);
        }
        if (villageName) {
          const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(villageName + ', Malaysia')}?format=%C+%t`);
          if (weatherRes.ok) {
            const text = await weatherRes.text();
            updateCardText(1, text.trim());
          }
        }
      } catch (e) { console.error("Failed to fetch overview data", e); }
    };

    if (currentHash === '#overview' || currentHash === '') {
      fetchOverviewData();
    }
    if (currentHash === '#reports') fetchReports(selectedVillageId);
    if (currentHash === '#urgent') fetchSOSRequests(selectedVillageId);
    if (currentHash === '#announcements') fetchAnnouncements(selectedVillageId);

  }, [selectedVillageId, currentHash, accessibleVillages]);

  const handleResolveReport = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/reports/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: true } : r));
        showNotification("Report marked as resolved!");
      }
    } catch (err) {
      showNotification("Failed to resolve report", "error");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token || currentHash !== '#announcements') return;

    try {
      const res = await fetch('http://localhost:5000/api/submit_announcement', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          title: newItem.title,
          content: newItem.content,
          // Send selected village ID. Can be null for global announcement.
          village_id: selectedVillageId
        })
      });
      if (res.ok) {
        setShowForm(false); 
        setNewItem({ title: '', content: '' });
        fetchAnnouncements(selectedVillageId);
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
        <div style={{ padding: '20px 10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
           <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>VEMS</h2>
           <p style={{ color: '#cbd5e1', margin: '5px 0 0', fontSize: '0.9rem' }}>Supervisor</p>
        </div>
        <div className="dash-village-selector">
            <label htmlFor="village-select">Viewing Village:</label>
            <select 
                id="village-select" 
                value={selectedVillageId} 
                onChange={e => {
                  const newId = e.target.value;
                  setSelectedVillageId(newId);
                  const v = accessibleVillages.find(v => v.id.toString() === newId);
                  if (v) showNotification(`Switched to ${v.name}`);
                }}
            >
                {accessibleVillages.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                ))}
            </select>
        </div>
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

        <button type="button" className="dash-logout-btn" onClick={handleLogout} aria-label="Log out">
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
              {overviewCards.map(c => (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="dash-section-title" style={{ margin: 0 }}>Emergency Reports</h2>
              <button onClick={() => fetchReports(selectedVillageId)} className="dash-btn-refresh">Refresh List</button>
            </div>
            <div className="dash-overview-grid">
              {reports.map(item => (
                <div key={item.id} className={`dashboard-card ${item.resolved ? 'resolved-success' : ''}`} style={{ borderLeft: item.resolved ? '5px solid #22c55e' : '5px solid #d9534f' }}>
                  <h3 className="dashboard-card-title">{item.title}</h3>
                  {item.category && <small style={{ color: item.resolved ? '#22c55e' : '#d9534f', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{item.category}</small>}
                  <div className="dashboard-card-dash" aria-hidden="true" />
                  <p className="dashboard-card-text">{item.description || item.content}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>{item.created_at}</small>
                  {!item.resolved && <button className="resolve-btn" onClick={() => handleResolveReport(item.id)}>Mark as Resolved</button>}
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#urgent' && (
          <section id="urgent" className="dashboard-section">
            <h2 className="dash-section-title">Urgent SOS Requests</h2>
            <button className="dash-primary-btn" style={{ marginBottom: '20px' }} onClick={refreshSOS}>Refresh</button>
            <div className="dash-overview-grid">
              {sosRequests.map(item => (
                <div key={item.id} className={`dashboard-card ${item.status === 'Resolved' ? 'sos-resolved' : 'sos-active'}`}>
                  <h3 className="dashboard-card-title" style={{ color: item.status === 'Resolved' ? '#16a34a' : '#ef4444' }}>
                    {item.status === 'Resolved' ? 'SOS RESOLVED' : 'SOS SIGNAL'}
                  </h3>
                  <div className="dashboard-card-dash" />
                  <p><strong>User ID:</strong> {item.user_id}</p>
                  <p><strong>Location:</strong> {item.latitude}, {item.longitude}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#666' }}>Received: {new Date(item.created_at).toLocaleString()}</small>
                  {item.status !== 'Resolved' && <button className="dash-btn-submit" style={{ marginTop: '10px' }} onClick={() => resolveSOS(item.id)}>Resolve</button>}
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
                      <input type="text" placeholder="Title" value={newItem.title} onChange={(e) => setNewItem({...newItem, title: e.target.value})} required className="dash-note-input" />
                    </div>
                    <div className="dash-form-group">
                      <textarea placeholder="Content" value={newItem.content} onChange={(e) => setNewItem({...newItem, content: e.target.value})} required className="dash-note-textarea" />
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
                  <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>Posted: {new Date(item.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
            <div className="dash-fab-container">
              <button type="button" className="dash-fab" onClick={() => setShowForm(true)} aria-label="Add new announcement">+</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Super;