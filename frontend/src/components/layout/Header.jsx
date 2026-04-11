// Header.jsx — Fix 4: add left padding on mobile for hamburger button
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import YearSelector from './YearSelector';

const PRIORITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8' };

export default function Header({ title }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifs, setShowNotifs] = useState(false);
  // FIX 4: detect mobile to add left padding for hamburger
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data: notifsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getAll({ limit: 10 }),
    refetchInterval: 30000,
  });

  const notifications = notifsData?.data?.data || [];
  const unreadCount = notifsData?.data?.unreadCount || 0;

  const markRead = useMutation({
    mutationFn: (id) => notificationsAPI.markRead(id),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  return (
    <header style={{
      background: 'white', borderBottom: '1px solid var(--color-border)',
      // FIX 4: add left padding on mobile so title doesn't overlap hamburger button
      padding: isMobile ? '0 16px 0 64px' : '0 20px',
      height: 64, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      boxShadow: 'var(--shadow-sm)', gap: 12,
    }}>
      <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '40%' : undefined }}>{title}</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, marginLeft: 'auto' }}>
        {/* Year Selector */}
        {['admin', 'editor', 'viewer'].includes(user?.role) && <YearSelector />}

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotifs(!showNotifs)}
            style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Bell size={17} color="var(--color-text-secondary)" />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '0.58rem', fontWeight: 800, width: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div style={{ position: 'fixed', right: 12, top: 70, width: Math.min(350, window.innerWidth - 24), background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)', zIndex: 200 }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Notifications</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button onClick={() => markAllRead.mutate()} style={{ fontSize: '0.72rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.845rem' }}>No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n._id} onClick={() => { if (!n.isRead) markRead.mutate(n._id); }}
                      style={{ padding: '11px 14px', borderBottom: '1px solid var(--color-border-light)', background: n.isRead ? 'transparent' : '#f0f7ff', cursor: 'pointer', display: 'flex', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[n.priority], marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: n.isRead ? 500 : 700, color: 'var(--color-text)', lineHeight: 1.4 }}>{n.title}</div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      {!n.isRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => navigate('/change-password')}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>{user?.name}</span>
              <span style={{ fontSize: '0.67rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
          )}
        </div>
      </div>

      {showNotifs && <div onClick={() => setShowNotifs(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />}
    </header>
  );
}
