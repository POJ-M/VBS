import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, User, Calendar, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { attendanceAPI, teachersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { LoadingPage } from '../components/common';

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
});

const fmtDateShort = d => new Date(d).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'
});

const STATUS_CFG = {
  present:  { label: 'Present',  dot: '#16a34a', bg: '#dcfce7', color: '#15803d' },
  absent:   { label: 'Absent',   dot: '#dc2626', bg: '#fee2e2', color: '#b91c1c' },
  late:     { label: 'Late',     dot: '#d97706', bg: '#fef9c3', color: '#a16207' },
  leave:    { label: 'Leave',    dot: '#7c3aed', bg: '#ede9fe', color: '#6d28d9' },
  halfDay:  { label: 'Half Day', dot: '#ea580c', bg: '#ffedd5', color: '#c2410c' },
};

const StatusPill = ({ status }) => {
  const c = STATUS_CFG[status] || { label: status || '—', dot: '#94a3b8', bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: c.bg, color: c.color, fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  );
};

const RateBadge = ({ rate }) => {
  const color = rate >= 80 ? '#15803d' : rate >= 60 ? '#a16207' : '#b91c1c';
  const bg = rate >= 80 ? '#dcfce7' : rate >= 60 ? '#fef9c3' : '#fee2e2';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, background: bg, color, fontSize: '0.75rem', fontWeight: 800 }}>
      {rate}%
    </span>
  );
};

const TimePill = ({ time }) => time ? (
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 99, padding: '2px 8px', color: 'var(--color-text-secondary)' }}>
    {time}
  </span>
) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem' }}>—</span>;

