import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Agents } from './pages/admin/Agents';
import { Users } from './pages/admin/Users';

import { AdminReports } from './pages/admin/Reports';
import { Customers } from './pages/admin/Customers';
import { AgentDashboard } from './pages/agent/Dashboard';
import { Collections } from './pages/agent/Collections';
import { AdminCollections } from './pages/admin/Collections';
import { Investors } from './pages/admin/Investors';
import { Layout } from './components/layout/Layout';
import { Toaster } from 'sonner';

// Role Guard Component
const RoleRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole: 'ADMIN' | 'AGENT' }) => {
  const { role, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (role !== requiredRole) return <Navigate to="/login" replace />;
  return children;
};

// Redirect root based on role
const RootRedirect = () => {
  const { role, loading, user } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (role === 'AGENT') return <Navigate to="/agent" replace />;
  return <div>Unknown Role</div>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<RootRedirect />} />

      <Route element={<Layout />}>
        {/* Admin Routes */}
        <Route path="/admin" element={
          <RoleRoute requiredRole="ADMIN">
            <AdminDashboard />
          </RoleRoute>
        } />
        <Route path="/admin/agents" element={
          <RoleRoute requiredRole="ADMIN">
            <Agents />
          </RoleRoute>
        } />
        <Route path="/admin/users" element={
          <RoleRoute requiredRole="ADMIN">
            <Users />
          </RoleRoute>
        } />
        <Route path="/admin/customers" element={
          <RoleRoute requiredRole="ADMIN">
            <Customers />
          </RoleRoute>
        } />
        <Route path="/admin/collections" element={
          <RoleRoute requiredRole="ADMIN">
            <AdminCollections />
          </RoleRoute>
        } />
        <Route path="/admin/investors" element={
          <RoleRoute requiredRole="ADMIN">
            <Investors />
          </RoleRoute>
        } />

        <Route path="/admin/reports" element={
          <RoleRoute requiredRole="ADMIN">
            <AdminReports />
          </RoleRoute>
        } />
        <Route path="/admin/settings" element={
          <RoleRoute requiredRole="ADMIN">
            <Settings />
          </RoleRoute>
        } />

        {/* Agent Routes */}
        <Route path="/agent" element={
          <RoleRoute requiredRole="AGENT">
            <AgentDashboard />
          </RoleRoute>
        } />
        <Route path="/agent/customers" element={<div className="p-8">My Customers (Use 'Collections' for now)</div>} />
        <Route path="/agent/collections" element={
          <RoleRoute requiredRole="AGENT">
            <Collections />
          </RoleRoute>
        } />
      </Route>
    </Routes>
  );
}

import { Settings } from './pages/admin/Settings';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';

// ... (keep internal components)

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <SettingsProvider>
            <AppRoutes />
            <Toaster position="top-right" richColors />
          </SettingsProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
