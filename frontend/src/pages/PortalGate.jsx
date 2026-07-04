import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const mockLogs = [
  "🟢 Telemetry: Dispatcher latency nominal at 12ms.",
  "🚖 Driver dr-204 marked ONLINE near Sector 5.",
  "💳 Billing: Receipt generated for transaction ID: TXN-55291.",
  "⚡ Saga Orchestrator: Multi-service database sync complete.",
  "🟢 Passenger Service: Health state verified [ACTIVE].",
  "🚖 Driver dr-102 accepted ride req-99120."
];

function PortalGate() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      return null;
    }
  });

  // Telemetry Log Rotation State
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogIndex((prev) => (prev + 1) % mockLogs.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // Fare Estimator Form State
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [tier, setTier] = useState('ubergo');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState(null);

  const handleEstimate = (e) => {
    e.preventDefault();
    if (!pickup || !dropoff) return;

    setIsEstimating(true);
    setEstimatedPrice(null);

    // Simulate backend route calculation latency
    setTimeout(() => {
      let baseRate = 80;
      let multiplier = 1.0;

      if (tier === 'uberxl') {
        baseRate = 150;
        multiplier = 1.5;
      } else if (tier === 'moto') {
        baseRate = 40;
        multiplier = 0.6;
      }

      // Generate a mock estimate based on string lengths
      const distance = Math.max(5, (pickup.length + dropoff.length) % 25);
      const minPrice = Math.round((baseRate + distance * 12) * multiplier);
      const maxPrice = Math.round(minPrice + 45);

      setEstimatedPrice({ minPrice, maxPrice, distance, eta: Math.round(distance * 1.5 + 2) });
      setIsEstimating(false);
    }, 850);
  };

  const handleBookRideClick = () => {
    if (currentUser) {
      navigate('/customer');
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      color: '#0f172a'
    }}>
      {/* Navigation Header */}
      <header style={{
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: '#000000', fontSize: '28px', fontWeight: 'bold' }}>local_taxi</span>
          <span style={{ fontSize: '22px', fontWeight: '900', color: '#000000', letterSpacing: '-1px' }}>Uber</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#f1f5f9',
              padding: '6px 14px',
              borderRadius: '12px'
            }}>
              <img src={currentUser.picture} alt={currentUser.name} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1px solid #000000'
              }} />
              <span style={{ fontSize: '13px', fontWeight: '600' }}>{currentUser.name}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#ef4444'
                }}
                title="Sign Out"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
              </button>
            </div>
          ) : (
            <Link to="/login" style={{
              textDecoration: 'none',
              color: '#000000',
              fontSize: '14px',
              fontWeight: '600',
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Live System Log Ticker */}
      <div style={{
        backgroundColor: '#0f172a',
        color: '#38bdf8',
        padding: '10px 40px',
        fontSize: '12px',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10b981' }}>monitoring</span>
          <span>SYSTEM METRIC STREAMS:</span>
        </div>
        <div style={{
          animation: 'slideInText 0.3s ease-out',
          fontWeight: '500',
          flex: 1,
          textAlign: 'center'
        }} key={currentLogIndex}>
          {mockLogs[currentLogIndex]}
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
          ONLINE
        </div>
      </div>

      {/* Hero and Form Container Grid */}
      <main style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 40px',
        background: 'radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '48px',
          width: '100%',
          maxWidth: '1120px',
          alignItems: 'center'
        }}>
          {/* Left Column: Copy & Actions */}
          <div style={{
            textAlign: 'left',
            animation: 'fadeInLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>verified_user</span>
              Google Sign-In Enabled
            </div>
            
            <h1 style={{
              fontSize: '52px',
              fontWeight: '900',
              letterSpacing: '-2.5px',
              color: '#000000',
              lineHeight: '1.05',
              margin: '0 0 20px 0'
            }}>
              Always the ride <br />you want.
            </h1>
            <p style={{
              fontSize: '18px',
              color: '#475569',
              lineHeight: '1.6',
              fontWeight: '400',
              margin: '0 0 36px 0',
              maxWidth: '520px'
            }}>
              Request a ride in seconds, track your driver's real-time coordinate movements on a clean interactive map, and check out with an automated receipt.
            </p>

            <button
              onClick={handleBookRideClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '16px 32px',
                borderRadius: '14px',
                fontWeight: '700',
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              className="cta-button"
            >
              Book your ride now
              <span className="material-symbols-outlined" style={{ fontSize: '20px', marginLeft: '8px' }}>arrow_forward</span>
            </button>
          </div>

          {/* Right Column: Interactive Estimator Card */}
          <div style={{
            animation: 'fadeInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '800',
                margin: '0 0 6px 0',
                color: '#000000',
                letterSpacing: '-0.5px'
              }}>
                Quick Fare Estimator
              </h2>
              <p style={{
                fontSize: '13px',
                color: '#64748b',
                margin: '0 0 24px 0',
                fontWeight: '500'
              }}>
                Calculate simulated trip costs instantly before booking.
              </p>

              <form onSubmit={handleEstimate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Pickup Field */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Pickup Location</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
                    <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px', marginRight: '10px' }}>location_on</span>
                    <input
                      type="text"
                      placeholder="e.g. Bandra Terminus"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a' }}
                      required
                    />
                  </div>
                </div>

                {/* Dropoff Field */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Destination</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '20px', marginRight: '10px' }}>flag</span>
                    <input
                      type="text"
                      placeholder="e.g. Gateway of India"
                      value={dropoff}
                      onChange={(e) => setDropoff(e.target.value)}
                      style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a' }}
                      required
                    />
                  </div>
                </div>

                {/* Vehicle Tier */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Tier Class</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
                    <span className="material-symbols-outlined" style={{ color: '#000000', fontSize: '20px', marginRight: '10px' }}>local_taxi</span>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value)}
                      style={{ border: 'none', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a', fontWeight: '500', cursor: 'pointer' }}
                    >
                      <option value="ubergo">UberGo (Standard Taxi)</option>
                      <option value="uberxl">UberXL (Premium SUV)</option>
                      <option value="moto">Uber Moto (Speedy Ride)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isEstimating}
                  style={{
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    marginTop: '8px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {isEstimating ? 'Routing Subsystems...' : 'Calculate Estimate'}
                </button>
              </form>

              {/* Estimate Results Display */}
              {estimatedPrice && (
                <div style={{
                  marginTop: '24px',
                  padding: '20px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #e0f2fe',
                  borderRadius: '16px',
                  animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>Estimated Price</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0369a1' }}>
                      ₹{estimatedPrice.minPrice} - ₹{estimatedPrice.maxPrice}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#475569', fontWeight: '500', borderTop: '1px dashed #bae6fd', paddingTop: '12px' }}>
                    <div>
                      <strong>EST. DISTANCE:</strong> {estimatedPrice.distance} km
                    </div>
                    <div>
                      <strong>EST. DURATION:</strong> {estimatedPrice.eta} mins
                    </div>
                  </div>

                  <button
                    onClick={handleBookRideClick}
                    style={{
                      width: '100%',
                      marginTop: '16px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0369a1'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
                  >
                    Lock Estimate & Book
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        fontSize: '13px',
        color: '#64748b',
        fontWeight: '500',
        zIndex: 50
      }}>
        &copy; {new Date().getFullYear()} Uber Microservices. All rights reserved.
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInText {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .cta-button:hover {
          transform: translateY(-4px);
          background-color: #222222 !important;
          box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.25) !important;
        }
        .cta-button:active {
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export default PortalGate;
