import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
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

// Light theme marker icon generator
const createDivIcon = (iconName, color) => {
  return L.divIcon({
    html: `<div style="display: flex; justify-content: center; align-items: center; width: 32px; height: 32px; background: #ffffff; border: 2px solid ${color}; border-radius: 50%; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);"><span class="material-symbols-outlined" style="color: ${color}; font-size: 16px; font-weight: bold;">${iconName}</span></div>`,
    className: 'custom-leaflet-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const carIcon = createDivIcon('local_taxi', '#0f172a'); // Black
const pickupIcon = createDivIcon('location_on', '#059669'); // Green
const dropoffIcon = createDivIcon('flag', '#dc2626'); // Red

// Dynamic SVG Revenue Chart Component
function RevenueChart({ invoices }) {
  if (!invoices || invoices.length === 0) {
    return (
      <div style={{
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px dashed #e2e8f0',
        color: '#64748b',
        fontSize: '13px'
      }}>
        <span className="material-symbols-outlined" style={{ marginRight: '6px' }}>bar_chart</span>
        No revenue transactions logged yet. Complete trips to populate analytics.
      </div>
    );
  }

  // Chronologically sort invoices for the trend line
  const sortedInvoices = [...invoices].sort((a, b) => new Date(a.processedAt) - new Date(b.processedAt));
  
  // Keep last 10 invoices for chart clarity
  const chartData = sortedInvoices.slice(-10);

  const width = 500;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;

  const amounts = chartData.map(d => d.amount);
  const maxVal = Math.max(...amounts, 100) * 1.15;
  const minVal = 0;

  // Calculate coordinates for rendering
  const getCoords = (val, index) => {
    const x = paddingX + (index / Math.max(chartData.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
    return { x, y };
  };

  const points = chartData.map((d, i) => getCoords(d.amount, i));
  
  // Build SVG Path strings
  let linePath = '';
  let areaPath = '';

  if (points.length > 0) {
    if (points.length === 1) {
      linePath = `M ${paddingX},${points[0].y} H ${width - paddingX}`;
      areaPath = `M ${paddingX},${height - paddingY} L ${paddingX},${points[0].y} L ${width - paddingX},${points[0].y} L ${width - paddingX},${height - paddingY} Z`;
    } else {
      const lineCommands = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
      linePath = lineCommands;
      areaPath = `${lineCommands} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;
    }
  }

  const yTicks = [0, maxVal * 0.5, maxVal * 0.95];

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontWeight: '600' }}>Financial Flow</span>
          <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '2px 0 0 0' }}>Revenue Trend (Last 10 Trips)</h4>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Total Revenue</span>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>
            ₹{invoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = height - paddingY - ((tick - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
            return (
              <g key={i}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                  ₹{Math.round(tick)}
                </text>
              </g>
            );
          })}

          {/* Area Path */}
          {areaPath && <path d={areaPath} fill="url(#chartAreaGradient)" />}

          {/* Line Path */}
          {linePath && <path d={linePath} fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i} className="chart-point-group">
              <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#000000" strokeWidth="2.5" style={{ transition: 'r 0.2s' }} />
              <circle cx={p.x} cy={p.y} r="8" fill="transparent" style={{ cursor: 'pointer' }} />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="700" fontFamily="'JetBrains Mono', monospace" className="chart-tooltip">
                ₹{chartData[i].amount.toFixed(0)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <style>{`
        .chart-point-group text {
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateY(2px);
        }
        .chart-point-group:hover text {
          opacity: 1;
          transform: translateY(0);
        }
        .chart-point-group:hover circle:first-child {
          r: 6;
          fill: #000000;
        }
      `}</style>
    </div>
  );
}

function AdminView() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
    passengerId: user ? user.email : 'p1',
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

    // Subscribe location listeners dynamically based on loaded drivers
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
      <aside className="sidebar" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0' }}>
        <div className="brand-section">
          <span className="material-symbols-outlined brand-icon" style={{ color: '#000000' }}>local_taxi</span>
          <span className="brand-title" style={{ color: '#000000', fontWeight: '800' }}>Uber</span>
          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontWeight: '600' }}>Console</span>
        </div>

        {/* Operator Profile */}
        <div className="operator-card" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="operator-avatar" style={{ border: '1px solid #cbd5e1' }}>
            <img src={user ? user.picture : "https://lh3.googleusercontent.com/aida-public/AB6AXuARAkLkrQAliV2xszHfmNhQVrDN6_qcv1xNT5pkde6vlewEhFOfDPjHowVuJlCz7XqYtEpWUcgHav4V9hwuh87wFMjAn4O26Eucv4Kwt1VHA4aukipAPjfbgCR7Y7ygVTA2OU4zQJUin5QtoAexqQqG-KbdHQwx2aAJds6eRH5F8cqdkj_qmLbejOIhsnfGNSFY2E8CT7MOyCsQIVqHhMuvgBy-1Lb2rFFHcLZrsMfkcrXbHvTzVGJcIF5EUHmMsSlZ6XDmt7CzhDE"} alt="Operator Avatar" />
          </div>
          <div className="operator-details">
            <span className="operator-name" style={{ color: '#0f172a' }}>{user ? user.name : "Operator Sterling"}</span>
            <span className="operator-role" style={{ color: '#64748b' }}>{user ? user.email : "Operations Room"}</span>
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
            <span>Deployments Ledger</span>
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

        {/* Exit link back to portal */}
        <div style={{ marginTop: 'auto', padding: '8px 0' }}>
          <Link to="/" onClick={() => localStorage.removeItem('user')} style={{
            textDecoration: 'none',
            color: '#ef4444',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #fee2e2',
            backgroundColor: '#ffffff',
            transition: 'background-color 0.2s',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
            Logout
          </Link>
        </div>

        {/* Telemetry sidebar widget */}
        <div className="sidebar-footer" style={{ borderTop: '1px solid #e2e8f0' }}>
          <div className="telemetry-title" style={{ color: '#64748b' }}>Console Latency</div>
          <div className="telemetry-item">
            <span>Ping Delay</span>
            <span className="telemetry-val" style={{ color: '#000000', fontWeight: 'bold' }}>{latency}ms</span>
          </div>
          <div className="telemetry-bar" style={{ backgroundColor: '#f1f5f9' }}>
            <div className="telemetry-fill" style={{ backgroundColor: '#000000', width: `${Math.min(100, Math.max(10, (latency / 150) * 100))}%` }}></div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Control Bar */}
        <header className="top-bar" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="page-title-section">
            <h2 style={{ color: '#000000' }}>Operations Control Center</h2>
            <p style={{ color: '#64748b' }}>Real-time vehicle choreography and request management console</p>
          </div>

          <div className="status-indicators">
            <div className="status-pill" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <span className={`status-dot ${health.gateway === 'healthy' ? 'active' : ''}`} style={{ backgroundColor: health.gateway === 'healthy' ? 'var(--status-ready)' : 'var(--status-error)' }}></span>
              <span style={{ color: '#0f172a' }}>Gateway</span>
            </div>
            <div className="status-pill" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <span className={`status-dot ${health.passenger === 'healthy' ? 'active' : ''}`} style={{ backgroundColor: health.passenger === 'healthy' ? 'var(--status-ready)' : 'var(--status-error)' }}></span>
              <span style={{ color: '#0f172a' }}>Passenger</span>
            </div>
            <div className="status-pill" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <span className={`status-dot ${health.driver === 'healthy' ? 'active' : ''}`} style={{ backgroundColor: health.driver === 'healthy' ? 'var(--status-ready)' : 'var(--status-error)' }}></span>
              <span style={{ color: '#0f172a' }}>Driver</span>
            </div>
            <div className="status-pill" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
              <span className={`status-dot ${health.billing === 'healthy' ? 'active' : ''}`} style={{ backgroundColor: health.billing === 'healthy' ? 'var(--status-ready)' : 'var(--status-error)' }}></span>
              <span style={{ color: '#0f172a' }}>Billing</span>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', borderRadius: '20px', width: 'auto', display: 'flex', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#000000' }}
              onClick={() => fetchData()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {alertError && (
          <div className="error-alert-banner" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', borderRadius: '12px', color: 'var(--status-error)' }}>
            <div className="error-alert-content">
              <span className="material-symbols-outlined">warning</span>
              <span><strong>Subsystem Error Alert:</strong> {alertError}</span>
            </div>
            <button className="error-alert-close" style={{ color: 'inherit' }} onClick={() => setAlertError(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            {/* Real-time counters */}
            <div className="metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div className="metric-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <span className="metric-label" style={{ color: '#64748b' }}>Active Deployments</span>
                <span className="metric-value" style={{ color: '#000000' }}>{rides.filter(r => r.status === 'ACCEPTED' || r.status === 'PENDING').length}</span>
                <div className="metric-footer" style={{ borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
                  <span style={{ color: 'var(--status-ready)' }}>●</span>
                  <span>In transit or pending</span>
                </div>
              </div>
              <div className="metric-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <span className="metric-label" style={{ color: '#64748b' }}>Drivers Available</span>
                <span className="metric-value" style={{ color: 'var(--status-ready)' }}>
                  {drivers.filter(d => d.status === 'AVAILABLE').length}
                </span>
                <div className="metric-footer" style={{ borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
                  <span>Total Fleet Capacity: {drivers.length}</span>
                </div>
              </div>
              <div className="metric-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <span className="metric-label" style={{ color: '#64748b' }}>Failed Requests (Saga)</span>
                <span className="metric-value" style={{ color: 'var(--status-error)' }}>
                  {rides.filter(r => r.status === 'FAILED').length}
                </span>
                <div className="metric-footer" style={{ borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
                  <span style={{ color: 'var(--status-error)' }}>⚠</span>
                  <span>Auto-reverted transactions</span>
                </div>
              </div>
              <div className="metric-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                <span className="metric-label" style={{ color: '#64748b' }}>Gross Billing Ledger</span>
                <span className="metric-value" style={{ color: '#059669' }}>
                  ₹{invoices.reduce((sum, inv) => sum + inv.amount, 0).toFixed(0)}
                </span>
                <div className="metric-footer" style={{ borderTop: '1px solid #f1f5f9', color: '#64748b' }}>
                  <span>Transactions Audited: {invoices.length}</span>
                </div>
              </div>
            </div>

            {/* Bento panels */}
            <div className="panel-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '24px' }}>
              
              {/* New Dispatch Order Form */}
              <div className="dashboard-card col-span-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', gridColumn: 'span 4' }}>
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined" style={{ color: '#000000' }}>add_location_alt</span>
                    <span style={{ color: '#000000', fontWeight: '700' }}>New Dispatch Order</span>
                  </div>
                  <span className="card-subtitle" style={{ color: '#64748b' }}>REF: DEP-{Date.now().toString().slice(-4)}</span>
                </div>

                {bookingSuccess && (
                  <div className="badge badge-ready" style={{ width: '100%', padding: '10px', marginBottom: '14px', justifyContent: 'center' }}>
                    {bookingSuccess}
                  </div>
                )}

                <form className="dispatch-form" onSubmit={handleRequestRide}>
                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Passenger Identity</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#64748b' }}>person</span>
                      <select 
                        className="form-input" 
                        value={bookingForm.passengerId}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, passengerId: e.target.value }))}
                        style={{ color: '#0f172a' }}
                      >
                        {user && (
                          <option value={user.email}>{user.name} (Google Account)</option>
                        )}
                        <option value="p1">Passenger One (VIP Account)</option>
                        <option value="p2">Passenger Two (Standard Account)</option>
                        <option value="p3">Passenger Three (Corporate Account)</option>
                        <option value="p4">Passenger Four (Test Client)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Extraction Point (Pickup Location)</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#059669' }}>location_on</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 120 Main St" 
                        value={bookingForm.pickup}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, pickup: e.target.value }))}
                        required
                        style={{ color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Drop-off Terminal (Destination)</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>flag</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 999 Broadway" 
                        value={bookingForm.dropoff}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, dropoff: e.target.value }))}
                        required
                        style={{ color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn" disabled={bookingLoading} style={{ backgroundColor: '#000000', color: '#ffffff' }}>
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
              <div className="dashboard-card col-span-8" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', gridColumn: 'span 8' }}>
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined" style={{ color: '#000000' }}>map</span>
                    <span style={{ color: '#000000', fontWeight: '700' }}>Live Deployments Feed</span>
                  </div>
                  <span className="card-subtitle" style={{ color: '#64748b' }}>Showing latest 5 requests</span>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ color: '#64748b' }}>Order ID</th>
                        <th style={{ color: '#64748b' }}>Passenger</th>
                        <th style={{ color: '#64748b' }}>Pickup</th>
                        <th style={{ color: '#64748b' }}>Drop-off</th>
                        <th style={{ color: '#64748b' }}>Driver</th>
                        <th style={{ color: '#64748b' }}>Status</th>
                        <th style={{ color: '#64748b' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: '#0f172a' }}>
                      {rides.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center" style={{ color: '#64748b' }}>
                            No active deployment records found. Submit an order to start.
                          </td>
                        </tr>
                      ) : (
                        rides.slice(0, 5).map((ride) => (
                          <tr key={ride.requestId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td className="numeric-data" style={{ fontWeight: '500' }}>{ride.requestId}</td>
                            <td>{ride.passengerId}</td>
                            <td>{ride.pickup}</td>
                            <td>{ride.dropoff}</td>
                            <td className="numeric-data">
                              {ride.driverId ? (
                                <span style={{ color: '#0f172a', fontWeight: '600' }}>{ride.driverId}</span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
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
                                  style={{ padding: '6px 10px', fontSize: '11px', width: 'auto', backgroundColor: '#000000', color: '#ffffff' }}
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
                    <button className="btn btn-secondary" style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#000000' }} onClick={() => setActiveTab('bookings')}>
                      View All Deployments ({rides.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Split Row: Revenue Chart & Operational Map */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '24px' }}>
              {/* Revenue Trend Chart Block */}
              <div style={{ gridColumn: 'span 5' }}>
                <RevenueChart invoices={invoices} />
              </div>

              {/* Fleet Map Block */}
              <div className="dashboard-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', gridColumn: 'span 7' }}>
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined" style={{ color: '#000000' }}>explore</span>
                    <span style={{ color: '#000000', fontWeight: '700' }}>Fleet Operational Telemetry Map</span>
                  </div>
                  <span className="card-subtitle" style={{ color: '#64748b' }}>WebSocket locations streamed on Port 3005</span>
                </div>
                
                <div className="map-container" style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <MapRecenter center={mapCenter} />

                    {/* Render all drivers moving in real time */}
                    {Object.entries(driverLocations).map(([driverId, loc]) => (
                      <Marker key={driverId} position={[loc.lat, loc.lng]} icon={carIcon}>
                        <Popup>
                          <div style={{ color: '#0f172a', fontSize: '12px' }}>
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
            </div>

            {/* Simulation Helpers warning box */}
            <div className="dashboard-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', color: '#000000', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: '#000000' }}>help_outline</span>
                <span style={{ fontWeight: '700' }}>Subsystem Simulator Helpers</span>
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '150%' }}>
                <strong>Testing Saga compensations and Fleet scaling:</strong> You can add custom drivers dynamically from the <strong>Drivers List</strong> tab. When a driver receives a dispatch request, their status transitions to occupied and they start tracking on the map automatically.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Bookings / Deployments */}
        {activeTab === 'bookings' && (
          <div className="dashboard-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <div className="card-header">
              <div className="card-title">
                <span className="material-symbols-outlined" style={{ color: '#000000' }}>map</span>
                <span style={{ color: '#000000', fontWeight: '700' }}>Active and Past Deployments Ledger</span>
              </div>
              <span className="card-subtitle" style={{ color: '#64748b' }}>Total records: {rides.length}</span>
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
                    <th style={{ color: '#64748b' }}>Order ID</th>
                    <th style={{ color: '#64748b' }}>Passenger ID</th>
                    <th style={{ color: '#64748b' }}>Pickup Location</th>
                    <th style={{ color: '#64748b' }}>Drop-off Terminal</th>
                    <th style={{ color: '#64748b' }}>Driver Assigned</th>
                    <th style={{ color: '#64748b' }}>Status Badge</th>
                    <th style={{ color: '#64748b' }}>Control Action</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#0f172a' }}>
                  {rides.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center" style={{ color: '#64748b' }}>
                        No dispatch orders found.
                      </td>
                    </tr>
                  ) : (
                    rides.map((ride) => (
                      <tr key={ride.requestId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="numeric-data" style={{ fontWeight: '500' }}>{ride.requestId}</td>
                        <td>{ride.passengerId}</td>
                        <td>{ride.pickup}</td>
                        <td>{ride.dropoff}</td>
                        <td className="numeric-data" style={{ fontWeight: '600' }}>{ride.driverId || 'None'}</td>
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
                              style={{ padding: '6px 12px', fontSize: '12px', width: 'auto', backgroundColor: '#000000', color: '#ffffff' }}
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
                <h2 style={{ color: '#000000' }}>Fleet Registry and Dynamic Registration</h2>
                <p style={{ color: '#64748b' }}>Register new drivers to expand capacity and track live coordinate locations</p>
              </div>
            </div>

            <div className="panel-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
              {/* Left Column: Register Driver Form */}
              <div className="dashboard-card col-span-4" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', gridColumn: 'span 4' }}>
                <div className="card-header">
                  <div className="card-title">
                    <span className="material-symbols-outlined" style={{ color: '#000000' }}>person_add</span>
                    <span style={{ color: '#000000', fontWeight: '700' }}>Register New Driver</span>
                  </div>
                </div>

                {driverSuccess && (
                  <div className="badge badge-ready" style={{ width: '100%', padding: '10px', marginBottom: '14px', justifyContent: 'center' }}>
                    {driverSuccess}
                  </div>
                )}

                <form className="dispatch-form" onSubmit={handleRegisterDriver}>
                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Driver Identifier (ID)</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#64748b' }}>badge</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. d11" 
                        value={driverForm.id}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, id: e.target.value }))}
                        required
                        style={{ color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Driver Name</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#64748b' }}>account_circle</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Peter Parker" 
                        value={driverForm.name}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        style={{ color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#0f172a' }}>Starting Terminal (Location)</label>
                    <div className="input-container" style={{ border: '1px solid #e2e8f0' }}>
                      <span className="material-symbols-outlined" style={{ color: '#64748b' }}>home_pin</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. 450 Broadway" 
                        value={driverForm.location}
                        onChange={(e) => setDriverForm(prev => ({ ...prev, location: e.target.value }))}
                        required
                        style={{ color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn" disabled={driverLoading} style={{ backgroundColor: '#000000', color: '#ffffff' }}>
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
              <div className="col-span-8" style={{ gridColumn: 'span 8' }}>
                <div className="drivers-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {drivers.length === 0 ? (
                    <div className="dashboard-card text-center" style={{ width: '100%', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', color: '#64748b' }}>
                      No drivers detected in registry.
                    </div>
                  ) : (
                    drivers.map((driver) => (
                      <div className="driver-card" key={driver.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
                        <div className="driver-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div className="driver-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: driver.status === 'AVAILABLE' ? 'var(--status-ready)' : 'var(--status-busy)' }}>
                              account_circle
                            </span>
                            <div className="driver-info">
                              <span className="driver-name" style={{ color: '#0f172a', fontWeight: '700', fontSize: '14px', display: 'block' }}>{driver.name}</span>
                              <span className="driver-id" style={{ color: '#64748b', fontSize: '11px', display: 'block', fontFamily: 'JetBrains Mono' }}>ID: {driver.id}</span>
                            </div>
                          </div>
                          <span className={`badge ${driver.status === 'AVAILABLE' ? 'badge-ready' : 'badge-busy'}`}>
                            {driver.status}
                          </span>
                        </div>

                        <div className="driver-body" style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                          <div className="driver-detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="driver-detail-label" style={{ color: '#64748b' }}>Base:</span>
                            <span className="driver-detail-val" style={{ fontWeight: '500', color: '#0f172a' }}>{driver.location}</span>
                          </div>
                          <div className="driver-detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="driver-detail-label" style={{ color: '#64748b' }}>Status:</span>
                            <span className="driver-detail-val" style={{ fontWeight: '600', color: driver.status === 'AVAILABLE' ? 'var(--status-ready)' : 'var(--status-busy)' }}>
                              {driver.status === 'AVAILABLE' ? 'Ready for Dispatch' : 'Occupied / In Transit'}
                            </span>
                          </div>
                          {driverLocations[driver.id] && (
                            <div className="driver-detail-row" style={{ color: '#2563eb', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>
                              <span>Telemetry GPS:</span>
                              <span className="numeric-data" style={{ fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>
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
          <div className="dashboard-card" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <div className="card-header">
              <div className="card-title">
                <span className="material-symbols-outlined" style={{ color: '#000000' }}>receipt_long</span>
                <span style={{ color: '#000000', fontWeight: '700' }}>Gross Invoice Ledger</span>
              </div>
              <span className="card-subtitle" style={{ color: '#64748b' }}>Processed bills: {invoices.length}</span>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ color: '#64748b' }}>Invoice ID</th>
                    <th style={{ color: '#64748b' }}>Trip Request ID</th>
                    <th style={{ color: '#64748b' }}>Passenger Account</th>
                    <th style={{ color: '#64748b' }}>Billing Sum</th>
                    <th style={{ color: '#64748b' }}>Payment Status</th>
                    <th style={{ color: '#64748b' }}>Completed At</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#0f172a' }}>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center" style={{ color: '#64748b' }}>
                        No billing transaction receipts found. Complete a trip deployment to generate an invoice.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.invoiceId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="numeric-data" style={{ fontWeight: '500' }}>{inv.invoiceId}</td>
                        <td className="numeric-data">{inv.requestId}</td>
                        <td>{inv.passengerId}</td>
                        <td className="numeric-data" style={{ fontWeight: '700', color: '#059669' }}>
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

      {/* Interactive Saga Tracker Overlay Dialog */}
      {showTracker && trackedRide && (
        <div className="modal-overlay" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1000 }}>
          <div className="modal-container" style={{ maxWidth: '580px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div className="card-title">
                <span className="material-symbols-outlined text-secondary" style={{ color: '#000000' }}>sensors</span>
                <span style={{ color: '#000000', fontWeight: '700' }}>Dispatch Operations Monitor</span>
              </div>
              <span className="card-subtitle" style={{ fontFamily: 'JetBrains Mono', color: '#64748b' }}>
                ID: {trackedRide.requestId}
              </span>
            </div>

            {/* Radar Pulsating Search Indicator or Live Map */}
            {trackedRide.status === 'PENDING' ? (
              <div className="tracker-radar-container" style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', background: '#f8fafc' }}>
                <div className="tracker-radar" style={{ border: '1px solid #e2e8f0' }}>
                  <div className="tracker-radar-inner" style={{ backgroundColor: '#000000' }}>
                    <span className="material-symbols-outlined" style={{ color: '#ffffff' }}>local_taxi</span>
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
                <div className="map-container" style={{ height: '220px', width: '100%', marginTop: '6px', borderRadius: '12px', overflow: 'hidden' }}>
                  <MapContainer center={driverLocations[trackedRide.driverId] ? [driverLocations[trackedRide.driverId].lat, driverLocations[trackedRide.driverId].lng] : defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
            <div className="tracker-steps" style={{ color: '#0f172a' }}>
              {/* Step 1: Submit */}
              <div className="tracker-step completed">
                <div className="step-indicator" style={{ backgroundColor: 'var(--status-ready-bg)', color: 'var(--status-ready)', border: '1px solid var(--status-ready)' }}>1</div>
                <div className="step-details">
                  <span className="step-title" style={{ fontWeight: '700' }}>Order Submitted</span>
                  <span className="step-description" style={{ color: '#64748b' }}>Saved in Database • Published to message broker queue</span>
                </div>
              </div>

              {/* Step 2: Driver Matching */}
              <div className={`tracker-step ${trackedRide.status === 'PENDING' ? 'active' : 'completed'}`} style={{ opacity: trackedRide.status === 'PENDING' || trackedRide.status === 'ACCEPTED' || trackedRide.status === 'FAILED' ? 1 : 0.5 }}>
                <div className="step-indicator" style={{ 
                  backgroundColor: trackedRide.status === 'PENDING' ? '#f1f5f9' : 'var(--status-ready-bg)', 
                  color: trackedRide.status === 'PENDING' ? '#0f172a' : 'var(--status-ready)', 
                  border: trackedRide.status === 'PENDING' ? '1px solid #cbd5e1' : '1px solid var(--status-ready)'
                }}>
                  {trackedRide.status === 'PENDING' ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', animation: 'rotateRadar 2s linear infinite' }}>sync</span>
                  ) : '2'}
                </div>
                <div className="step-details">
                  <span className="step-title" style={{ fontWeight: '700' }}>Locating Nearest Available Driver</span>
                  <span className="step-description" style={{ color: '#64748b' }}>
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
                <div className="step-indicator" style={{
                  backgroundColor: trackedRide.status === 'ACCEPTED' ? 'var(--status-ready-bg)' : trackedRide.status === 'PENDING' ? '#f1f5f9' : 'var(--status-error-bg)',
                  color: trackedRide.status === 'ACCEPTED' ? 'var(--status-ready)' : trackedRide.status === 'PENDING' ? '#64748b' : 'var(--status-error)',
                  border: trackedRide.status === 'ACCEPTED' ? '1px solid var(--status-ready)' : trackedRide.status === 'PENDING' ? '1px solid #cbd5e1' : '1px solid var(--status-error)'
                }}>3</div>
                <div className="step-details">
                  <span className="step-title" style={{ fontWeight: '700' }}>Subsystem Sync Confirmation</span>
                  <span className="step-description" style={{ color: '#64748b' }}>
                    {trackedRide.status === 'PENDING' && 'Waiting for matching result confirmation...'}
                    {trackedRide.status === 'ACCEPTED' && `Success: Driver ${trackedRide.driverId || 'John Doe'} allocated`}
                    {trackedRide.status === 'FAILED' && 'Compensating Rollback: Booking reverted safely'}
                    {trackedRide.status === 'TIMEOUT' && 'Matching Timeout: Subsystem did not respond'}
                  </span>
                </div>
              </div>
            </div>

            {/* Microservice Flow Explanation */}
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '11px', lineHeight: '145%', color: '#64748b' }}>
              {trackedRide.status === 'PENDING' && (
                <span>The Dispatch Center is coordinating with the Driver Matching Service via RabbitMQ Choreography. Please wait.</span>
              )}
              {trackedRide.status === 'ACCEPTED' && (
                <span style={{ color: '#059669' }}>
                  <strong>Event Choreography Complete:</strong> Driver assigned atomically. Database updated. Live coordinate telemetry streamed over WebSocket pipeline.
                </span>
              )}
              {trackedRide.status === 'FAILED' && (
                <span style={{ color: '#dc2626' }}>
                  <strong>No Drivers Available:</strong> Driver Service failed allocation, publishing a failed-match event. The Saga process rolled back transaction state, updating Passenger DB to FAILED.
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
                style={{ backgroundColor: '#000000', color: '#ffffff' }}
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

export default AdminView;
