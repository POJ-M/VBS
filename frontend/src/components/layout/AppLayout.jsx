import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import Header from './Header';
import AppFooter from './AppFooter';
import { analyticsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/volunteers': 'Volunteers',
  '/classes': 'Classes',
  '/attendance': 'Attendance',
  '/attendance/submit': 'Mark Attendance',
  '/verification': 'Verification Queue',
  '/analytics': 'Analytics',
  '/reports': 'Reports',
  '/users': 'User Management',
  '/settings': 'VBS Settings',
  '/my-submissions': 'My Submissions',
  '/my-class': 'My Class',
  '/my-attendance': 'My Attendance',
  '/change-password': 'Change Password',
  '/teacher-export': 'Export & Reports',
  '/qr-attendance': 'QR Attendance',
};

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[location.pathname] || 'VBS Management';

  const { data: dashData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsAPI.getDashboard(),
    enabled: user?.role === 'admin',
    refetchInterval: 60000,
    select: (d) => d.data?.data,
  });

  const pendingCount = dashData?.pendingVerifications?.total || 0;

  return (
    <div className="app-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar pendingCount={pendingCount} />

      <div
        className="main-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0, // 🔥 IMPORTANT (fix scroll bug)
        }}
      >
        {/* Header */}
        <Header title={title} />

        {/* Scrollable Content */}
        <div
          className="page-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </div>

        {/* Footer */}
        <AppFooter />
      </div>
    </div>
  );
}
