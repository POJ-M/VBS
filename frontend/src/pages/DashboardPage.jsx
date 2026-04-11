import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, GraduationCap, Heart, BookOpen, TrendingUp, Clock, CheckSquare, AlertCircle, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { analyticsAPI, attendanceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { StatCard, LoadingPage, CategoryBadge } from '../components/common';
import { format } from 'date-fns';

function AdminDashboard({ stats, vbsYear }) {
  const navigate = useNavigate();

  const { data: trendsData } = useQuery({
    queryKey: ['attendance-trends', vbsYear],
    queryFn: () => analyticsAPI.getAttendanceTrends({ vbsYear }),
    select: d => d.data?.data,
    enabled: !!vbsYear,
  });

  const studentTrends = (trendsData?.studentTrends || []).slice(-7).map(t => ({
    date: format(new Date(t.date), 'MMM d'),
    rate: Math.round(t.rate || 0),
    present: t.present,
  }));

  return (
    <div>
      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Students"
          value={stats.students?.total}
          icon={Users}
          color="#3b82f6"
          subtitle={`${stats.students?.beginner || 0} Beg · ${stats.students?.primary || 0} Pri · ${stats.students?.junior || 0} Jun · ${stats.students?.inter || 0} Int`}
        />
        <StatCard label="Teachers" value={stats.teachers?.total} icon={GraduationCap} color="#8b5cf6" />
        <StatCard label="Volunteers" value={stats.volunteers?.total} icon={Heart} color="#10b981" />
        <StatCard label="Classes" value={stats.classes?.total} icon={BookOpen} color="#f59e0b" />
      </div>

      {/* Today + Pending verifications */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📅 Today's Attendance</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {format(new Date(), 'EEEE, MMMM d')}
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, background: '#d1fae510', border: '1px solid #10b98130', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                  {stats.today?.presentCount ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                  Present
                </div>
              </div>
              <div style={{ flex: 1, background: '#dbeafe10', border: '1px solid #3b82f630', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6' }}>
                  {stats.today?.attendanceRate ?? 0}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                  Rate
                </div>
              </div>
            </div>

            {stats.today?.pendingClasses > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} />
                  {stats.today.pendingClasses} class{stats.today.pendingClasses > 1 ? 'es' : ''} pending attendance
                </div>
                {stats.today.pendingClassList?.map(c => (
                  <div key={c._id} style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 4, paddingLeft: 20 }}>
                    • {c.name} ({c.category})
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/attendance')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              View Attendance Details
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">⏳ Pending Verifications</span>
            {stats.pendingVerifications?.total > 0 && (
              <span className="badge badge-red">{stats.pendingVerifications.total} pending</span>
            )}
          </div>
          <div className="card-body">
            {stats.pendingVerifications?.total === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-secondary)' }}>
                <CheckSquare size={32} color="var(--color-success)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>All entries verified!</div>
              </div>
            ) : (
              <div>
                {[
                  { label: 'Students', count: stats.pendingVerifications?.students, color: '#3b82f6' },
                  { label: 'Teachers', count: stats.pendingVerifications?.teachers, color: '#8b5cf6' },
                  { label: 'Volunteers', count: stats.pendingVerifications?.volunteers, color: '#10b981' },
                ].filter(item => item.count > 0).map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.label}</span>
                    <span className="badge" style={{ background: `${item.color}20`, color: item.color }}>
                      {item.count} pending
                    </span>
                  </div>
                ))}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/verification')}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
                >
                  Review Queue →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance trend chart */}
      {studentTrends.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">📈 Student Attendance Trend (Last 7 Days)</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={studentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} unit="%" />
                <Tooltip formatter={v => [`${Math.round(v)}%`, 'Attendance Rate']} />
                <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category distribution */}
      <div className="grid-4">
        {[
          { cat: 'Beginner', count: stats.students?.beginner, color: '#8b5cf6' },
          { cat: 'Primary', count: stats.students?.primary, color: '#3b82f6' },
          { cat: 'Junior', count: stats.students?.junior, color: '#10b981' },
          { cat: 'Inter', count: stats.students?.inter, color: '#f59e0b' },
        ].map(({ cat, count, color }) => (
          <div key={cat} className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{count || 0}</div>
            <CategoryBadge category={cat} />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
              {stats.students?.total
                ? Math.round(((count || 0) / stats.students.total) * 100)
                : 0}% of total
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherDashboard({ user }) {
  const navigate = useNavigate();

  const { data: windowData } = useQuery({
    queryKey: ['window-status'],
    queryFn: () => attendanceAPI.getWindowStatus(),
    refetchInterval: 60000,
    select: d => d.data?.data,
  });

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">⏱️ Attendance Window</span>
            <span className={`badge ${windowData?.allowed ? 'badge-green' : 'badge-red'}`}>
              {windowData?.allowed ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              {windowData?.message || 'Loading window status...'}
            </div>
            {windowData?.allowed && windowData?.minutesRemaining > 0 && (
              <div style={{ background: '#fef3c7', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e' }}>
                  {windowData.minutesRemaining} min
                </div>
                <div style={{ fontSize: '0.75rem', color: '#92400e' }}>remaining to submit</div>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Quick Actions</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/attendance/submit')}
              disabled={!windowData?.allowed}
              title={!windowData?.allowed ? windowData?.message : ''}
            >
              ✏️ Mark Student Attendance{' '}
              {!windowData?.allowed && '(Window Closed)'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/my-class')}>
              👥 View My Class
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/my-attendance')}>
              📅 My Attendance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Add Student', path: '/students', icon: Users, color: '#3b82f6', desc: 'Submit for admin approval' },
          { label: 'Add Teacher', path: '/teachers', icon: GraduationCap, color: '#8b5cf6', desc: 'Submit for admin approval' },
          { label: 'Add Volunteer', path: '/volunteers', icon: Heart, color: '#10b981', desc: 'Submit for admin approval' },
        ].map(({ label, path, icon: Icon, color, desc }) => (
          <motion.div
            key={label}
            whileHover={{ y: -3 }}
            className="card"
            style={{ cursor: 'pointer', padding: 24, textAlign: 'center' }}
            onClick={() => navigate(path)}
          >
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Icon size={24} color={color} />
            </div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{desc}</div>
          </motion.div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>My Submissions</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              View the status of all entries you have submitted for approval
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/my-submissions')}>
            View All →
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewerDashboard({ stats }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Students" value={stats.students?.total} icon={Users} color="#3b82f6" />
        <StatCard label="Teachers" value={stats.teachers?.total} icon={GraduationCap} color="#8b5cf6" />
        <StatCard label="Volunteers" value={stats.volunteers?.total} icon={Heart} color="#10b981" />
        <StatCard
          label="Today's Attendance"
          value={`${stats.today?.attendanceRate ?? 0}%`}
          icon={TrendingUp}
          color="#f59e0b"
        />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">📁 Quick Reports</span></div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Daily Report', path: '/reports', icon: Clock },
            { label: 'Full Year', path: '/reports', icon: TrendingUp },
            { label: 'Analytics', path: '/analytics', icon: Eye },
          ].map(({ label, path, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="btn btn-secondary"
              style={{ justifyContent: 'center', flexDirection: 'column', height: 70, gap: 6 }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { vbsYear, activeYear } = useActiveYear();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats', vbsYear],
    queryFn: () => analyticsAPI.getDashboard({ vbsYear }),
    select: d => d.data?.data,
    refetchInterval: 60000,
    enabled: !!vbsYear,
  });

  if (isLoading) return <LoadingPage />;

  const stats = data || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👋 Welcome, {user?.name}</h1>
          <p className="page-subtitle">
            {activeYear
              ? `${activeYear.vbsTitle || `VBS ${vbsYear}`} · ${user?.role}`
              : 'Select a VBS year to get started'}
          </p>
        </div>
      </div>

      {!vbsYear ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--color-text-muted)" style={{ marginBottom: 12 }} />
          <h3>No VBS Year Selected</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6 }}>
            Use the year selector in the top bar to choose a year.
          </p>
        </div>
      ) : (
        <>
          {user?.role === 'admin' && <AdminDashboard stats={stats} vbsYear={vbsYear} />}
          {user?.role === 'teacher' && <TeacherDashboard user={user} />}
          {user?.role === 'editor' && <EditorDashboard />}
          {user?.role === 'viewer' && <ViewerDashboard stats={stats} />}
        </>
      )}
    </div>
  );
}