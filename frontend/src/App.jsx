import React, { useState, useEffect } from 'react';
import apiClient from './api/apiClient';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Helper component to dynamically re-center map
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

// Generate premium neon markers for Leaflet to bypass asset loading bugs in bundlers
const createDivIcon = (iconName, color) => {
  return L.divIcon({
    html: `<div style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px; background: rgba(5, 20, 36, 0.85); border: 1.5px solid ${color}; border-radius: 50%; box-shadow: 0 0 10px ${color};"><span class="material-symbols-outlined" style="color: ${color}; font-size: 16px; font-weight: bold;">${iconName}</span></div>`,
    className: 'custom-leaflet-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const carIcon = createDivIcon('local_taxi', '#7bd0ff'); // Neon Cyan
const pickupIcon = createDivIcon('location_on', '#10b981'); // Neon Green
const dropoffIcon = createDivIcon('flag', '#ef4444'); // Neon Red

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  // Real-time telemetry coordinates cache for drivers
  const [driverLocations, setDriverLocations] = useState({});

  // Subsystem health states
  const [health, setHealth] = useState({
    gateway: 'checking',
    passenger: 'checking',
    driver: 'checking',
    billing: 'checking'
  });

  // Localized alert states
  const [alertError, setAlertError] = useState(null);
  
  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    passengerId: 'p1',
    pickup: '',
    dropoff: ''
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // New Driver Form State
  const [driverForm, setDriverForm] = useState({
    id: '',
    name: '',
    location: ''
  });
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverSuccess, setDriverSuccess] = useState(null);

  // Completion Form State
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionSuccess, setCompletionSuccess] = useState(null);

  // Active Ride tracking states for Saga visualization
  const [trackingRideId, setTrackingRideId] = useState(null);
  const [trackedRide, setTrackedRide] = useState(null);
  const [showTracker, setShowTracker] = useState(false);

  // Network stats simulation for dashboard telemetry
  const [latency, setLatency] = useState(14);

  // Map settings
  const defaultCenter = [19.0760, 72.8777]; // Mumbai Coordinates
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Fetch all data
  const fetchData = async (showSilently = false) => {
    if (!showSilently) {
      setAlertError(null);
    }

    const startTime = Date.now();

    // 1. Health checks
    try {
      const res = await apiClient.get('/gateway-health');
      setHealth(prev => ({ ...prev, gateway: res.status === 200 ? 'healthy' : 'unhealthy' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, gateway: 'unhealthy' }));
    }

    try {
      const res = await apiClient.get('/api/v1/passenger/health');
      setHealth(prev => ({ ...prev, passenger: res.status === 200 ? 'healthy' : 'unhealthy' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, passenger: 'unhealthy' }));
    }

    try {
      const res = await apiClient.get('/api/v1/driver/health');
      setHealth(prev => ({ ...prev, driver: res.status === 200 ? 'healthy' : 'unhealthy' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, driver: 'unhealthy' }));
    }

    try {
      const res = await apiClient.get('/api/v1/billing/health');
      setHealth(prev => ({ ...prev, billing: res.status === 200 ? 'healthy' : 'unhealthy' }));
    } catch (e) {
      setHealth(prev => ({ ...prev, billing: 'unhealthy' }));
    }

    // Measure simulation response latency
    setLatency(Math.min(150, Math.max(8, Date.now() - startTime + Math.floor(Math.random() * 12))));

    // 2. Fetch Active Deployments / Ride requests
    try {
      const res = await apiClient.get('/api/v1/passenger/rides');
      setRides(res.data);
    } catch (e) {
      console.error(e);
      if (!showSilently) {
        setAlertError(e.userFriendlyMessage || 'Could not load ride deployment logs.');
      }
    }

    // 3. Fetch Drivers
    try {
      const res = await apiClient.get('/api/v1/driver/drivers');
      setDrivers(res.data);
    } catch (e) {
      console.error(e);
      if (!showSilently) {
        setAlertError(e.userFriendlyMessage || 'Could not load the fleet registry.');
      }
    }

    // 4. Fetch Invoices
    try {
      const res = await apiClient.get('/api/v1/billing/invoices');
      setInvoices(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Initial load and periodic polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Stateful WebSocket live subscription for telemetry
  useEffect(() => {
    const socket = io('http://localhost:3005');
    
    socket.on('connect', () => {
      console.log('🔌 [WebSocket Client] Connected to Telemetry Stream on port 3005');
    });

    // Subcribe location listeners dynamically based on loaded drivers
    drivers.forEach(driver => {
      socket.off(`location.${driver.id}`);
      socket.on(`location.${driver.id}`, (data) => {
        setDriverLocations(prev => ({
          ...prev,
          [driver.id]: {
            lat: data.latitude,
            lng: data.longitude,
            name: driver.name,
            updated: data.updated
          }
        }));

        // Dynamically focus map to active vehicle coordinate if tracking
        if (trackedRide && trackedRide.driverId === driver.id && trackedRide.status === 'ACCEPTED') {
          setMapCenter([data.latitude, data.longitude]);
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [drivers, trackedRide]);

  // Short-polling loop to track the newly requested ride status
  const pollActiveRide = async (requestId) => {
    let attempts = 0;
    const maxAttempts = 15;
    
    const poll = async () => {
      try {
        const res = await apiClient.get(`/api/v1/passenger/rides/${requestId}`);
        const ride = res.data;
        setTrackedRide(ride);

        if (ride.status === 'ACCEPTED' || ride.status === 'FAILED') {
          fetchData(true);
          return;
        }
      } catch (e) {
        console.error('Single ride polling error:', e);
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 1500);
      } else {
        setTrackedRide(prev => prev ? { ...prev, status: 'TIMEOUT' } : null);
      }
    };

    poll();
  };

  // Handle ride request submission
  const handleRequestRide = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingSuccess(null);
    setAlertError(null);

    if (!bookingForm.pickup || !bookingForm.dropoff) {
      setAlertError('Please define both dispatch starting point and drop-off terminal.');
      setBookingLoading(false);
      return;
    }

    try {
      const res = await apiClient.post('/api/v1/passenger/rides/request', {
        passengerId: bookingForm.passengerId,
        pickup: bookingForm.pickup,
        dropoff: bookingForm.dropoff
      });
      
      const reqId = res.data.requestId;
      setBookingSuccess(res.data.message || 'Ride request submitted successfully!');
      
      // Initialize matching tracker overlay
      setTrackingRideId(reqId);
      setTrackedRide({
        requestId: reqId,
        passengerId: bookingForm.passengerId,
        pickup: bookingForm.pickup,
        dropoff: bookingForm.dropoff,
        status: 'PENDING'
      });
      setShowTracker(true);

      // Trigger short polling loop
      pollActiveRide(reqId);

      // Reset form fields
      setBookingForm(prev => ({ ...prev, pickup: '', dropoff: '' }));
    } catch (e) {
      console.error(e);
      setAlertError(e.userFriendlyMessage || 'Failed to dispatch deployment request.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Handle driver registration submission
  const handleRegisterDriver = async (e) => {
    e.preventDefault();
    setDriverLoading(true);
    setDriverSuccess(null);
    setAlertError(null);

    if (!driverForm.id || !driverForm.name || !driverForm.location) {
      setAlertError('Please fill out all fields: Driver ID, Name, and Initial Location.');
      setDriverLoading(false);
      return;
    }

    try {
      const res = await apiClient.post('/api/v1/driver/drivers', {
        id: driverForm.id,
        name: driverForm.name,
        location: driverForm.location
      });

      setDriverSuccess(`Driver ${res.data.name} successfully registered.`);
      setDriverForm({ id: '', name: '', location: '' });
      
      // Refresh driver list
      fetchData(true);
    } catch (e) {
      console.error(e);
      setAlertError(e.userFriendlyMessage || 'Failed to register the driver.');
    } finally {
      setDriverLoading(false);
    }
  };

  // Handle trip completion
  const handleCompleteTrip = async (requestId, driverId) => {
    setCompletionLoading(true);
    setCompletionSuccess(null);
    setAlertError(null);

    try {
      const res = await apiClient.post('/api/v1/driver/rides/complete', {
        requestId,
        driverId
      });
      
      setCompletionSuccess(`Deployment finished: ${res.data.message}`);
      
      // Clear driver real-time coordinates to reset map position
      setDriverLocations(prev => {
        const next = { ...prev };
        delete next[driverId];
        return next;
      });

      // Refresh lists immediately
      setTimeout(() => fetchData(true), 500);
    } catch (e) {
      console.error(e);
      setAlertError(e.userFriendlyMessage || 'Trip finalization request failed.');
    } finally {
      setCompletionLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <span className="material-symbols-outlined brand-icon">hub</span>
          <span className="brand-title">Fleet Command</span>
        </div>

        {/* Operator Profile */}
        <div className="operator-card">
          <div className="operator-avatar">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuARAkLkrQAliV2xszHfmNhQVrDN6_qcv1xNT5pkde6vlewEhFOfDPjHowVuJlCz7XqYtEpWUcgHav4V9hwuh87wFMjAn4O26Eucv4Kwt1VHA4aukipAPjfbgCR7Y7ygVTA2OU4zQJUin5QtoAexqQqG-KbdHQwx2aAJds6eRH5F8cqdkj_qmLbejOIhsnfGNSFY2E8CT7MOyCsQIVqHhMuvgBy-1Lb2rFFHcLZrsMfkcrXbHvTzVGJcIF5EUHmMsSlZ6XDmt7CzhDE" alt="Operator Sterling Avatar" />
          </div>
          <div className="operator-details">
            <span className="operator-name">Operator Sterling</span>
            <span className="operator-role">System Console • Active</span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setAlertError(null); }}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard Overview</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('bookings'); setAlertError(null); }}
          >
            <span className="material-symbols-outlined">map</span>
            <span>Deployments</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'drivers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('drivers'); setAlertError(null); }}
          >
            <span className="material-symbols-outlined">local_taxi</span>
            <span>Drivers List</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => { setActiveTab('invoices'); setAlertError(null); }}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Invoice History</span>
          </div>
        </nav>

        {/* Telemetry sidebar widget */}
        <div className="sidebar-footer">
          <div className="telemetry-title">Operator Performance</div>
          <div className="telemetry-item">
            <span>Ping Delay</span>
            <span className="telemetry-val">{latency}ms</span>
          </div>
          <div className="telemetry-bar">
            <div className="telemetry-fill" style={{ width: `${Math.min(100, Math.max(10, (latency / 150) * 100))}%` }}></div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Control Bar */}
        <header className="top-bar">
          <div className="page-title-section">
            <h2>Command Operations Hub</h2>
            <p>Real-time vehicle choreography and request management console</p>
          </div>

          <div className="status-indicators">
            <div className="status-pill">
              <span className={`status-dot ${health.gateway === 'healthy' ? 'active' : ''}`}></span>
              <span>Gateway</span>
            </div>
            <div className="status-pill">
              <span className={`status-dot ${health.passenger === 'healthy' ? 'active' : ''}`}></span>
              <span>Passenger Service</span>
            </div>
            <div className="status-pill">
              <span className={`status-dot ${health.driver === 'healthy' ? 'active' : ''}`}></span>
              <span>Driver Service</span>
            </div>
            <div className="status-pill">
              <span className={`status-dot ${health.billing === 'healthy' ? 'active' : ''}`}></span>
              <span>Billing Service</span>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', borderRadius: '20px', width: 'auto', display: 'flex' }}
              onClick={() => fetchData()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {alertError && (
          <div className="error-alert-banner">
            <div className="error-alert-content">
              <span className="material-symbols-outlined">warning</span>
              <span><strong>Subsystem Error Alert:</strong> {alertError}</span>
            </div>
            <button className="error-alert-close" onClick={() => setAlertError(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            {/* Real-time counters */}
            <div className="metrics-row">
              <div className="metric-card">
                <span className="metric-label">Active Deployments</span>
                <span className="metric-value">{rides.filter(r => r.status === 'ACCEPTED' || r.status === 'PENDING').length}</span>
                <div className="metric-footer">
                  <span style={{ color: 'var(--status-ready)' }}>●</span>
                  <span>In transit or pending driver allocation</span>
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Drivers Available</span>
                <span className="metric-value" style={{ color: 'var(--status-ready)' }}>
                  {drivers.filter(d => d.status === 'AVAILABLE').length}
                </span>
                <div className="metric-footer">
                  <span>Total Fleet Capacity: {drivers.length} drivers</span>
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Failed Requests (Saga Compensation)</span>
                <span className="metric-value" style={{ color: 'var(--status-error)' }}>
                  {rides.filter(r => r.status === 'FAILED').length}
                </span>
                <div className="metric-footer">
                  <span style={{ color: 'var(--status-error)' }}>⚠</span>
                  <span>Auto-reverted transactions</span>
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-label">Total Invoiced Transactions</span>
                <span className="metric-value">
                  {invoices.length}
                </span>
                <div className="metric-footer">
                  <span>Gross ledger receipts</span>
                </div>
              </div>
            </div>

            {/* Bento panels */}
            <div className="panel-grid">
              {/* New Deployment Form */}
              <div className="dashboard-card col-span-4">
                <div className="scanline"></div>
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined">add_location_alt</span>
                    <span>New Dispatch Order</span>
                  </div>
                  <span className="card-subtitle">REF: DEP-{Date.now().toString().slice(-4)}</span>
                </div>

                {bookingSuccess && (
                  <div className="badge badge-ready" style={{ width: '100%', padding: '10px', marginBottom: '14px', justifyContent: 'center' }}>
                    {bookingSuccess}
                  </div>
                )}

                <form className="dispatch-form" onSubmit={handleRequestRide}>
                  <div className="form-group">
                    <label>Passenger Identity</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">person</span>
                      <select 
                        className="form-input" 
                        value={bookingForm.passengerId}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, passengerId: e.target.value }))}
                      >
                        <option value="p1">Passenger One (VIP Account)</option>
                        <option value="p2">Passenger Two (Standard Account)</option>
                        <option value="p3">Passenger Three (Corporate Account)</option>
                        <option value="p4">Passenger Four (Test Client)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Extraction Point (Pickup Location)</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">location_on</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 120 Main St" 
                        value={bookingForm.pickup}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, pickup: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Drop-off Terminal (Destination)</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">flag</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 999 Broadway" 
                        value={bookingForm.dropoff}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, dropoff: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn" disabled={bookingLoading}>
                    {bookingLoading ? (
                      <span>Dispatching Order...</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        <span>Submit Dispatch Order</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Live Dispatch Feed */}
              <div className="dashboard-card col-span-8">
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined">map</span>
                    <span>Live Deployments Feed</span>
                  </div>
                  <span className="card-subtitle">Showing latest 5 requests</span>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Passenger</th>
                        <th>Pickup</th>
                        <th>Drop-off</th>
                        <th>Driver Assignment</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)' }}>
                            No active deployment records found. Submit an order to start.
                          </td>
                        </tr>
                      ) : (
                        rides.slice(0, 5).map((ride) => (
                          <tr key={ride.requestId}>
                            <td className="numeric-data">{ride.requestId}</td>
                            <td>{ride.passengerId}</td>
                            <td>{ride.pickup}</td>
                            <td>{ride.dropoff}</td>
                            <td className="numeric-data">
                              {ride.driverId ? (
                                <span style={{ color: 'var(--secondary-accent)' }}>{ride.driverId}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${
                                ride.status === 'COMPLETED' ? 'badge-ready' :
                                ride.status === 'ACCEPTED' ? 'badge-ready' : 
                                ride.status === 'PENDING' ? 'badge-busy' : 'badge-error'
                              }`}>
                                {ride.status}
                              </span>
                            </td>
                            <td>
                              {ride.status === 'ACCEPTED' && (
                                <button 
                                  className="btn" 
                                  style={{ padding: '6px 10px', fontSize: '11px', width: 'auto' }}
                                  onClick={() => handleCompleteTrip(ride.requestId, ride.driverId)}
                                  disabled={completionLoading}
                                >
                                  Finish Trip
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {rides.length > 5 && (
                  <div style={{ textAlign: 'right', marginTop: '12px' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px' }} onClick={() => setActiveTab('bookings')}>
                      View All Deployments ({rides.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Phase 3 Live Telemetry Map Panel */}
            <div className="dashboard-card col-span-12" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <div className="card-title">
                  <span className="material-symbols-outlined">explore</span>
                  <span>Fleet Operational Telemetry Map</span>
                </div>
                <span className="card-subtitle">Real-time coordinates streamed via WebSockets (Port 3005)</span>
              </div>
              
              <div className="map-container" style={{ height: '400px', width: '100%' }}>
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  <MapRecenter center={mapCenter} />

                  {/* Render all drivers moving in real time */}
                  {Object.entries(driverLocations).map(([driverId, loc]) => (
                    <Marker key={driverId} position={[loc.lat, loc.lng]} icon={carIcon}>
                      <Popup>
                        <div style={{ color: '#000' }}>
                          <strong>{loc.name || driverId}</strong><br />
                          Driver ID: {driverId}<br />
                          Status: Active Telemetry<br />
                          Lon: {loc.lng.toFixed(4)}, Lat: {loc.lat.toFixed(4)}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Simulation Helpers warning box */}
            <div className="dashboard-card col-span-12" style={{ backgroundColor: 'var(--surface-lowest)' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--secondary-accent)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined">help_outline</span>
                <span>Subsystem Simulator Helpers</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '150%' }}>
                <strong>Testing Saga compensations and Fleet scaling:</strong> You can add custom drivers dynamically from the <strong>Drivers List</strong> tab. When a driver receives a dispatch request, their status transitions to occupied and they start tracking on the map automatically.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Bookings / Deployments */}
        {activeTab === 'bookings' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-title">
                <span className="material-symbols-outlined">map</span>
                <span>Active and Past Deployments Ledger</span>
              </div>
              <span className="card-subtitle">Total records: {rides.length}</span>
            </div>

            {completionSuccess && (
              <div className="badge badge-ready" style={{ width: '100%', padding: '10px', marginBottom: '14px', justifyContent: 'center' }}>
                {completionSuccess}
              </div>
            )}

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Passenger ID</th>
                    <th>Pickup Location</th>
                    <th>Drop-off Terminal</th>
                    <th>Driver Assigned</th>
                    <th>Status Badge</th>
                    <th>Control Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rides.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)' }}>
                        No dispatch orders found.
                      </td>
                    </tr>
                  ) : (
                    rides.map((ride) => (
                      <tr key={ride.requestId}>
                        <td className="numeric-data">{ride.requestId}</td>
                        <td>{ride.passengerId}</td>
                        <td>{ride.pickup}</td>
                        <td>{ride.dropoff}</td>
                        <td className="numeric-data">{ride.driverId || 'None'}</td>
                        <td>
                          <span className={`badge ${
                            ride.status === 'COMPLETED' ? 'badge-ready' :
                            ride.status === 'ACCEPTED' ? 'badge-ready' : 
                            ride.status === 'PENDING' ? 'badge-busy' : 'badge-error'
                          }`}>
                            {ride.status}
                          </span>
                        </td>
                        <td>
                          {ride.status === 'ACCEPTED' && (
                            <button 
                              className="btn" 
                              style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                              onClick={() => handleCompleteTrip(ride.requestId, ride.driverId)}
                              disabled={completionLoading}
                            >
                              Finish Trip
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Drivers List */}
        {activeTab === 'drivers' && (
          <div>
            <div className="top-bar" style={{ borderBottom: 'none', marginBottom: '16px' }}>
              <div className="page-title-section">
                <h2>Fleet Registry and Dynamic Registration</h2>
                <p>Register new drivers to expand capacity and track live coordinate locations</p>
              </div>
            </div>

            <div className="panel-grid">
              {/* Left Column: Register Driver Form */}
              <div className="dashboard-card col-span-4">
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined">person_add</span>
                    <span>Register New Driver</span>
                  </div>
                </div>

                {driverSuccess && (
                  <div className="badge badge-ready" style={{ width: '100%', padding: '10px', marginBottom: '14px', justifyContent: 'center' }}>
                    {driverSuccess}
                  </div>
                )}

                <form className="dispatch-form" onSubmit={handleRegisterDriver}>
                  <div className="form-group">
                    <label>Driver Identifier (ID)</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">badge</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. d11" 
                        value={driverForm.id}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, id: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Driver Name</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">account_circle</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Peter Parker" 
                        value={driverForm.name}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Starting Terminal (Location)</label>
                    <div className="input-container">
                      <span className="material-symbols-outlined">home_pin</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 450 Broadway" 
                        value={driverForm.location}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, location: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn" disabled={driverLoading}>
                    {driverLoading ? (
                      <span>Saving driver details...</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">add</span>
                        <span>Register Driver</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Column: Fleet Grid */}
              <div className="col-span-8">
                <div className="drivers-container">
                  {drivers.length === 0 ? (
                    <div className="dashboard-card text-center" style={{ width: '100%' }}>
                      No drivers detected in registry.
                    </div>
                  ) : (
                    drivers.map((driver) => (
                      <div className="driver-card" key={driver.id}>
                        <div className="driver-header">
                          <div className="driver-profile">
                            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: driver.status === 'AVAILABLE' ? 'var(--status-ready)' : 'var(--status-busy)' }}>
                              account_circle
                            </span>
                            <div className="driver-info">
                              <span className="driver-name">{driver.name}</span>
                              <span className="driver-id">ID: {driver.id}</span>
                            </div>
                          </div>
                          <span className={`badge ${driver.status === 'AVAILABLE' ? 'badge-ready' : 'badge-busy'}`}>
                            {driver.status}
                          </span>
                        </div>

                        <div className="driver-body">
                          <div className="driver-detail-row">
                            <span className="driver-detail-label">Base Location:</span>
                            <span className="driver-detail-val">{driver.location}</span>
                          </div>
                          <div className="driver-detail-row">
                            <span className="driver-detail-label">Status:</span>
                            <span className="driver-detail-val" style={{ color: driver.status === 'AVAILABLE' ? 'var(--status-ready)' : 'var(--status-busy)' }}>
                              {driver.status === 'AVAILABLE' ? 'Ready for Dispatch' : 'Occupied / In Transit'}
                            </span>
                          </div>
                          {driverLocations[driver.id] && (
                            <div className="driver-detail-row" style={{ color: 'var(--secondary-accent)', marginTop: '4px' }}>
                              <span>Telemetry Lat/Lng:</span>
                              <span className="numeric-data">
                                {driverLocations[driver.id].lat.toFixed(4)}, {driverLocations[driver.id].lng.toFixed(4)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Invoices */}
        {activeTab === 'invoices' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-title">
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Gross Invoice Ledger</span>
              </div>
              <span className="card-subtitle">Processed bills: {invoices.length}</span>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Related Request ID</th>
                    <th>Passenger Client</th>
                    <th>Billing Sum</th>
                    <th>Payment Status</th>
                    <th>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ color: 'var(--text-muted)' }}>
                        No billing transaction receipts found. Complete a trip deployment to generate an invoice.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.invoiceId}>
                        <td className="numeric-data">{inv.invoiceId}</td>
                        <td className="numeric-data">{inv.requestId}</td>
                        <td>{inv.passengerId}</td>
                        <td className="numeric-data" style={{ fontWeight: '700', color: 'var(--secondary-accent)' }}>
                          ₹{inv.amount.toFixed(2)}
                        </td>
                        <td>
                          <span className="badge badge-ready">
                            {inv.status}
                          </span>
                        </td>
                        <td className="numeric-data">
                          {new Date(inv.processedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Interactive Saga Tracker Overlay Dialog with Integrated Leaflet Map */}
      {showTracker && trackedRide && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div className="card-title">
                <span className="material-symbols-outlined text-secondary">sensors</span>
                <span>Dispatch Operations Monitor</span>
              </div>
              <span className="card-subtitle" style={{ fontFamily: 'JetBrains Mono' }}>
                ID: {trackedRide.requestId}
              </span>
            </div>

            {/* Radar Pulsating Search Indicator or Live Map */}
            {trackedRide.status === 'PENDING' ? (
              <div className="tracker-radar-container">
                <div className="tracker-radar">
                  <div className="tracker-radar-inner">
                    <span className="material-symbols-outlined">local_taxi</span>
                  </div>
                </div>
              </div>
            ) : trackedRide.status === 'ACCEPTED' ? (
              <div style={{ margin: '14px 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--status-ready)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Driver Assigned: {trackedRide.driverId}</span>
                  </h3>
                </div>
                <div className="map-container" style={{ height: '220px', width: '100%', marginTop: '6px' }}>
                  <MapContainer center={driverLocations[trackedRide.driverId] ? [driverLocations[trackedRide.driverId].lat, driverLocations[trackedRide.driverId].lng] : defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    {driverLocations[trackedRide.driverId] && (
                      <>
                        <Marker position={[driverLocations[trackedRide.driverId].lat, driverLocations[trackedRide.driverId].lng]} icon={carIcon} />
                        <MapRecenter center={[driverLocations[trackedRide.driverId].lat, driverLocations[trackedRide.driverId].lng]} />
                      </>
                    )}
                  </MapContainer>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', margin: '20px 0', color: 'var(--status-error)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '8px' }}>warning</span>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>No Drivers Available</h3>
              </div>
            )}

            {/* Tracker Flow Steps */}
            <div className="tracker-steps">
              {/* Step 1: Submit */}
              <div className="tracker-step completed">
                <div className="step-indicator">1</div>
                <div className="step-details">
                  <span className="step-title">Order Submitted</span>
                  <span className="step-description">Saved in Database • Published to message broker queue</span>
                </div>
              </div>

              {/* Step 2: Driver Matching */}
              <div className={`tracker-step ${trackedRide.status === 'PENDING' ? 'active' : 'completed'}`}>
                <div className="step-indicator">
                  {trackedRide.status === 'PENDING' ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', animation: 'rotateRadar 2s linear infinite' }}>sync</span>
                  ) : '2'}
                </div>
                <div className="step-details">
                  <span className="step-title">Locating Nearest Available Driver</span>
                  <span className="step-description">
                    {trackedRide.status === 'PENDING' ? 'Searching active fleet registries...' : 'Search completed'}
                  </span>
                </div>
              </div>

              {/* Step 3: Saga Resolution */}
              <div className={`tracker-step ${
                trackedRide.status === 'ACCEPTED' ? 'completed' : 
                trackedRide.status === 'FAILED' ? 'failed active' : 
                trackedRide.status === 'PENDING' ? '' : 'failed active'
              }`}>
                <div className="step-indicator">3</div>
                <div className="step-details">
                  <span className="step-title">Subsystem Sync Confirmation</span>
                  <span className="step-description">
                    {trackedRide.status === 'PENDING' && 'Waiting for matching result confirmation...'}
                    {trackedRide.status === 'ACCEPTED' && `Success: Driver ${trackedRide.driverId || 'John Doe'} allocated`}
                    {trackedRide.status === 'FAILED' && 'Compensating Rollback: Booking reverted safely'}
                    {trackedRide.status === 'TIMEOUT' && 'Matching Timeout: Subsytem did not respond in time'}
                  </span>
                </div>
              </div>
            </div>

            {/* Microservice Flow Explanation */}
            <div style={{ padding: '12px', background: 'var(--surface-lowest)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '11px', lineHeight: '145%', color: 'var(--text-muted)' }}>
              {trackedRide.status === 'PENDING' && (
                <span>The Dispatch Center is coordinating with the Driver Matching Service via RabbitMQ Choreography. Please wait.</span>
              )}
              {trackedRide.status === 'ACCEPTED' && (
                <span style={{ color: 'var(--status-ready)' }}>
                  <strong>Event Choreography Complete:</strong> Driver assigned atomically. The database record is set to ACCEPTED. Live coordinate telemetry streamed over WebSocket pipeline.
                </span>
              )}
              {trackedRide.status === 'FAILED' && (
                <span style={{ color: 'var(--status-error)' }}>
                  <strong>No Drivers Available:</strong> The Driver Service failed allocation, publishing a failed-match event. The Saga process rolled back transaction state, updating Passenger DB to FAILED.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn" 
                onClick={() => {
                  setShowTracker(false);
                  setTrackingRideId(null);
                  setTrackedRide(null);
                }}
                disabled={trackedRide.status === 'PENDING'}
              >
                {trackedRide.status === 'PENDING' ? 'Securing Link...' : 'Close Monitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
