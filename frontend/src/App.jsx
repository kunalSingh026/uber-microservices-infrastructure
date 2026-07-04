import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PortalGate from './pages/PortalGate';
import LoginPage from './pages/LoginPage';
import CustomerView from './pages/CustomerView';
import AdminView from './pages/AdminView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortalGate />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/customer" element={<CustomerView />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