/* ─── Summary Strip ──────────────────────────────────────────────── */
function SummaryStrip({ items }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      {items.map(s => (
        <div key={s.label} style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xs)', minWidth: 90, textAlign: 'center' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color || 'var(--color-primary)', lineHeight: 1 }}>{s.val}</div>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────────── */
function Pager({ page, pages, total, size, onPage }) {
  if (pages <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <div className="pagination">
      <span className="page-info">Showing {from}–{to} of {total}</span>
      <div className="page-btns">
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft size={14} /></button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
          <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onPage(p)} style={{ minWidth: 32, justifyContent: 'center' }}>{p}</button>
        ))}
        {pages > 5 && page < pages && <span style={{ padding: '0 4px', color: 'var(--color-text-muted)' }}>…</span>}
        {pages > 5 && <button className={`btn btn-sm ${pages === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onPage(pages)} style={{ minWidth: 32, justifyContent: 'center' }}>{pages}</button>}
        <button className="btn btn-secondary btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

/* ─── View Toggle ────────────────────────────────────────────────── */
function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: 8, padding: 3, border: '1px solid var(--color-border)', gap: 2, marginLeft: 'auto' }}>
      {['Records', 'Summary'].map(v => (
        <button key={v} onClick={() => setView(v.toLowerCase())}
          style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, background: view === v.toLowerCase() ? 'white' : 'transparent', boxShadow: view === v.toLowerCase() ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
          {v}
        </button>
      ))}
    </div>
  );
}

/* ─── MY OWN ATTENDANCE (Teacher self-view) ──────────────────────── */
export function MyOwnAttendanceRecords() {
  const { user } = useAuth();
  const PAGE = 15;
  const [page, setPage] = useState(1);

  // Step 1: Find the teacher profile linked to this user
  const { data: teachers, isLoading: loadingTeacher } = useQuery({
    queryKey: ['teachers-list-for-self'],
    queryFn: () => teachersAPI.getAll({ isActive: true }),
    select: d => d.data?.data || [],
  });

  const myTeacherProfile = teachers?.find(t =>
    t.user?._id?.toString() === user?._id?.toString() ||
    t.user?.toString() === user?._id?.toString()
  );

  // Step 2: Fetch own attendance records
  const { data: records, isLoading: loadingRecords, refetch, isFetching } = useQuery({
    queryKey: ['my-own-teacher-attendance', myTeacherProfile?._id],
    queryFn: () => attendanceAPI.getTeacherAttendance({ teacherId: myTeacherProfile._id }),
    select: d => d.data?.data || [],
    enabled: !!myTeacherProfile?._id,
  });

  if (loadingTeacher || loadingRecords) return <LoadingPage />;

  if (!myTeacherProfile) {
    return (
      <div style={{ textAlign: 'center', padding: 56, maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <User size={32} color="var(--color-text-muted)" />
        </div>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No Teacher Profile Linked</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Your account is not linked to a teacher profile. Contact your administrator.
        </p>
      </div>
    );
  }

  const allRecords = (records || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const paged = allRecords.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(allRecords.length / PAGE);

  // Compute stats
  const stats = allRecords.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const presentTotal = (stats.present || 0) + (stats.late || 0);
  const rate = allRecords.length > 0 ? Math.round((presentTotal / allRecords.length) * 100) : 0;

  // Calendar heatmap data — last 30 days
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const isoDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const rec = allRecords.find(r => {
      const rd = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return rd === isoDate;
    });
    last30.push({ date: d, isoDate, status: rec?.status || null, arrivalTime: rec?.arrivalTime || null });
  }

  return (
    <div>
      {/* Profile Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
        borderRadius: 16, padding: '18px 22px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.25)' }}>
          <User size={24} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'white' }}>{myTeacherProfile.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
            {myTeacherProfile.classAssigned?.name
              ? <>Class: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{myTeacherProfile.classAssigned.name}</strong> ({myTeacherProfile.classAssigned.category})</>
              : <span style={{ color: 'rgba(255,255,255,0.5)' }}>No class assigned</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Days', val: allRecords.length, color: 'rgba(255,255,255,0.9)' },
            { label: 'Present', val: stats.present || 0, color: '#86efac' },
            { label: 'Late', val: stats.late || 0, color: '#fde68a' },
            { label: 'Absent', val: stats.absent || 0, color: '#fca5a5' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: rate >= 80 ? '#86efac' : rate >= 60 ? '#fde68a' : '#fca5a5', lineHeight: 1 }}>{rate}%</div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>Rate</div>
          </div>
        </div>
      </div>

      {/* 30-day Calendar Heatmap */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} color="var(--color-primary)" /> Last 30 Days
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Present', color: '#16a34a', bg: '#dcfce7' },
              { label: 'Late', color: '#d97706', bg: '#fef9c3' },
              { label: 'Absent', color: '#dc2626', bg: '#fee2e2' },
              { label: 'No Record', color: '#94a3b8', bg: '#f1f5f9' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: `1px solid ${l.color}40` }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
          {last30.map((d, idx) => {
            const s = d.status;
            const bg = s === 'present' ? '#dcfce7' : s === 'late' ? '#fef9c3' : s === 'absent' ? '#fee2e2' : s === 'leave' ? '#ede9fe' : '#f1f5f9';
            const border = s === 'present' ? '#86efac' : s === 'late' ? '#fde68a' : s === 'absent' ? '#fca5a5' : s === 'leave' ? '#c4b5fd' : '#e2e8f0';
            const textColor = s === 'present' ? '#15803d' : s === 'late' ? '#a16207' : s === 'absent' ? '#b91c1c' : s === 'leave' ? '#6d28d9' : '#9ca3af';
            const dayLabel = d.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' });
            const monthLabel = d.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' });
            return (
              <div key={idx} title={`${fmtDateShort(d.date)}${s ? ` — ${STATUS_CFG[s]?.label || s}` : ' — No Record'}${d.arrivalTime ? ` at ${d.arrivalTime}` : ''}`}
                style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 7, padding: '5px 3px', textAlign: 'center', cursor: 'default', transition: 'transform 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: textColor, lineHeight: 1 }}>{dayLabel}</div>
                <div style={{ fontSize: '0.55rem', color: textColor, opacity: 0.7, marginTop: 1 }}>{monthLabel}</div>
                {s && <div style={{ fontSize: '0.5rem', fontWeight: 800, color: textColor, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s === 'present' ? '✓' : s === 'late' ? 'L' : s === 'absent' ? '✗' : s === 'leave' ? 'Lv' : ''}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Records Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} color="var(--color-primary)" />
            Attendance History
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{allRecords.length} records</span>
            <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {allRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--color-text-muted)' }} />
            No attendance records found yet.
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Arrival Time</th>
                    <th>Departure Time</th>
                    <th>Remarks</th>
                    <th>Marked By</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmtDate(r.date)}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td><TimePill time={r.arrivalTime} /></td>
                      <td><TimePill time={r.departureTime} /></td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.remarks || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem' }}>{r.markedByName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pages={pages} total={allRecords.length} size={PAGE} onPage={p => setPage(p)} />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── TEACHER ATTENDANCE RECORDS (admin view) ─────────────────────── */
export function TeacherAttendanceRecords() {
  const PAGE = 20;
  const [page, setPage] = useState(1);
  const [view, setView] = useState('records');
  const [teacherId, setTeacherId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: teachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => teachersAPI.getAll().then(r => r.data?.data || []),
  });

  const { data: records, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['teacher-att-records', teacherId, dateFrom, dateTo],
    queryFn: () => attendanceAPI.getTeacherAttendance({
      teacherId: teacherId || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }).then(r => r.data?.data || []),
  });

  const allRecords = records || [];
  const filtered = statusFilter ? allRecords.filter(r => r.status === statusFilter) : allRecords;
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(filtered.length / PAGE);

  const stats = allRecords.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  const presentTotal = (stats.present || 0) + (stats.late || 0);
  const rate = allRecords.length ? Math.round((presentTotal / allRecords.length) * 100) : 0;

  // Per-teacher summary
  const byTeacher = allRecords.reduce((acc, r) => {
    const name = r.teacher?.name || 'Unknown';
    if (!acc[name]) acc[name] = { name, present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    acc[name][r.status] = (acc[name][r.status] || 0) + 1;
    acc[name].total += 1;
    return acc;
  }, {});

  const clearFilters = () => { setTeacherId(''); setDateFrom(''); setDateTo(''); setStatusFilter(''); setPage(1); };
  const hasFilters = teacherId || dateFrom || dateTo || statusFilter;

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Teacher</label>
          <select className="form-select" style={{ width: 180 }} value={teacherId} onChange={e => { setTeacherId(e.target.value); setPage(1); }}>
            <option value="">All Teachers</option>
            {(teachers || []).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Status</label>
          <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['present', 'absent', 'late', 'leave'].map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>From</label>
          <input className="form-input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ width: 160 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>To</label>
          <input className="form-input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} min={dateFrom} style={{ width: 160 }} />
        </div>
        {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginBottom: 1 }}>✕ Clear</button>}
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()} style={{ marginBottom: 1 }} disabled={isFetching}>
          <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
        </button>
        <ViewToggle view={view} setView={setView} />
      </div>

      {/* Summary strip */}
      <SummaryStrip items={[
        { label: 'Total Records', val: allRecords.length, color: '#3b82f6' },
        { label: 'Present', val: stats.present || 0, color: '#16a34a' },
        { label: 'Absent', val: stats.absent || 0, color: '#dc2626' },
        { label: 'Late', val: stats.late || 0, color: '#d97706' },
        { label: 'Leave', val: stats.leave || 0, color: '#7c3aed' },
        { label: 'Attendance Rate', val: <RateBadge rate={rate} /> },
      ]} />

      {view === 'summary' ? (
        /* Per-teacher summary */
        <div className="card">
          <div className="card-header"><span className="card-title">Per-Teacher Summary</span></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Late</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Leave</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(byTeacher).sort((a, b) => b.total - a.total).map(s => {
                  const att = (s.present || 0) + (s.late || 0);
                  const r = s.total ? Math.round((att / s.total) * 100) : 0;
                  return (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.present || 0}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#d97706', fontWeight: 700 }}>{s.late || 0}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#dc2626', fontWeight: 700 }}>{s.absent || 0}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#7c3aed', fontWeight: 700 }}>{s.leave || 0}</span></td>
                      <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{s.total}</td>
                      <td><RateBadge rate={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed records */
        <div className="card">
          <div className="card-header">
            <span className="card-title">Teacher Attendance Records</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{filtered.length} records{statusFilter ? ` (filtered)` : ''}</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>No records found. Adjust your filters.</div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Teacher</th>
                      <th>Class Assigned</th>
                      <th>Status</th>
                      <th>Arrival</th>
                      <th>Departure</th>
                      <th>Remarks</th>
                      <th>Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmtDate(r.date)}</td>
                        <td style={{ fontWeight: 600 }}>{r.teacher?.name || '—'}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                          {r.teacher?.classAssigned?.name || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>
                        <td><StatusPill status={r.status} /></td>
                        <td><TimePill time={r.arrivalTime} /></td>
                        <td><TimePill time={r.departureTime} /></td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.remarks || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem' }}>{r.markedByName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={p => setPage(p)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── VOLUNTEER ATTENDANCE RECORDS ───────────────────────────────── */
export function VolunteerAttendanceRecords() {
  const PAGE = 20;
  const [page, setPage] = useState(1);
  const [view, setView] = useState('records');
  const [volunteerId, setVolunteerId] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Import volunteersAPI inline to avoid circular import
  const { data: volunteers } = useQuery({
    queryKey: ['vol-list'],
    queryFn: () => import('../services/api').then(m => m.volunteersAPI.getAll().then(r => r.data?.data || [])),
  });

  const { data: records, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vol-att-records', volunteerId, roleFilter, dateFrom, dateTo],
    queryFn: () => attendanceAPI.getVolunteerAttendance({
      volunteerId: volunteerId || undefined,
      role: roleFilter || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }).then(r => r.data?.data || []),
  });

  const allRecords = records || [];
  const filtered = statusFilter ? allRecords.filter(r => r.status === statusFilter) : allRecords;
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(filtered.length / PAGE);

  const stats = allRecords.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  const presentTotal = (stats.present || 0) + (stats.halfDay || 0);
  const rate = allRecords.length ? Math.round((presentTotal / allRecords.length) * 100) : 0;
  const uniqueRoles = [...new Set((volunteers || []).map(v => v.role).filter(Boolean))];

  const byVol = allRecords.reduce((acc, r) => {
    const name = r.volunteer?.name || 'Unknown';
    const role = r.volunteer?.role || '—';
    if (!acc[name]) acc[name] = { name, role, present: 0, halfDay: 0, absent: 0, late: 0, total: 0 };
    acc[name][r.status] = (acc[name][r.status] || 0) + 1;
    acc[name].total += 1;
    return acc;
  }, {});

  const clearFilters = () => { setVolunteerId(''); setRoleFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const hasFilters = volunteerId || roleFilter || statusFilter || dateFrom || dateTo;

  if (isLoading) return <LoadingPage />;

  const SHIFT_COLORS = { Morning: '#dbeafe', Afternoon: '#fef9c3', 'Full Day': '#dcfce7' };
  const SHIFT_TEXT = { Morning: '#1d4ed8', Afternoon: '#a16207', 'Full Day': '#15803d' };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Volunteer</label>
          <select className="form-select" style={{ width: 180 }} value={volunteerId} onChange={e => { setVolunteerId(e.target.value); setPage(1); }}>
            <option value="">All Volunteers</option>
            {(volunteers || []).map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
        </div>
        {uniqueRoles.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Role</label>
            <select className="form-select" style={{ width: 150 }} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="">All Roles</option>
              {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Status</label>
          <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {['present', 'absent', 'halfDay', 'late'].map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>From</label>
          <input className="form-input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ width: 160 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>To</label>
          <input className="form-input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} min={dateFrom} style={{ width: 160 }} />
        </div>
        {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginBottom: 1 }}>✕ Clear</button>}
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()} style={{ marginBottom: 1 }} disabled={isFetching}>
          <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
        </button>
        <ViewToggle view={view} setView={setView} />
      </div>

      {/* Summary strip */}
      <SummaryStrip items={[
        { label: 'Total', val: allRecords.length, color: '#3b82f6' },
        { label: 'Present', val: stats.present || 0, color: '#16a34a' },
        { label: 'Half Day', val: stats.halfDay || 0, color: '#ea580c' },
        { label: 'Absent', val: stats.absent || 0, color: '#dc2626' },
        { label: 'Late', val: stats.late || 0, color: '#d97706' },
        { label: 'Rate', val: <RateBadge rate={rate} /> },
      ]} />

      {view === 'summary' ? (
        <div className="card">
          <div className="card-header"><span className="card-title">Per-Volunteer Summary</span></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Volunteer</th><th>Role</th>
                  <th style={{ textAlign: 'center' }}>Present</th>
                  <th style={{ textAlign: 'center' }}>Half Day</th>
                  <th style={{ textAlign: 'center' }}>Absent</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(byVol).sort((a, b) => b.total - a.total).map(s => {
                  const att = (s.present || 0) + (s.halfDay || 0);
                  const r = s.total ? Math.round((att / s.total) * 100) : 0;
                  return (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>{s.role}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.present || 0}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#ea580c', fontWeight: 700 }}>{s.halfDay || 0}</span></td>
                      <td style={{ textAlign: 'center' }}><span style={{ color: '#dc2626', fontWeight: 700 }}>{s.absent || 0}</span></td>
                      <td style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{s.total}</td>
                      <td><RateBadge rate={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Volunteer Attendance Records</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{filtered.length} records</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>No records found. Adjust your filters.</div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Volunteer</th><th>Role</th>
                      <th>Status</th><th>Shift</th>
                      <th>Check-In</th><th>Check-Out</th>
                      <th>Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{fmtDate(r.date)}</td>
                        <td style={{ fontWeight: 600 }}>{r.volunteer?.name || '—'}</td>
                        <td>
                          {r.volunteer?.role
                            ? <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>{r.volunteer.role}</span>
                            : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>}
                        </td>
                        <td><StatusPill status={r.status} /></td>
                        <td>
                          {r.shift ? (
                            <span style={{ fontSize: '0.73rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: SHIFT_COLORS[r.shift] || '#f1f5f9', color: SHIFT_TEXT[r.shift] || '#475569' }}>
                              {r.shift}
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem' }}>—</span>}
                        </td>
                        <td><TimePill time={r.checkInTime} /></td>
                        <td><TimePill time={r.checkOutTime} /></td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem' }}>{r.markedByName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pages={pages} total={filtered.length} size={PAGE} onPage={p => setPage(p)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
