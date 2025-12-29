import React, { useEffect, useState } from 'react';
import '../style/home.css';

const Home = () => {
  useEffect(() => { document.title = 'home'; }, []);

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
    { id: 1, img: 'src/assets/weather.png', title: 'Weather', text: 'Sunny' },
    { id: 2, img: 'src/assets/emergency.png', title: 'Emergency Status', text: 'Normal' },
    { id: 4, img: 'src/assets/service.png', title: 'Service Status', text: 'Maintenance' },
  ]);



  const handleLogout = () => {
    alert('Logged out');
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