import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, GraduationCap, Heart, BookOpen,
  ClipboardCheck, BarChart3, FileText, Settings, LogOut,
  CheckSquare, Home, Download, QrCode, Menu, X,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BrandLogo } from '../../brand';

const NAV = {
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Students', path: '/students' },
    { icon: GraduationCap, label: 'Teachers', path: '/teachers' },
    { icon: Heart, label: 'Volunteers', path: '/volunteers' },
    { icon: BookOpen, label: 'Classes', path: '/classes' },
    { icon: ClipboardCheck, label: 'Attendance', path: '/attendance' },
    { icon: QrCode, label: 'QR Attendance', path: '/qr-attendance' },
    { icon: CheckSquare, label: 'Verification', path: '/verification', badge: true },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ],
  editor: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Students', path: '/students' },
    { icon: GraduationCap, label: 'Teachers', path: '/teachers' },
    { icon: Heart, label: 'Volunteers', path: '/volunteers' },
    { icon: ClipboardCheck, label: 'Attendance', path: '/attendance' },
    { icon: UserCheck, label: 'My Submissions', path: '/my-submissions' },
  ],
  viewer: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Students', path: '/students' },
    { icon: GraduationCap, label: 'Teachers', path: '/teachers' },
    { icon: Heart, label: 'Volunteers', path: '/volunteers' },
    { icon: BookOpen, label: 'Classes', path: '/classes' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: FileText, label: 'Reports', path: '/reports' },
  ],
  teacher: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: QrCode, label: 'QR Attendance', path: '/qr-attendance' },
    { icon: ClipboardCheck, label: 'Mark Attendance', path: '/attendance/submit' },
    { icon: Users, label: 'My Class', path: '/my-class' },
    { icon: ClipboardCheck, label: 'History', path: '/my-attendance' },
    { icon: Download, label: 'Export', path: '/teacher-export' },
  ],
};

const ROLE_THEME = {
  admin:   { accent: '#c8922a', light: 'rgba(200,146,42,0.15)', label: 'Administrator' },
  editor:  { accent: '#16a34a', light: 'rgba(22,163,74,0.15)',  label: 'Editor' },
  viewer:  { accent: '#7c3aed', light: 'rgba(124,58,237,0.15)', label: 'Viewer' },
  teacher: { accent: '#2563eb', light: 'rgba(37,99,235,0.15)',  label: 'Teacher' },
};

// ─── Desktop Sidebar ──────────────────────────────────────────────
function DesktopSidebar({ items, theme, user, pendingCount, collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: 'var(--color-primary-dark)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '2px 0 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Logo area — POJ brand logo */}
      <div style={{
        padding: '14px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 68,
      }}>
        {/* Brand logo — circular crop container */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
        }}>
          <BrandLogo size={36} style={{ borderRadius: 8 }} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ minWidth: 0 }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                VBS Management
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                Presence of Jesus Ministry
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User info */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: theme.light, border: `2px solid ${theme.accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 800, flexShrink: 0, color: theme.accent,
        }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 148 }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.65rem', color: theme.accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {theme.label}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
        {items.map(item => {
          const Icon = item.icon;
          const hasBadge = item.badge && pendingCount > 0;
          const isQR = item.path === '/qr-attendance';
          return (
            <NavLink key={item.path} to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 9, margin: '1px 0',
                textDecoration: 'none',
                background: isActive ? theme.light : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.835rem',
                transition: 'all 0.15s',
                borderLeft: isActive ? `3px solid ${theme.accent}` : '3px solid transparent',
              })}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Icon size={17} color={isQR ? '#fbbf24' : undefined} />
                {hasBadge && (
                  <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '0.58rem', fontWeight: 800, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ whiteSpace: 'nowrap', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
          <Home size={17} />
          {!collapsed && <span>Home Page</span>}
        </button>
        <button onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, width: '100%', background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{ position: 'absolute', right: -13, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
      >
        {collapsed
          ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1L3 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        }
      </button>
    </motion.aside>
  );
}

// ─── Mobile Drawer Sidebar ────────────────────────────────────────
function MobileDrawer({ items, theme, user, pendingCount, open, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const handleLogout = async () => { await logout(); navigate('/login'); onClose(); };

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 280, background: 'var(--color-primary-dark)', color: 'white', zIndex: 1001, display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '4px 0 24px rgba(0,0,0,0.3)' }}
          >
            {/* Header with POJ logo */}
            <div style={{ padding: '16px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  <BrandLogo size={36} style={{ borderRadius: 8 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'white' }}>VBS Management</div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>Presence of Jesus Ministry</div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* User */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: theme.light, border: `2px solid ${theme.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, flexShrink: 0, color: theme.accent }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>{user?.name}</div>
                <div style={{ fontSize: '0.7rem', color: theme.accent, fontWeight: 600, textTransform: 'uppercase' }}>{theme.label}</div>
              </div>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, padding: '12px 10px' }}>
              {items.map(item => {
                const Icon = item.icon;
                const hasBadge = item.badge && pendingCount > 0;
                const isQR = item.path === '/qr-attendance';
                return (
                  <NavLink key={item.path} to={item.path} onClick={onClose}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 12px', borderRadius: 10, margin: '2px 0',
                      textDecoration: 'none',
                      background: isActive ? theme.light : 'transparent',
                      color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.9rem', transition: 'all 0.15s',
                      borderLeft: isActive ? `3px solid ${theme.accent}` : '3px solid transparent',
                    })}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Icon size={19} color={isQR ? '#fbbf24' : undefined} />
                      {hasBadge && (
                        <span style={{ position: 'absolute', top: -5, right: -6, background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '0.58rem', fontWeight: 800, width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Bottom */}
            <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => { navigate('/'); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'var(--font-sans)' }}>
                <Home size={18} /> Home Page
              </button>
              <button onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, width: '100%', background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.75)', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'var(--font-sans)' }}>
                <LogOut size={18} /> Logout
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main Sidebar (responsive) ────────────────────────────────────
export default function Sidebar({ pendingCount = 0 }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  const items = NAV[user?.role] || [];
  const theme = ROLE_THEME[user?.role] || ROLE_THEME.viewer;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (isMobile) {
    return (
      <>
        <MobileDrawer items={items} theme={theme} user={user} pendingCount={pendingCount} open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <button
          onClick={() => setMobileOpen(true)}
          style={{ position: 'fixed', top: 14, left: 14, zIndex: 200, width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary-dark)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
        >
          <Menu size={20} color="white" />
        </button>
        <div style={{ width: 0, flexShrink: 0 }} />
      </>
    );
  }

  return (
    <DesktopSidebar
      items={items} theme={theme} user={user}
      pendingCount={pendingCount} collapsed={collapsed} setCollapsed={setCollapsed}
    />
  );
}
