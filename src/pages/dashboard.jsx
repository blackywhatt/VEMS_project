import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/dashboard.css';
import weatherImg from '../assets/weather.png';
import emergencyImg from '../assets/emergency.png';
import reportsImg from '../assets/reports.png';
import serviceImg from '../assets/service.png';
import { MapContainer, TileLayer, Marker, Popup, FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';


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

  // Get current local datetime string
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

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
  const [savedPolygons, setSavedPolygons] = useState([]);
  const [newPolygon, setNewPolygon] = useState({ 
      category: 'Caution',
      polygonData: null,
      createdAt: getCurrentDateTimeLocal(),
    });

  // WhatsApp Popup State
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState(''); // Store content to send

  // Map variables
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [polygonLayer, setPolygonLayer] = useState(null);
  const [drawnItems, setDrawnItems] = useState(null);
  const redIcon = new L.Icon({
    iconUrl:
      "https://www.clker.com/cliparts/k/a/2/B/c/u/map-marker-red-md.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  const orangeIcon = new L.Icon({
    iconUrl:
      "https://www.clker.com/cliparts/e/i/N/V/q/J/map-marker-soft-orange-2-md.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Handle polygon drawing
  const handleDrawCreated = (e) => {
    const layer = e.layer;
    setPolygonLayer(layer);
    setNewPolygon({
      ...newPolygon,
      polygonData: layer.toGeoJSON(),
      createdAt: getCurrentDateTimeLocal()
    });
    console.log("Polygon drawn:", layer.toGeoJSON());
  };

  const savePolygonToDb = async () => {
    const token = localStorage.getItem('token');
    if (!token || !polygonLayer) {
      showNotification('No polygon to save', 'error');
      return;
    }

    if (!newPolygon.category) {
      showNotification('Please select a category', 'error');
      return;
    }

    try {
      const polygonGeoJSON = polygonLayer.toGeoJSON();
      const res = await fetch('http://localhost:5000/api/polygons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category: newPolygon.category,
          polygon_data: polygonGeoJSON
        })
      });

      if (res.ok) {
        showNotification('Polygon saved successfully!', 'success');
        setNewPolygon({ 
          category: '',
          polygonData: null,
          createdAt: getCurrentDateTimeLocal(),
        });
        if (polygonLayer) {
          polygonLayer.closePopup();
        }
        setPolygonLayer(null);
        fetchPolygons();
      } else {
        showNotification('Failed to save polygon', 'error');
      }
    } catch (e) {
      console.error("Error saving polygon:", e);
      showNotification('Error saving polygon', 'error');
    }
  };

  const fetchPolygons = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/polygons', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded polygons:", data);
        setSavedPolygons(data);
      }
    } catch (e) {
      console.error("Failed to fetch polygons:", e);
    }
  };

  const handleDeletePolygon = async (polygonId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Unauthorized', 'error');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/polygons/${polygonId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showNotification('Polygon deleted successfully!', 'success');
        // Close all popups
        document.querySelectorAll('.leaflet-popup-close-button').forEach(btn => btn.click());
        fetchPolygons();
      } else {
        showNotification('Failed to delete polygon', 'error');
      }
    } catch (e) {
      console.error("Error deleting polygon:", e);
      showNotification('Error deleting polygon', 'error');
    }
  };

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

  const fetchSOSRequests =  async () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('http://localhost:5000/api/sos_requests', {
          headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setSosRequests(data))
      .catch(err => console.error(err));
    }
  };

// ✅ Resolve SOS (turn green)
const resolveSOS = async (id) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  await fetch(`http://localhost:5000/api/sos_requests/${id}/resolve`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  // Update UI instantly
  setSosRequests(prev =>
    prev.map(sos =>
      sos.id === id ? { ...sos, status: 'Resolved' } : sos
    )
  );
};

