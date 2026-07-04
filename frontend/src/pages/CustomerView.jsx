import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Map recentering helper
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

function CustomerView() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [bookingForm, setBookingForm] = useState({
    passengerId: user ? user.email : 'p1',
    pickup: '',
    dropoff: ''
  });

  const [rideState, setRideState] = useState('REQUEST'); // REQUEST, MATCHING, EN_ROUTE, COMPLETED
  const [currentRide, setCurrentRide] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [invoice, setInvoice] = useState(null);

  // Live driver telemetry coordinates
  const [driverLoc, setDriverLoc] = useState(null);
  
  const defaultCenter = [19.0760, 72.8777]; // Mumbai Coordinates
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Poll ride status while PENDING or ACCEPTED
  useEffect(() => {
    if (!currentRide || (rideState !== 'MATCHING' && rideState !== 'EN_ROUTE')) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get(`/api/v1/passenger/rides/${currentRide.requestId}`);
        const ride = res.data;

        if (!isSubscribed) return;

        setCurrentRide(ride);

        if (ride.status === 'ACCEPTED' && rideState === 'MATCHING') {
          setRideState('EN_ROUTE');
        } else if (ride.status === 'COMPLETED') {
          setRideState('COMPLETED');
          clearInterval(interval);
          fetchInvoice(ride.requestId);
        } else if (ride.status === 'FAILED') {
          setRideState('REQUEST');
          setErrorMessage('Driver matching failed. Saga compensation triggered to roll back transaction.');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [currentRide, rideState]);

  // Connect socket.io telemetry stream when ride is ACCEPTED
  useEffect(() => {
    if (rideState !== 'EN_ROUTE' || !currentRide || !currentRide.driverId) {
      setDriverLoc(null);
      return;
    }

    const socket = io('http://localhost:3005');
    const driverId = currentRide.driverId;

    socket.on('connect', () => {
      console.log(`🔌 Connected to telemetry stream for driver: ${driverId}`);
    });

    socket.on(`location.${driverId}`, (data) => {
      const coords = [data.latitude, data.longitude];
      setDriverLoc({ lat: data.latitude, lng: data.longitude });
      setMapCenter(coords);
    });

    return () => {
      socket.disconnect();
    };
  }, [rideState, currentRide]);

  // Fetch the billing invoice for the ride
  const fetchInvoice = async (requestId) => {
    try {
      // Small delay to ensure invoice is processed and recorded by Billing Service
      setTimeout(async () => {
        try {
          const res = await apiClient.get('/api/v1/billing/invoices');
          const matchedInvoice = res.data.find(inv => inv.requestId === requestId);
          if (matchedInvoice) {
            setInvoice(matchedInvoice);
          }
        } catch (e) {
          console.error('Invoice fetch error:', e);
        }
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit ride request
  const handleRequestRide = async (e) => {
    e.preventDefault();
    if (!bookingForm.pickup || !bookingForm.dropoff) {
      setErrorMessage('Please fill in both pickup and drop-off points.');
      return;
    }

    setBookingLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post('/api/v1/passenger/rides/request', {
        passengerId: bookingForm.passengerId,
        pickup: bookingForm.pickup,
        dropoff: bookingForm.dropoff
      });

      setCurrentRide({
        requestId: res.data.requestId,
        passengerId: bookingForm.passengerId,
        pickup: bookingForm.pickup,
        dropoff: bookingForm.dropoff,
        status: 'PENDING'
      });
      setRideState('MATCHING');
    } catch (err) {
      setErrorMessage(err.userFriendlyMessage || 'Could not request a ride. Verify Passenger service is running.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Reset passenger page back to request form
  const handleReset = () => {
    setBookingForm(prev => ({ ...prev, pickup: '', dropoff: '' }));
    setRideState('REQUEST');
    setCurrentRide(null);
    setDriverLoc(null);
    setInvoice(null);
    setErrorMessage(null);
    setMapCenter(defaultCenter);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Top Header */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: '#000000', fontSize: '24px', fontWeight: 'bold' }}>local_taxi</span>
          <span style={{ fontSize: '20px', fontWeight: '800', color: '#000000', letterSpacing: '-0.8px' }}>Uber</span>
          <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', marginLeft: '6px' }}>Passenger Portal</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={user.picture} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid #000000' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{user.name}</span>
            </div>
          )}
          
          <Link to="/" onClick={() => localStorage.removeItem('user')} style={{
            textDecoration: 'none',
            color: '#ef4444',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #fee2e2',
            backgroundColor: '#ffffff',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
            Logout
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', position: 'relative' }}>
        
        {/* Left Side Control Panel */}
        <aside style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10
        }} className="passenger-sidebar">
          {rideState === 'REQUEST' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: '#000000', marginBottom: '6px' }}>Where to?</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Enter your trip details to find a nearby driver.</p>
              </div>

              {errorMessage && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '12px',
                  color: '#dc2626',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRequestRide} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Passenger Account</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
                    <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px', marginRight: '10px' }}>person</span>
                    <select
                      value={bookingForm.passengerId}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, passengerId: e.target.value }))}
                      style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a', fontWeight: '500', cursor: 'pointer' }}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Pickup Location</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
                    <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: '20px', marginRight: '10px' }}>location_on</span>
                    <input
                      type="text"
                      placeholder="Enter pickup address..."
                      value={bookingForm.pickup}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, pickup: e.target.value }))}
                      style={{ border: 'none', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Drop-off Location</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
                    <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '20px', marginRight: '10px' }}>flag</span>
                    <input
                      type="text"
                      placeholder="Enter destination..."
                      value={bookingForm.dropoff}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, dropoff: e.target.value }))}
                      style={{ border: 'none', width: '100%', fontSize: '14px', outline: 'none', color: '#0f172a' }}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  style={{
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
                >
                  {bookingLoading ? 'Requesting Ride...' : 'Confirm Ride'}
                </button>
              </form>
            </div>
          )}

          {rideState === 'MATCHING' && (
            <div style={{ textAlign: 'center', margin: 'auto 0', padding: '20px 0' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 24px auto' }}>
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '3px solid #e2e8f0',
                  boxSizing: 'border-box'
                }}></div>
                <div className="pulsing-ring" style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '3px solid #000000',
                  animation: 'pulseRadar 2s infinite ease-in-out',
                  boxSizing: 'border-box'
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#000000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                }}>
                  <span className="material-symbols-outlined" style={{ color: '#ffffff', fontSize: '24px', animation: 'spinIcon 3s linear infinite' }}>sync</span>
                </div>
              </div>
              
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#000000', marginBottom: '8px' }}>Locating Your Driver</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0 auto', maxWidth: '280px' }}>
                Coordinating with nearby fleets via matching service...
              </p>
              
              <div style={{ marginTop: '24px', fontSize: '11px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', color: '#64748b', border: '1px solid #e2e8f0' }}>
                Saga transaction status: <strong>PENDING_ALLOCATION</strong>
              </div>
            </div>
          )}

          {rideState === 'EN_ROUTE' && currentRide && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', fontWeight: '600' }}>Active Trip</span>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#000000' }}>Driver Assigned</h3>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', fontSize: '11px', fontWeight: '600' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669', marginRight: '6px', display: 'inline-block' }}></span>
                    En Route
                  </span>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#000000' }}>account_circle</span>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>Driver ID: {currentRide.driverId}</h4>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>Assigned vehicle en route</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Pickup Point:</span>
                      <strong style={{ color: '#0f172a' }}>{currentRide.pickup}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Destination:</span>
                      <strong style={{ color: '#0f172a' }}>{currentRide.dropoff}</strong>
                    </div>
                    {driverLoc && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
                        <span>Live GPS Lat/Lng:</span>
                        <strong style={{ fontFamily: 'JetBrains Mono' }}>{driverLoc.lat.toFixed(4)}, {driverLoc.lng.toFixed(4)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px' }}>
                  <strong>Trip Telemetry Stream:</strong> Sockets are receiving coordinates on port 3005. Complete the trip from your separate Operator Admin page to trigger billing ledger and payment confirmation.
                </div>
              </div>
            </div>
          )}

          {rideState === 'COMPLETED' && (
            <div style={{ textAlign: 'center', margin: 'auto 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#059669', marginBottom: '16px' }}>check_circle</span>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginBottom: '8px' }}>Arrived at Destination</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Your trip has been completed. Fetching invoice ledger...</p>
              {!invoice ? (
                <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ animation: 'spinIcon 1s linear infinite' }}>sync</span>
                  <span>Generating receipt details...</span>
                </div>
              ) : (
                <button
                  onClick={() => {}} // placeholder, receipt modal will be open automatically
                  style={{ display: 'none' }}
                />
              )}
            </div>
          )}
        </aside>

        {/* Right Side Map Screen */}
        <main style={{ flex: 1, height: 'calc(100vh - 64px)', position: 'relative' }} className="passenger-map-container">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MapRecenter center={mapCenter} />

            {/* If driver has accepted and location is streaming */}
            {driverLoc && (
              <Marker position={[driverLoc.lat, driverLoc.lng]} icon={carIcon}>
                <Popup>
                  <div style={{ color: '#0f172a', fontSize: '12px' }}>
                    <strong>Driver Assigned ({currentRide?.driverId})</strong><br />
                    Streaming telemetry on port 3005
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </main>

        {/* Checkout Invoice Modal */}
        {rideState === 'COMPLETED' && invoice && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              padding: '32px',
              width: '90%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              textAlign: 'center',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                marginBottom: '20px'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>receipt_long</span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginBottom: '4px', letterSpacing: '-0.5px' }}>Receipt Generated</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Transaction processed through Billing ledger.</p>

              {/* Receipt Ledger details */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px',
                fontFamily: "'Inter', sans-serif"
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '10px' }}>
                  <span style={{ color: '#64748b' }}>Invoice ID:</span>
                  <strong style={{ color: '#000000', fontFamily: 'JetBrains Mono' }}>{invoice.invoiceId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Trip Reference:</span>
                  <span style={{ color: '#0f172a', fontWeight: '600' }}>{invoice.requestId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Passenger Account:</span>
                  <span style={{ color: '#0f172a', fontWeight: '600' }}>{invoice.passengerId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <span style={{ color: '#059669', fontWeight: '700' }}>AUTO-DEBIT</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '10px', fontSize: '15px' }}>
                  <strong style={{ color: '#000000' }}>Total Charged:</strong>
                  <strong style={{ color: '#000000', fontSize: '18px' }}>₹{invoice.amount.toFixed(2)}</strong>
                </div>
              </div>

              <button
                onClick={handleReset}
                style={{
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
              >
                Book Another Ride
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulseRadar {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes spinIcon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .passenger-sidebar {
            max-width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #e2e8f0;
            order: 2;
          }
          .passenger-map-container {
            height: 350px !important;
            flex: none !important;
            width: 100%;
            order: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default CustomerView;
