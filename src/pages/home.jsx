import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/home.css';
import weatherImg from '../assets/weather.png';
import emergencyImg from '../assets/emergency.png';
import serviceImg from '../assets/service.png';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Home = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Home'; }, []);

  // Redirect if not logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

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
    { id: 1, img: weatherImg, title: 'Weather', text: 'Sunny' }, // Static for now
    { id: 2, img: emergencyImg, title: 'Emergency Status', text: 'Loading...' },
    { id: 4, img: serviceImg, title: 'Service Status', text: 'Loading...' },
  ]);

  const updateCardText = (id, newText) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, text: newText } : c)));
  };
  
  useEffect(() => {
    const fetchVillageStatus = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch('http://localhost:5000/api/village_status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          updateCardText(2, data.emergency_status);
          updateCardText(4, data.service_status);
        }
      } catch (e) { console.error("Failed to fetch village status:", e); }
    };
    fetchVillageStatus();
  }, []);

  useEffect(() => {
    if (currentHash === '#emap') {
      fetchSOSRequests();
      fetchReports();
      fetchPolygonZones();
    }
  }, [currentHash]);
  // Get current local datetime string
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  // User location state for map
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

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

  // Update newItem with location when userLocation changes
  useEffect(() => {
    if (userLocation) {
      setNewItem(prev => ({
        ...prev,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      }));
    }
  }, [userLocation]);

  // Reports state
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [files, setFiles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSOSConfirm, setShowSOSConfirm] = useState(false);
  const [newItem, setNewItem] = useState({ 
    title: '', 
    content: '', 
    category: 'Flood', 
    report_date: getCurrentDateTimeLocal(),
    longitude: userLocation ? userLocation.longitude : null,
    latitude: userLocation ? userLocation.latitude : null,
    family_members_affected: ''
  });
  const [sosRequests, setSosRequests] = useState([]);
  const [polygonZones, setPolygonZones] = useState([]);

  const fetchPolygonZones = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/polygons', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Loaded polygons:", data);
        setPolygonZones(data);
      }
    } catch (e) {
      console.error("Failed to fetch polygons:", e);
    }
  };

  const fetchSOSRequests = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/sos_requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSosRequests(data);
      }
    } catch (e) { console.error("Failed to fetch SOS requests:", e); }
  };

  const fetchReports = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mappedReports = data.map(r => {
          // Parse JSON content or fallback
          let parsed = { title: 'Report', category: 'General', description: r.content };
          try {
            const json = JSON.parse(r.content);
            if (json.title) parsed = json;
          } catch (e) {}
          
          return {
            id: r.id,
            title: parsed.title,
            category: parsed.category,
            content: (parsed.description || r.content) + (parsed.family_members_affected ? ` (Family Members Affected: ${parsed.family_members_affected})` : ''),
            report_date: r.report_date ? new Date(r.report_date).toLocaleString() : null,
            longitude: r.longitude,
            latitude: r.latitude,
            created_at: new Date(r.submitted_at).toLocaleString()
          };
        });
        setReports(mappedReports);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
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
    // Hide form on tab switch
    setShowForm(false);
    if (currentHash === '#report') {
      fetchReports();
    }
    if (currentHash === '#announcements') {
      fetchAnnouncements();
    }
  }, [currentHash]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;

    // Serialize content payload
    const contentPayload = JSON.stringify({
      title: newItem.title,
      category: newItem.category,
      description: newItem.content,
      family_members_affected: newItem.family_members_affected,
      longitude: newItem.longitude ? newItem.longitude : null,
      latitude: newItem.latitude ? newItem.latitude : null
    });

    const formData = new FormData();
    formData.append('content', contentPayload);
    formData.append('report_date', newItem.report_date);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('http://localhost:5000/api/submit_report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        setShowForm(false);
        setNewItem({ 
          title: '', 
          content: '', 
          category: 'Flood', 
          report_date: getCurrentDateTimeLocal(),
          longitude: userLocation ? userLocation.longitude : null,
          latitude: userLocation ? userLocation.latitude : null,
          family_members_affected: ''
        });
        setFiles([]);
        fetchReports();
      } else {
        showNotification('Failed to submit report', 'error');
      }
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 3) {
      showNotification("You can only upload up to 3 files.", 'error');
      e.target.value = null;
      setFiles([]);
    } else {
      setFiles(e.target.files);
    }
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

  const confirmSOS = () => {
    setShowSOSConfirm(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const token = localStorage.getItem('token');
        
        try {
          const res = await fetch('http://localhost:5000/api/sos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ latitude, longitude })
          });
          
          if (res.ok) {
            showNotification(`SOS Signal Sent! Location: ${latitude}, ${longitude}`, 'success');
          } else {
            showNotification("Failed to send SOS signal.", 'error');
          }
        } catch (error) {
          console.error("SOS Error:", error);
          showNotification("Error sending SOS signal.", 'error');
        }
      }, (error) => {
        showNotification("Unable to retrieve location for SOS.", 'error');
      });
    } else {
      showNotification("Geolocation is not supported by this browser.", 'error');
    }
  };

  const handleSOS = () => {
    setShowSOSConfirm(true);
  };

  const getStatusColor = (text) => {
    const map = {
      'Normal': '#10b981', 'High Alert': '#f59e0b', 'Critical': '#ef4444',
      'Operational': '#10b981', 'Maintenance': '#f59e0b', 'Down': '#ef4444'
    };
    return map[text] || '#000';
  };

  // Define custom icons
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


  const getTabClass = (hash) => {
    const isActive = currentHash === hash || (hash === '#overview' && currentHash === '');
    return isActive ? 'home-tab active' : 'home-tab';
  };

  return (
    <div className="home-container">
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

      {showSOSConfirm && (
        <div className="home-modal-overlay">
          <div className="home-modal-card">
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#ef4444' }}>EMERGENCY SOS</h3>
            <p>Are you sure you want to send an SOS signal? This will share your current location with emergency services.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowSOSConfirm(false)} 
                className="home-btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmSOS} 
                className="home-btn-submit" 
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                CONFIRM SOS
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="home-sidenav">
        <a href="#overview" className={getTabClass('#overview')}>
          <svg className="home-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Overview
        </a>
        <a href="#report" className={getTabClass('#report')}>
          <svg className="home-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Report
        </a>
        <a href="#announcements" className={getTabClass('#announcements')}>
          <svg className="home-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
          Announcements
        </a>
        <a href="#emap" className={getTabClass('#emap')}>
          <svg className="home-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Emergency Map
        </a>

        <button 
          type="button" 
          className="home-sos-btn" 
          onClick={handleSOS} 
          aria-label="SOS Request" 
        >
          <svg className="home-tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span className="logout-text">SOS Request</span>
        </button>

        <button 
          type="button" 
          className="home-logout-btn" 
          onClick={handleLogout} 
          aria-label="Log out" 
        >
          <svg className="home-tab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logout-text">Log out</span>
        </button>
      </div>

      <main className="home-main-content">
        {(currentHash === '#overview' || currentHash === '') && (
          <section id="overview" className="home-section">
            <h2 className="home-section-title">Overview</h2>
            <div className="home-overview-grid">
              {cards.map(c => (
                <div key={c.id} className="home-card">
                  <img src={c.img} alt={c.title} className="home-card-image" />
                  <h3 className="home-card-title">{c.title}</h3>
                  <div className="home-card-dash" aria-hidden="true" />
                  <p className="home-card-text" style={{ color: getStatusColor(c.text), fontSize: '1.75rem', fontWeight: 'bold' }}>{c.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(currentHash === '#report') && (
          <section id={currentHash.substring(1)} className="home-section">
            <h2 className="home-section-title">Emergency Reports</h2>
            
            {showForm && (
              <div className="home-modal-overlay">
                <div className="home-modal-card">
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>New Report</h3>
                  <form onSubmit={handleAddItem}>
                    <div className="home-form-group">
                      <select 
                        value={newItem.category}
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                        className="home-form-select"
                      >
                        <option value="Flood">Flood</option>
                        <option value="Fire">Fire</option>
                        <option value="Landslide">Landslide</option>
                        <option value="Storm">Storm</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="home-form-group">
                      <input 
                        type="text" 
                        placeholder="Household Name" 
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        required
                        className="home-form-input"
                      />
                    </div>
                    <div className="home-form-group">
                      <input 
                        type="number" 
                        placeholder="Number of Family Members Affected" 
                        value={newItem.family_members_affected}
                        onChange={(e) => setNewItem({...newItem, family_members_affected: e.target.value})}
                        className="home-form-input"
                        min="1"
                      />
                    </div>
                    <div className="home-form-group">
                      <label style={{display:'block', marginBottom:'5px', color:'#000'}}>Location:</label>
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
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker 
                            position={[userLocation.latitude, userLocation.longitude]}
                            draggable={true}
                            eventHandlers={{
                              dragend: (e) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                setUserLocation({ latitude: position.lat, longitude: position.lng });
                                setNewItem({...newItem, latitude: position.lat, longitude: position.lng});
                              },
                            }}
                          >
                            <Popup>
                              Your Location <br /> Lat: {userLocation.latitude.toFixed(4)}, Lng: {userLocation.longitude.toFixed(4)}
                            </Popup>
                          </Marker>
                        </MapContainer>
                      )}
                    </div>
                    <div className="home-form-group">
                      <label style={{display:'block', marginBottom:'5px', color:'#000'}}>Incident Date/Time:</label>
                      <input 
                        type="datetime-local"
                        value={newItem.report_date}
                        onChange={(e) => setNewItem({...newItem, report_date: e.target.value})}
                        className="home-form-input"
                      />
                    </div>
                    <div className="home-form-group">
                      <label style={{display:'block', marginBottom:'5px', color:'#000'}}>Attachments (Max 3):</label>
                      <input 
                        type="file" 
                        multiple 
                        onChange={handleFileChange}
                        className="home-form-input"
                      />
                    </div>
                    <div className="home-form-group">
                      <textarea 
                        placeholder="Details of damage, assistance needed, etc." 
                        value={newItem.content}
                        onChange={(e) => setNewItem({...newItem, content: e.target.value})}
                        required
                        className="home-form-textarea"
                      />
                    </div>
                    <button type="submit" className="home-btn-submit">Submit</button>
                    <button type="button" onClick={() => setShowForm(false)} className="home-btn-cancel">Cancel</button>
                  </form>
                </div>
              </div>
            )}

            <div className="home-overview-grid">
              {reports.map(item => (
                <div key={item.id} className="home-card home-card-border-red">
                  <h3 className="home-card-title home-card-title-blue">{item.title}</h3>
                  {item.category && <small style={{ color: '#d9534f', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{item.category}</small>}
                  <div className="home-card-dash" aria-hidden="true" />
                  <p className="home-card-text">{item.content}</p>
                  {item.report_date && <small style={{ display: 'block', marginTop: '10px', color: '#000', fontSize: '0.8em' }}>Incident: {item.report_date}</small>}
                  <small style={{ display: 'block', marginTop: '10px', color: '#000', fontSize: '0.8em' }}>
                    Submitted: {item.created_at}
                  </small>
                </div>
              ))}
            </div>
            <div className="home-fab-container">
              <button
                type="button"
                className="home-fab"
                onClick={() => setShowForm(true)}
                aria-label="Add new"
              >
                +
              </button>
            </div>
          </section>
        )}

        {currentHash === '#announcements' && (
          <section id="announcements" className="home-section">
            <h2 className="home-section-title">Announcements</h2>
            <div className="home-overview-grid">
              {announcements.map(item => (
                <div key={item.id} className="home-card">
                  <h3 className="home-card-title">{item.title}</h3>
                  <div className="home-card-dash" aria-hidden="true" />
                  <p className="home-card-text">{item.content}</p>
                  <small style={{ display: 'block', marginTop: '10px', color: '#000', fontSize: '0.8em' }}>
                    Posted: {new Date(item.created_at).toLocaleString()}
                  </small>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentHash === '#emap' && (
          <section id="emap" className="home-section">
            <h2 className="home-section-title">Emergency Map</h2>
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
                style={{ height: '900px', width: '100%', borderRadius: '8px' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
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
              {polygonZones.map(poly => {
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
                    </Popup>
                  </Polygon>
                );
              })}
              </MapContainer>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default Home;