// ✅ Refresh (delete resolved SOS)
const refreshSOS = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  await fetch('http://localhost:5000/api/sos_requests/cleanup', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  fetchSOSRequests();
};

  const fetchReports = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch('http://localhost:5000/api/reports', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.error('Failed to fetch reports:', res.status);
      return;
    }

    const data = await res.json();
    console.log("REPORT DATA:", data); // 👈 TEMP DEBUG

    const mapped = data.map(r => {
  // Your existing JSON parsing logic
  let parsed = { title: 'Report', category: '', description: r.content };
  try { parsed = JSON.parse(r.content); } catch {}

  return {
    id: r.id,
    title: parsed.title || 'Villager Report',
    category: parsed.category || 'General',
    content: parsed.description || r.content,
    longitude: r.longitude,
    latitude: r.latitude,
    // FIX: Change created_at to submitted_at to match the Backend
    created_at: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'No Date'
  };
});

    setReports(mapped);
  } catch (err) {
    console.error('Error fetching reports:', err);
  }
};

  useEffect(() => {
    if (currentHash ===  '#manage') {
      fetchSOSRequests();
      fetchReports();
      fetchPolygons();
    }
  }, [currentHash]);

  useEffect(() => {
      // Check if the browser supports the Geolocation API
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser');
        // Set default location
        setUserLocation({ latitude: 51.505, longitude: -0.09 });
        return;
      }
  
      // Success callback function
      const successHandler = (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      };
  
      // Error callback function
      const errorHandler = (err) => {
        setLocationError(err.message);
        // Set default location if geolocation fails
        setUserLocation({ latitude: 51.505, longitude: -0.09 });
      };
  
      // Request the user's current position
      navigator.geolocation.getCurrentPosition(successHandler, errorHandler);
    }, []);

  useEffect(() => {
    // Fetch data
    const token = localStorage.getItem('token');
    if (token) {
        fetchReports();
        fetchNotes();
        fetchAnnouncements();
    }
  }, [currentHash]);

  useEffect(() => {
    if (currentHash === '#urgent') {
      fetchSOSRequests();
    }
  }, [currentHash]);

const handleResolveReport = async (id) => {
  try {
    const response = await fetch(`http://localhost:5000/api/reports/${id}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      // Set a local state to turn the report green before it's refreshed away
      setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: true } : r));
      showNotification("Report marked as resolved!");
    }
  } catch (err) {
    showNotification("Failed to resolve report", "error");
  }
};

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
        updateCardText(3, (data.todays_reports || 0).toString());
      }
    } catch (e) { console.error(e); }
  };

  const [cards, setCards] = useState(() => [
    { id: 1, img: weatherImg, title: 'Weather', text: 'Loading...' },
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Loading...' },
    { id: 3, img: reportsImg, title: "Today's Reports", text: 'Loading...' },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Loading...' },
  ]);

  const updateCardText = (id, newText) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, text: newText } : c)));
  };

  const fetchWeather = async (villageName) => {
    try {
      // Fetch weather condition (%C) and temperature (%t)
      const res = await fetch(`https://wttr.in/${encodeURIComponent(villageName + ', Malaysia')}?format=%C+%t`);
      if (res.ok) {
        const text = await res.text();
        updateCardText(1, text.trim());
      } else {
        updateCardText(1, 'Unavailable');
      }
    } catch (e) {
      console.error("Weather fetch failed:", e);
      updateCardText(1, 'Unavailable');
    }
  };

  useEffect(() => {
    if (user) {
      if (user.village_name) {
        fetchWeather(user.village_name);
      } else {
        updateCardText(1, 'Unavailable');
      }
    }
  }, [user]);

  useEffect(() => {
    fetchVillageStatus();
  }, []);

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
      } else {
        const data = await res.json();
        showNotification(data.message || 'Failed to submit note', 'error');
      }
    } catch (e) { console.error(e); }
  };

  const handleSendWhatsApp = async () => {
      const token = localStorage.getItem('token');
      showNotification('Starting WhatsApp automation... Do not move mouse!', 'warning');
      setShowWhatsAppPopup(false); // Close popup immediately

      try {
        const res = await fetch('http://localhost:5000/api/broadcast_whatsapp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: lastAnnouncement
          })
        });

        const data = await res.json();
        if (res.ok) {
          showNotification(data.message, 'success');
        } else {
          showNotification('WhatsApp failed: ' + data.message, 'error');
        }
      } catch (e) {
        console.error(e);
        showNotification('Server error sending WhatsApp', 'error');
      }
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
        //Whatsapp
        const messageText = `*⚠️ VEMS STATUS UPDATE ⚠️*\n\n🚨 Emergency Level: ${emergencyInput}\n🛠 Service Status: ${serviceInput}`;
        setLastAnnouncement(messageText);
        setShowWhatsAppPopup(true);
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
        <div style={{ padding: '20px 10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
           <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem' }}>VEMS</h2>
           {user?.village_name && <p style={{ color: '#cbd5e1', margin: '5px 0 0', fontSize: '0.9rem' }}>{user.village_name}</p>}
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h2 className="dash-section-title" style={{ margin: 0 }}>Emergency Reports</h2>
      <button onClick={fetchReports} className="dash-btn-refresh">
        Refresh List
      </button>
    </div>

    <div className="dash-overview-grid">
      {reports.map(item => (
        <div 
          key={item.id} 
          className={`dashboard-card ${item.resolved ? 'resolved-success' : ''}`} 
          style={{ borderLeft: item.resolved ? '5px solid #22c55e' : '5px solid #d9534f' }}
        >
          <h3 className="dashboard-card-title">{item.title}</h3>
          {item.category && (
            <small style={{ color: item.resolved ? '#22c55e' : '#d9534f', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
              {item.category}
            </small>
          )}
          <div className="dashboard-card-dash" aria-hidden="true" />
          <p className="dashboard-card-text">{item.description || item.content}</p>
          <small style={{ display: 'block', marginTop: '10px', color: '#666', fontSize: '0.95em' }}>
            {item.timestamp || item.created_at}
          </small>

          {!item.resolved && (
            <button 
              className="resolve-btn"
              onClick={() => handleResolveReport(item.id)}
            >
              Mark as Resolved
            </button>
          )}
        </div>
      ))}
    </div>
  </section>
)}

        {currentHash === '#urgent' && (
  <section id="urgent" className="dashboard-section">
    <h2 className="dash-section-title">Urgent SOS Requests</h2>

    {/* Refresh button */}
    <button
      className="dash-primary-btn"
      style={{ marginBottom: '20px' }}
      onClick={refreshSOS}
    >
      Refresh
    </button>

    <div className="dash-overview-grid">
      {sosRequests.map(item => (
        <div
          key={item.id}
          className={`dashboard-card ${
            item.status === 'Resolved' ? 'sos-resolved' : 'sos-active'
          }`}
        >
          <h3
            className="dashboard-card-title"
            style={{ color: item.status === 'Resolved' ? '#16a34a' : '#ef4444' }}
          >
            {item.status === 'Resolved' ? 'SOS RESOLVED' : 'SOS SIGNAL'}
          </h3>

          <div className="dashboard-card-dash" />

          <p><strong>User ID:</strong> {item.user_id}</p>
          <p><strong>Location:</strong> {item.latitude}, {item.longitude}</p>

          <small style={{ display: 'block', marginTop: '10px', color: '#666' }}>
            Received: {new Date(item.created_at).toLocaleString()}
          </small>

          {item.status !== 'Resolved' && (
            <button
              className="dash-btn-submit"
              style={{ marginTop: '10px' }}
              onClick={() => resolveSOS(item.id)}
            >
              Resolve
            </button>
          )}
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
            <h2 className="dash-section-title" style={{ marginTop: '40px' }}>Emergency Map</h2>
            {locationError && (
              <p style={{ color: '#f59e0b', marginBottom: '10px' }}>
                Location access denied. Showing default location.
              </p>
            )}
            {!userLocation ? (
              <p>Loading map...</p>
            ) : (
              <MapContainer 
                center={[userLocation.latitude, userLocation.longitude]} 
                zoom={13} 
                scrollWheelZoom={true}
                style={{ height: '440px', width: '100%', borderRadius: '8px' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FeatureGroup ref={setDrawnItems}>
                  <EditControl
                    position="topright"
                    onCreated={handleDrawCreated}
                    draw={{
                      rectangle: false,
                      polygon: true,
                      polyline: false,
                      circle: false,
                      marker: false,
                      circlemarker: false
                    }}
                    edit={{
                      edit: false,
                      remove: false
                    }}
                  />
                  <Popup>
                    <div>
                      <select 
                        value={newPolygon.category}
                        onChange={(e) => setNewPolygon({...newPolygon, category: e.target.value})}
                        style={{ height: '30px' }}
                      >
                        <option value="Caution" >Caution</option>
                        <option value="Danger">Danger</option>
                      </select>
                    </div>
                    
                    <button type="button" onClick={savePolygonToDb} className="home-btn-submit" style={{ marginTop: '10px' }}>Save</button>
                  </Popup>
                </FeatureGroup>
                {reports.map(item => (
                <div key={item.id} className="map-report-marker">
                  {item.latitude && item.longitude && (
                    <Marker position={[item.latitude, item.longitude]} icon={orangeIcon}>
                      <Popup>
                        <strong>{item.title}</strong><br />
                        {item.content}<br />
                        {item.report_date && <>Incident: {item.report_date}<br /></>}
                        Submitted: {item.created_at}
                      </Popup>
                    </Marker>
                  )}
                </div>
              ))}
                {sosRequests.map(sos => (
                <div key={sos.id} className="map-sos-marker">
                  {sos.latitude && sos.longitude && (
                    <Marker position={[sos.latitude, sos.longitude]} icon={redIcon}>
                      <Popup>
                        <strong>SOS Request</strong><br />
                        Sent At: {new Date(sos.created_at).toLocaleString()}
                      </Popup>
                    </Marker>
                  )}
                </div>
              ))}
                {savedPolygons.map(poly => {
                  if (!poly.polygon_data || !poly.polygon_data.geometry) return null;
                  const coordinates = poly.polygon_data.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  return (
                    <Polygon
                      key={poly.id}
                      positions={coordinates}
                      pathOptions={{
                        color: poly.category === 'Danger' ? '#ef4444' : '#f59e0b',
                        fillColor: poly.category === 'Danger' ? '#ef4444' : '#f59e0b',
                        fillOpacity: 0.3
                      }}
                    >
                      <Popup>
                        <strong>{poly.category} Zone</strong><br />
                        Created: {new Date(poly.created_at).toLocaleString()}
                        <div>
                          <button onClick={() => handleDeletePolygon(poly.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '3px 12px', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' }}>Delete</button>
                        </div>
                        
                      </Popup>
                    </Polygon>
                  );
                })}
              </MapContainer>
            )}
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

        {/* WhatsApp Confirmation Popup */}
        {showWhatsAppPopup && (
          <div className="dash-modal-overlay">
            <div className="dash-modal-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📱</div>
              <h3 style={{ marginTop: 0 }}>Broadcast Alert?</h3>
              <p>Do you want to broadcast this <b>Status Update</b> to all villagers?</p>
              <p style={{ fontSize: '0.9em', color: '#666' }}>
                (Note: This will open WhatsApp Web on the server)
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  onClick={handleSendWhatsApp}
                  className="dash-btn-submit"
                  style={{ backgroundColor: '#10b981' }}
                >
                  Yes, Send Alert
                </button>
                <button
                  onClick={() => setShowWhatsAppPopup(false)}
                  className="dash-btn-cancel"
                >
                  No, Skip
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;