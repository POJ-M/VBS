import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Edit2, Trash2, History, Save, Check, X, Clock, AlertCircle,
  RefreshCw, ChevronLeft, ChevronRight, Users, GraduationCap,
  Heart, Calendar, CheckSquare, AlertTriangle, Info, BarChart2,
  Download, Printer, FileText, UserCheck
} from 'lucide-react';
import { attendanceAPI, classesAPI, teachersAPI, volunteersAPI, settingsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import DateInput from '../components/Dateinput';
import { MyOwnAttendanceRecords } from './Attendancerecordsview';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────
const getTodayIST = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', weekday: 'short'
    });
  } catch { return dateStr; }
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
};

// ─── Status Badge ──────────────────────────────────────────────────
const STATUS_MAP = {
  present: { bg: '#dcfce7', color: '#15803d', label: '✓ Present' },
  absent: { bg: '#fee2e2', color: '#b91c1c', label: '✗ Absent' },
  late: { bg: '#fef9c3', color: '#a16207', label: '⏰ Late' },
  leave: { bg: '#ede9fe', color: '#6d28d9', label: '📋 Leave' },
  halfDay: { bg: '#ffedd5', color: '#c2410c', label: '½ Half Day' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || { bg: '#f1f5f9', color: '#475569', label: status || '—' };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
};

const RateBar = ({ rate }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 56, height: 5, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${rate}%`, height: '100%', borderRadius: 99, background: rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626', transition: 'width 0.4s' }} />
    </div>
    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: rate >= 80 ? '#15803d' : rate >= 60 ? '#a16207' : '#b91c1c' }}>{rate}%</span>
  </div>
);

// ─── Window Status Banner ──────────────────────────────────────────
function WindowBanner({ showForTeacher }) {
  const { data: windowData, refetch } = useQuery({
    queryKey: ['window-status'],
    queryFn: () => attendanceAPI.getWindowStatus().then(r => r.data?.data),
    refetchInterval: 60000,
  });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderRadius: 10, marginBottom: 16, flexWrap: 'wrap',
      background: windowData?.allowed ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${windowData?.allowed ? '#bbf7d0' : '#fecaca'}`
    }}>
      <span style={{
        padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        background: windowData?.allowed ? '#16a34a' : '#dc2626', color: 'white'
      }}>
        {windowData?.allowed ? 'Window OPEN' : 'Window CLOSED'}
      </span>
      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', flex: 1 }}>
        {windowData?.message || 'Loading...'}
      </span>
      {windowData?.allowed && windowData?.minutesRemaining > 0 && (
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '3px 10px', borderRadius: 99 }}>
          <Clock size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {windowData.minutesRemaining} min remaining
        </span>
      )}
      <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
        <RefreshCw size={14} />
      </button>
    </div>
  );
}

// ─── Pending Classes Panel ─────────────────────────────────────────
function PendingClassesPanel({ date, vbsYear, classes, submittedRecords, onSubmitForClass }) {
  const submittedClassIds = new Set((submittedRecords || []).map(r => r.class?._id?.toString() || r.class?.toString()));
  const pendingClasses = (classes || []).filter(c => !submittedClassIds.has(c._id?.toString()));

  if (pendingClasses.length === 0) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckSquare size={18} color="#16a34a" />
        <div>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.875rem' }}>All classes have submitted attendance!</div>
          <div style={{ color: '#166534', fontSize: '0.78rem', marginTop: 2 }}>{formatDisplayDate(date)} — {(classes || []).length} classes submitted</div>
        </div>
      </div>
    );
  }

  const CATEGORY_COLORS = { Beginner: '#ede9fe', Primary: '#dbeafe', Junior: '#dcfce7', Inter: '#fef9c3' };
  const CATEGORY_TEXT = { Beginner: '#5b21b6', Primary: '#1d4ed8', Junior: '#15803d', Inter: '#92400e' };

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#d97706" />
          <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.875rem' }}>
            {pendingClasses.length} class{pendingClasses.length > 1 ? 'es' : ''} pending attendance
          </span>
          <span style={{ fontSize: '0.75rem', color: '#a16207', background: '#fef3c7', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
            {formatShortDate(date)}
          </span>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#a16207' }}>
          {(submittedRecords || []).length}/{(classes || []).length} submitted
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {pendingClasses.map(cls => (
          <div key={cls._id}
            style={{
              background: 'white', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text)' }}>{cls.name}</div>
              <span style={{
                fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px', borderRadius: 99,
                background: CATEGORY_COLORS[cls.category] || '#f1f5f9',
                color: CATEGORY_TEXT[cls.category] || '#475569',
              }}>
                {cls.category}
              </span>
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
              {cls.teacher?.name || 'No teacher assigned'}
              {cls.studentCount !== undefined && (
                <span style={{ marginLeft: 4, color: cls.studentCount === 0 ? '#dc2626' : 'inherit' }}>
                  · {cls.studentCount === 0 ? 'No students yet' : `${cls.studentCount} students`}
                </span>
              )}
            </div>
            {onSubmitForClass && (
              <button
                onClick={() => onSubmitForClass(cls)}
                style={{
                  padding: '4px 0', borderRadius: 6, border: '1px solid #fbbf24',
                  background: '#fef3c7', fontSize: '0.7rem', fontWeight: 700,
                  cursor: 'pointer', color: '#92400e', fontFamily: 'var(--font-sans)',
                  textAlign: 'center',
                }}
              >
                Submit Now →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Export Attendance Modal ───────────────────────────────────────
function ExportAttendanceModal({ isOpen, onClose, date, records, classes }) {
  const [selectedClasses, setSelectedClasses] = useState([]);

  useEffect(() => {
    if (isOpen) setSelectedClasses((records || []).map(r => r._id));
  }, [isOpen, records]);

  if (!isOpen) return null;

  const toggleClass = (id) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handlePrint = () => {
    const selectedRecords = (records || []).filter(r => selectedClasses.includes(r._id));

    const summaryRows = selectedRecords.map(rec => {
      const present = rec.records?.filter(r => r.status === 'present').length || 0;
      const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
      const total = present + absent;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return `<tr>
        <td>${rec.class?.name || '—'}</td>
        <td><span style="padding:2px 8px;border-radius:99px;font-size:0.72rem;font-weight:700;background:${
          rec.class?.category === 'Beginner' ? '#ede9fe' : rec.class?.category === 'Primary' ? '#dbeafe' : rec.class?.category === 'Junior' ? '#dcfce7' : '#fef9c3'
        };color:${
          rec.class?.category === 'Beginner' ? '#5b21b6' : rec.class?.category === 'Primary' ? '#1d4ed8' : rec.class?.category === 'Junior' ? '#15803d' : '#92400e'
        }">${rec.class?.category || '—'}</span></td>
        <td>${rec.submittedByName || '—'}</td>
        <td style="color:#15803d;font-weight:700;text-align:center">${present}</td>
        <td style="color:#b91c1c;font-weight:700;text-align:center">${absent}</td>
        <td style="text-align:center"><span style="padding:2px 8px;border-radius:99px;font-size:0.75rem;font-weight:800;background:${rate>=80?'#dcfce7':rate>=60?'#fef9c3':'#fee2e2'};color:${rate>=80?'#15803d':rate>=60?'#a16207':'#b91c1c'}">${rate}%</span></td>
        <td>${rec.isModified ? '<span style="color:#c2410c;font-weight:700">⚠ Modified</span>' : '<span style="color:#15803d">✓ Original</span>'}</td>
      </tr>`;
    }).join('');

    const classDetails = selectedRecords.map(rec => {
      const present = rec.records?.filter(r => r.status === 'present').length || 0;
      const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
      const total = present + absent;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      const studentRows = (rec.records || []).map((r, idx) => `
        <tr style="background:${idx%2===0?'#f9fafb':'white'}">
          <td style="text-align:center;color:#888;font-size:0.8rem">${idx + 1}</td>
          <td style="font-family:monospace;font-size:0.8rem;color:#1a2f5e">${r.student?.studentId || '—'}</td>
          <td style="font-weight:600">${r.student?.name || '—'}</td>
          <td style="color:#555;font-size:0.82rem">${r.student?.grade || '—'}</td>
          <td><span style="padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;background:${r.status === 'present' ? '#dcfce7' : '#fee2e2'};color:${r.status === 'present' ? '#15803d' : '#b91c1c'}">${r.status === 'present' ? '✓ Present' : '✗ Absent'}</span></td>
        </tr>
      `).join('');

      return `
        <div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#1a2f5e;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:800;font-size:1rem">${rec.class?.name || '—'}</span>
              <span style="font-size:0.75rem;opacity:0.75;margin-left:8px">${rec.class?.category}</span>
            </div>
            <div style="display:flex;gap:16px;font-size:0.8rem">
              <span>Teacher: ${rec.submittedByName || '—'}</span>
              <span style="color:#86efac;font-weight:700">✓ ${present} Present</span>
              <span style="color:#fca5a5;font-weight:700">✗ ${absent} Absent</span>
              <span style="background:#fbbf24;color:#1a1a1a;padding:2px 8px;border-radius:99px;font-weight:800">${rate}%</span>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f4f6fb">
                <th style="padding:6px 10px;text-align:center;font-size:0.7rem;color:#888;text-transform:uppercase">#</th>
                <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#888;text-transform:uppercase">Student ID</th>
                <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#888;text-transform:uppercase">Name</th>
                <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#888;text-transform:uppercase">Grade</th>
                <th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:#888;text-transform:uppercase">Status</th>
              </tr>
            </thead>
            <tbody>${studentRows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Attendance Export — ${formatDisplayDate(date)}</title>
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #111; }
      h1 { font-size: 15pt; font-weight: 800; color: #1a2f5e; }
      h2 { font-size: 11pt; font-weight: 700; color: #c8922a; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a2f5e; color: white; padding: 6px 10px; text-align: left; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 7px 10px; border-bottom: 1px solid #e8edf2; }
      .footer { margin-top: 20px; font-size: 7.5pt; color: #888; border-top: 1px solid #ddd; padding-top: 8px; display: flex; justify-content: space-between; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div style="border-bottom:3px solid #1a2f5e;padding-bottom:10px;margin-bottom:14px; display:flex; align-items:center; gap:10px;">
      <img src="/poj-logo.png" alt="POJ Logo" style="height:40px; width:auto; object-fit:contain;" />
      <div>
        <h1 style="margin:0;">Presence of Jesus Ministry</h1>
        <h2 style="margin:0;">Student Attendance — ${formatDisplayDate(date)}</h2>
      </div>
    </div>
    <h3 style="font-size:0.82rem;font-weight:700;color:#1a2f5e;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em">Summary</h3>
    <table style="margin-bottom:20px">
      <thead><tr>
        <th>Class</th><th>Category</th><th>Submitted By</th>
        <th style="text-align:center">Present</th><th style="text-align:center">Absent</th>
        <th style="text-align:center">Rate</th><th>Flag</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
    <h3 style="font-size:0.82rem;font-weight:700;color:#1a2f5e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em">Class-wise Student Details</h3>
    ${classDetails}
    <div class="footer">
      <span>VBS Management System — Presence of Jesus Ministry</span>
      <span>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 600);
    }
  };

  const totalPresent = (records || []).filter(r => selectedClasses.includes(r._id)).reduce((s, r) => s + (r.records?.filter(x => x.status === 'present').length || 0), 0);
  const totalAbsent = (records || []).filter(r => selectedClasses.includes(r._id)).reduce((s, r) => s + (r.records?.filter(x => x.status === 'absent').length || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Export Attendance</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{formatDisplayDate(date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Classes', value: selectedClasses.length, color: '#3b82f6' },
              { label: 'Present', value: totalPresent, color: '#16a34a' },
              { label: 'Absent', value: totalAbsent, color: '#dc2626' },
              { label: 'Rate', value: (totalPresent + totalAbsent) > 0 ? `${Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)}%` : '—', color: '#8b5cf6' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--color-bg)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select Classes to Export</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedClasses((records || []).map(r => r._id))}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'white', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Select All
            </button>
            <button onClick={() => setSelectedClasses([])}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'white', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Clear
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {(records || []).map(rec => {
              const isSelected = selectedClasses.includes(rec._id);
              const present = rec.records?.filter(r => r.status === 'present').length || 0;
              const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
              const total = present + absent;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;
              return (
                <div key={rec._id}
                  onClick={() => toggleClass(rec._id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 10, background: isSelected ? 'rgba(26,47,94,0.04)' : 'white',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`, background: isSelected ? 'var(--color-primary)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isSelected && <Check size={11} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.845rem' }}>{rec.class?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>{rec.class?.category} · {rec.records?.length || 0} students · by {rec.submittedByName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>{present}✓</span>
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>{absent}✗</span>
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 800, background: rate >= 80 ? '#dcfce7' : rate >= 60 ? '#fef9c3' : '#fee2e2', color: rate >= 80 ? '#15803d' : rate >= 60 ? '#a16207' : '#b91c1c' }}>{rate}%</span>
                    {rec.isModified && <span style={{ fontSize: '0.65rem', color: '#c2410c', fontWeight: 700 }}>⚠ Mod</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'white' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={selectedClasses.length === 0} onClick={handlePrint}>
            <Printer size={15} /> Print / Export PDF ({selectedClasses.length} classes)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Teacher: Mark Student Attendance ─────────────────────────────
function TeacherMarkAttendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(getTodayIST());
  const [records, setRecords] = useState({});
  const todayIST = getTodayIST();

  const { data: windowData } = useQuery({
    queryKey: ['window-status'],
    queryFn: () => attendanceAPI.getWindowStatus().then(r => r.data?.data),
    refetchInterval: 60000,
  });

  const { data: activeSettings } = useQuery({
    queryKey: ['active-settings-teacher'],
    queryFn: () => settingsAPI.getActive().then(r => r.data?.data),
  });

  const { data: classData, isLoading: loadingClass } = useQuery({
    queryKey: ['my-class-full', user._id],
    queryFn: async () => {
      const { data: tData } = await teachersAPI.getAll();
      const teacher = tData.data?.find(t =>
        t.user?._id?.toString() === user._id?.toString() ||
        t.user?.toString() === user._id?.toString()
      );
      if (!teacher?.classAssigned?._id && !teacher?.classAssigned) return null;
      const classId = teacher.classAssigned?._id || teacher.classAssigned;
      const { data: clsData } = await classesAPI.getOne(classId);
      return { ...clsData.data, teacherName: teacher.name };
    },
  });

  const { data: existingRecord, isLoading: checkingExisting } = useQuery({
    queryKey: ['attendance-check', date, classData?._id],
    queryFn: () => attendanceAPI.getStudentAttendance({ date, classId: classData._id }).then(r => r.data?.data?.[0]),
    enabled: !!classData?._id,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => attendanceAPI.submitStudentAttendance(data),
    onSuccess: () => {
      toast.success('Attendance submitted successfully!');
      qc.invalidateQueries(['attendance-check']);
      qc.invalidateQueries(['teacher-history']);
      setRecords({});
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Submission failed'),
  });

  if (loadingClass) return <div className="loading-center"><div className="spinner" /></div>;

  if (!classData) return (
    <div style={{ textAlign: 'center', padding: 56, maxWidth: 420, margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Users size={32} color="var(--color-text-muted)" />
      </div>
      <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No Class Assigned</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        Contact your administrator to get a class assigned to your account.
      </p>
    </div>
  );

  const students = classData.students || [];
  const alreadySubmitted = !!existingRecord;
  const isToday = date === todayIST;
  const windowOpen = windowData?.allowed;
  const canSubmit = isToday && windowOpen && !alreadySubmitted;

  const markedCount = Object.keys(records).length;
  const presentCount = Object.values(records).filter(v => v === 'present').length;
  const unmarked = students.length - markedCount;

  const markAll = (status) => {
    const all = {};
    students.forEach(s => { all[s._id] = status; });
    setRecords(all);
  };

  const handleSubmit = () => {
    const recs = students.map(s => ({ studentId: s._id, status: records[s._id] || 'absent' }));
    submitMutation.mutate({ date, classId: classData._id, records: recs });
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      <WindowBanner showForTeacher />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <DateInput
            label="Attendance Date"
            value={date}
            onChange={(v) => { setDate(v); setRecords({}); }}
            max={todayIST}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays={true}
          />
        </div>
        <div style={{ flex: 2, padding: '8px 14px', background: 'var(--color-bg)', borderRadius: 10, border: '1px solid var(--color-border)', minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class</div>
          <div style={{ fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {classData.name}{' '}
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
              · {classData.category} · {students.length} students
            </span>
          </div>
        </div>
      </div>

      {alreadySubmitted && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <Check size={15} style={{ flexShrink: 0 }} />
          <div>Attendance already submitted for <strong>{formatDisplayDate(date)}</strong>.</div>
        </div>
      )}
      {!isToday && !alreadySubmitted && !checkingExisting && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <div>No record found for <strong>{formatDisplayDate(date)}</strong>. You can only submit for today within the open window.</div>
        </div>
      )}
      {isToday && !windowOpen && !alreadySubmitted && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <Clock size={15} style={{ flexShrink: 0 }} />
          <div>Attendance window is <strong>closed</strong>. Contact admin for late submissions.</div>
        </div>
      )}

      {canSubmit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => markAll('present')}>
            <Check size={14} /> All Present
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => markAll('absent')}>
            <X size={14} /> All Absent
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRecords({})}>
            <RefreshCw size={14} /> Clear
          </button>
          {markedCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', padding: '4px 12px', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ {presentCount}</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ {markedCount - presentCount}</span>
              {unmarked > 0 && <span style={{ color: 'var(--color-text-muted)' }}>{unmarked} left</span>}
            </span>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{classData.name} — {formatDisplayDate(date)}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Name</th>
                <th style={{ width: 70 }}>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const submittedStatus = existingRecord?.records?.find(
                  r => r.student?._id?.toString() === s._id?.toString() || r.student?.toString() === s._id?.toString()
                )?.status;
                const currentStatus = alreadySubmitted ? submittedStatus : records[s._id];

                return (
                  <tr key={s._id} style={{ background: canSubmit && records[s._id] ? 'rgba(26,47,94,0.02)' : undefined }}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {['PreKG', 'LKG', 'UKG'].includes(s.grade) ? s.grade : `Std ${s.grade}`}
                    </td>
                    <td>
                      {alreadySubmitted ? (
                        <StatusBadge status={currentStatus} />
                      ) : canSubmit ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          {['present', 'absent'].map(st => (
                            <button key={st} onClick={() => setRecords(r => ({ ...r, [s._id]: st }))}
                              style={{
                                padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.12s',
                                background: currentStatus === st
                                  ? (st === 'present' ? '#16a34a' : '#dc2626')
                                  : 'var(--color-bg)',
                                color: currentStatus === st ? 'white' : 'var(--color-text-secondary)',
                              }}>
                              {st === 'present' ? '✓' : '✗'}
                              <span className="sm-label"> {st === 'present' ? 'P' : 'A'}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canSubmit && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {unmarked > 0
                ? <span style={{ color: '#d97706' }}>⚠️ {unmarked} unmarked → Absent</span>
                : <span style={{ color: '#16a34a' }}>✓ All {students.length} marked</span>
              }
            </div>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Submitting...</> : <><Save size={15} /> Submit</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Teacher: Attendance History (submissions) ─────────────────────
function TeacherAttendanceHistory() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const pageSize = 10;
 
  const { data: classData } = useQuery({
    queryKey: ['my-class-full', user._id],
    queryFn: async () => {
      const { data: tData } = await teachersAPI.getAll();
      const teacher = tData.data?.find(t =>
        t.user?._id?.toString() === user._id?.toString() ||
        t.user?.toString() === user._id?.toString()
      );
      if (!teacher?.classAssigned?._id && !teacher?.classAssigned) return null;
      const classId = teacher.classAssigned?._id || teacher.classAssigned;
      const { data: clsData } = await classesAPI.getOne(classId);
      return clsData.data;
    },
  });
 
  const { data: history, isLoading } = useQuery({
    queryKey: ['teacher-history', classData?._id],
    queryFn: () => attendanceAPI.getStudentAttendance({ classId: classData._id }).then(r => r.data?.data || []),
    enabled: !!classData?._id,
  });
 
  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;
 
  const sortedAsc = [...(history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalRecords = sortedAsc.length;
 
  const dayNumberMap = {};
  sortedAsc.forEach((rec, idx) => {
    dayNumberMap[rec._id] = idx + 1;
  });
 
  const sortedDesc = [...sortedAsc].reverse();
  const totalPages = Math.ceil(sortedDesc.length / pageSize);
  const paged = sortedDesc.slice((page - 1) * pageSize, page * pageSize);
 
  if (totalRecords === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <Calendar size={36} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
      <h3>No attendance records yet</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 6 }}>Records appear after you submit attendance.</p>
    </div>
  );
 
  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
        {totalRecords} submission records for {classData?.name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paged.map(rec => {
          const present = rec.records?.filter(r => r.status === 'present').length || 0;
          const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
          const total = present + absent;
          const rate = total > 0 ? Math.round((present / total) * 100) : 0;
          const dayNum = dayNumberMap[rec._id];
          return (
            <div key={rec._id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-navy">Day {dayNum}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatDisplayDate(rec.date)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    By {rec.submittedByName} · {rec.isModified ? <span style={{ color: '#c2410c', fontWeight: 700 }}>Modified</span> : <span style={{ color: '#16a34a' }}>Original</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>{present}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>PRESENT</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626' }}>{absent}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>ABSENT</div>
                  </div>
                  <RateBar rate={rate} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft size={14} /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)} style={{ minWidth: 32, justifyContent: 'center' }}>{p}</button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Staff Attendance Panel ────────────────────────────────────────
function StaffAttendancePanel({ type }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(getTodayIST());
  const [statuses, setStatuses] = useState({});
  const [times, setTimes] = useState({});
  const [remarks, setRemarks] = useState({});
  const todayIST = getTodayIST();
  const isTeacher = type === 'teacher';

  const { data: activeSettings } = useQuery({
    queryKey: ['active-settings-staff'],
    queryFn: () => settingsAPI.getActive().then(r => r.data?.data),
  });

  const { data: entities, isLoading } = useQuery({
    queryKey: [`${type}s-list`],
    queryFn: () => isTeacher
      ? teachersAPI.getAll({ isActive: true }).then(r => r.data?.data || [])
      : volunteersAPI.getAll({ isActive: true }).then(r => r.data?.data || []),
  });

  const { data: existingRecords } = useQuery({
    queryKey: [`${type}-attendance-date`, date],
    queryFn: () => isTeacher
      ? attendanceAPI.getTeacherAttendance({ date }).then(r => r.data?.data || [])
      : attendanceAPI.getVolunteerAttendance({ date }).then(r => r.data?.data || []),
    select: data => {
      const map = {};
      data.forEach(rec => {
        const id = isTeacher ? rec.teacher?._id?.toString() || rec.teacher?.toString() : rec.volunteer?._id?.toString() || rec.volunteer?.toString();
        if (id) map[id] = rec;
      });
      return map;
    }
  });

  useEffect(() => {
    if (existingRecords) {
      const newStatuses = {};
      Object.entries(existingRecords).forEach(([id, rec]) => { newStatuses[id] = rec.status; });
      setStatuses(newStatuses);
    } else { setStatuses({}); }
  }, [existingRecords, date]);

  const submitMutation = useMutation({
    mutationFn: (data) => isTeacher
      ? attendanceAPI.submitTeacherAttendance(data)
      : attendanceAPI.submitVolunteerAttendance(data),
    onSuccess: (res) => {
      qc.invalidateQueries([`${type}-attendance-date`]);
      const { created, updated } = res.data?.data || {};
      toast.success(`${(created?.length || 0) + (updated?.length || 0)} records saved`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const TEACHER_OPTIONS = [
    { val: 'present', label: 'Present', short: 'P', color: '#16a34a', bg: '#dcfce7' },
    { val: 'absent', label: 'Absent', short: 'A', color: '#dc2626', bg: '#fee2e2' },
    { val: 'late', label: 'Late', short: 'L', color: '#d97706', bg: '#fef9c3' },
    { val: 'leave', label: 'Leave', short: 'Le', color: '#7c3aed', bg: '#ede9fe' },
  ];
  const VOLUNTEER_OPTIONS = [
    { val: 'present', label: 'Present', short: 'P', color: '#16a34a', bg: '#dcfce7' },
    { val: 'absent', label: 'Absent', short: 'A', color: '#dc2626', bg: '#fee2e2' },
    { val: 'halfDay', label: 'Half Day', short: '½', color: '#c2410c', bg: '#ffedd5' },
    { val: 'late', label: 'Late', short: 'L', color: '#d97706', bg: '#fef9c3' },
  ];
  const OPTIONS = isTeacher ? TEACHER_OPTIONS : VOLUNTEER_OPTIONS;
  const markAll = (status) => { const all = {}; (entities || []).forEach(e => { all[e._id] = status; }); setStatuses(all); };

  const handleSubmit = () => {
    const recs = (entities || []).filter(e => statuses[e._id]).map(e => ({
      [isTeacher ? 'teacherId' : 'volunteerId']: e._id,
      status: statuses[e._id],
      ...(isTeacher && times[e._id]?.arrival ? { arrivalTime: times[e._id].arrival } : {}),
      ...(isTeacher && times[e._id]?.departure ? { departureTime: times[e._id].departure } : {}),
      ...(!isTeacher && times[e._id]?.checkIn ? { checkInTime: times[e._id].checkIn } : {}),
      ...(!isTeacher && times[e._id]?.checkOut ? { checkOutTime: times[e._id].checkOut } : {}),
      ...(remarks[e._id] ? { remarks: remarks[e._id] } : {}),
    }));
    if (!recs.length) { toast.error('Mark at least one person'); return; }
    submitMutation.mutate({ date, records: recs });
  };

  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  const entityList = entities || [];
  const markedCount = Object.keys(statuses).length;
  const presentCount = Object.values(statuses).filter(s => ['present', 'halfDay'].includes(s)).length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', minWidth: 180 }}>
          <DateInput
            label="Date"
            value={date}
            onChange={setDate}
            max={todayIST}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays={true}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 1, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => markAll('present')}><Check size={14} /> All Present</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setStatuses({})}><RefreshCw size={14} /> Clear</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitMutation.isPending} style={{ marginLeft: 'auto', marginBottom: 1 }}>
          {submitMutation.isPending ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving...</> : <><Save size={14} /> Save</>}
        </button>
      </div>

      {markedCount > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="badge badge-green">{presentCount} Present</span>
          <span className="badge badge-red">{Object.values(statuses).filter(s => s === 'absent').length} Absent</span>
          <span className="badge badge-gray">{entityList.length - markedCount} Unmarked</span>
        </div>
      )}

      <div className="staff-att-grid">
        {entityList.map(e => {
          const existing = existingRecords?.[e._id];
          const currentStatus = statuses[e._id];
          return (
            <div key={e._id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{e.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {isTeacher ? (e.classAssigned?.name || 'Unassigned') : e.role}
                    {!isTeacher && e.shift ? ` · ${e.shift}` : ''}
                  </div>
                </div>
                {existing && <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>Saved</span>}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {OPTIONS.map(opt => (
                  <button key={opt.val} onClick={() => setStatuses(s => ({ ...s, [e._id]: opt.val }))}
                    style={{
                      padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.12s',
                      background: currentStatus === opt.val ? opt.color : 'var(--color-bg)',
                      color: currentStatus === opt.val ? 'white' : 'var(--color-text-secondary)',
                    }}>
                    {opt.short} {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {isTeacher && <>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>ARRIVAL</div>
                    <input type="time" value={times[e._id]?.arrival || ''}
                      onChange={e2 => setTimes(t => ({ ...t, [e._id]: { ...t[e._id], arrival: e2.target.value } }))}
                      style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 7, padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>DEPARTURE</div>
                    <input type="time" value={times[e._id]?.departure || ''}
                      onChange={e2 => setTimes(t => ({ ...t, [e._id]: { ...t[e._id], departure: e2.target.value } }))}
                      style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 7, padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }} />
                  </div>
                </>}
                {!isTeacher && <>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>CHECK-IN</div>
                    <input type="time" value={times[e._id]?.checkIn || ''}
                      onChange={e2 => setTimes(t => ({ ...t, [e._id]: { ...t[e._id], checkIn: e2.target.value } }))}
                      style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 7, padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>CHECK-OUT</div>
                    <input type="time" value={times[e._id]?.checkOut || ''}
                      onChange={e2 => setTimes(t => ({ ...t, [e._id]: { ...t[e._id], checkOut: e2.target.value } }))}
                      style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 7, padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }} />
                  </div>
                </>}
              </div>
              <div style={{ marginTop: 6 }}>
                <input value={remarks[e._id] || ''} placeholder="Remarks (optional)..."
                  onChange={e2 => setRemarks(r => ({ ...r, [e._id]: e2.target.value }))}
                  style={{ width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 7, padding: '5px 8px', fontSize: '0.78rem', fontFamily: 'var(--font-sans)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin: Manage Student Attendance ─────────────────────────────
function AdminStudentAttendance() {
  const { user } = useAuth();
  const { vbsYear } = useActiveYear();
  const [dateFilter, setDateFilter] = useState(getTodayIST());
  const [modifyRecord, setModifyRecord] = useState(null);
  const [historyRecord, setHistoryRecord] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data: activeSettings } = useQuery({
    queryKey: ['active-settings'],
    queryFn: () => settingsAPI.getActive().then(r => r.data?.data),
  });

  const { data: allClasses } = useQuery({
    queryKey: ['classes', vbsYear],
    queryFn: () => classesAPI.getAll({ year: vbsYear }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  const { data: records, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-student-attendance', dateFilter, vbsYear],
    queryFn: () => attendanceAPI.getStudentAttendance({ date: dateFilter, vbsYear }).then(r => r.data?.data || []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => attendanceAPI.deleteStudentAttendance(id),
    onSuccess: () => { toast.success('Record deleted'); qc.invalidateQueries(['admin-student-attendance']); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const pageSize = 20;
  const allRecords = records || [];
  const paged = allRecords.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.ceil(allRecords.length / pageSize);
  const totalPresent = allRecords.reduce((sum, r) => sum + (r.records?.filter(x => x.status === 'present').length || 0), 0);
  const totalAbsent = allRecords.reduce((sum, r) => sum + (r.records?.filter(x => x.status === 'absent').length || 0), 0);
  const overallRate = (totalPresent + totalAbsent) > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;

  const classesWithCounts = (allClasses || []).map(cls => ({
    ...cls,
    studentCount: allRecords.find(r => r.class?._id?.toString() === cls._id?.toString())?.records?.length || cls.studentCount || 0,
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', minWidth: 180 }}>
          <DateInput
            label="Date"
            value={dateFilter}
            onChange={(v) => { setDateFilter(v); setPage(1); }}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays={true}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 1 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw size={14} className={isFetching ? 'spin' : ''} />
          </button>
          {allRecords.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(true)}>
              <Download size={14} /> Export
            </button>
          )}
        </div>
      </div>

      <PendingClassesPanel
        date={dateFilter}
        vbsYear={vbsYear}
        classes={classesWithCounts}
        submittedRecords={allRecords}
        onSubmitForClass={null}
      />

      {allRecords.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Classes', value: allRecords.length, color: '#3b82f6' },
            { label: 'Present', value: totalPresent, color: '#16a34a' },
            { label: 'Absent', value: totalAbsent, color: '#dc2626' },
            { label: 'Rate', value: `${overallRate}%`, color: overallRate >= 80 ? '#16a34a' : overallRate >= 60 ? '#d97706' : '#dc2626' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ padding: '12px 18px', flex: '0 0 auto' }}>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Student Attendance — {formatDisplayDate(dateFilter)}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{allRecords.length} submitted</span>
          </div>
          {allRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No attendance submitted for this date yet.
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th><th>Category</th><th>Submitted By</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th>Rate</th><th>Flag</th>
                      <th style={{ width: 110 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(rec => {
                      const present = rec.records?.filter(r => r.status === 'present').length || 0;
                      const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
                      const total = present + absent;
                      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                      return (
                        <tr key={rec._id}>
                          <td style={{ fontWeight: 600 }}>{rec.class?.name}</td>
                          <td><span className={`badge cat-${rec.class?.category}`}>{rec.class?.category}</span></td>
                          <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{rec.submittedByName}</td>
                          <td style={{ textAlign: 'center' }}><span style={{ color: '#16a34a', fontWeight: 700 }}>{present}</span></td>
                          <td style={{ textAlign: 'center' }}><span style={{ color: '#dc2626', fontWeight: 700 }}>{absent}</span></td>
                          <td><RateBar rate={rate} /></td>
                          <td>
                            {rec.isModified ? <span className="badge badge-orange">Modified</span> : <span className="badge badge-green">Original</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {user.role === 'admin' && (
                                <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModifyRecord(rec)}><Edit2 size={13} /></button>
                              )}
                              <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setHistoryRecord(rec)}><History size={13} /></button>
                              {user.role === 'admin' && (
                                <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }}
                                  onClick={() => window.confirm('Delete record?') && deleteMutation.mutate(rec._id)}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="pagination">
                  <span className="page-info">{allRecords.length} records</span>
                  <div className="page-btns">
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft size={14} /></button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                      <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)} style={{ minWidth: 32, justifyContent: 'center' }}>{p}</button>
                    ))}
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= pages}><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modifyRecord && <ModifyModal record={modifyRecord} onClose={() => setModifyRecord(null)} />}
      {historyRecord && <HistoryModal record={historyRecord} onClose={() => setHistoryRecord(null)} />}
      {showExport && (
        <ExportAttendanceModal
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          date={dateFilter}
          records={allRecords}
          classes={allClasses || []}
        />
      )}
    </div>
  );
}

// ─── Modify Modal ──────────────────────────────────────────────────
function ModifyModal({ record, onClose }) {
  const qc = useQueryClient();
  const [changes, setChanges] = useState({});
  const [reason, setReason] = useState('');
  const modifyMutation = useMutation({
    mutationFn: (data) => attendanceAPI.modifyStudentAttendance(record._id, data),
    onSuccess: () => {
      toast.success('Attendance modified — audit trail saved');
      qc.invalidateQueries(['admin-student-attendance']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Modification failed'),
  });
  const changedCount = Object.keys(changes).length;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontWeight: 700 }}>Edit Attendance — {record.class?.name}</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {formatDisplayDate(record.date)} · By {record.submittedByName}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <div>All changes are permanently logged in the audit trail.</div>
          </div>
          <div className="table-container" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Current</th><th>Change To</th></tr></thead>
              <tbody>
                {(record.records || []).map(r => {
                  const newStatus = changes[r.student?._id];
                  return (
                    <tr key={r.student?._id} style={{ background: newStatus ? '#fffbeb' : undefined }}>
                      <td><span className="code" style={{ fontSize: '0.72rem' }}>{r.student?.studentId || '—'}</span></td>
                      <td style={{ fontWeight: newStatus ? 700 : 500 }}>{r.student?.name || '—'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['present', 'absent'].map(s => (
                            <button key={s} onClick={() => {
                              if (s !== r.status) setChanges(c => ({ ...c, [r.student._id]: s }));
                              else { const c = { ...changes }; delete c[r.student._id]; setChanges(c); }
                            }}
                              style={{
                                padding: '3px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                border: `1.5px solid ${changes[r.student?._id] === s ? (s === 'present' ? '#16a34a' : '#dc2626') : 'var(--color-border)'}`,
                                background: changes[r.student?._id] === s ? (s === 'present' ? '#16a34a' : '#dc2626') : 'white',
                                color: changes[r.student?._id] === s ? 'white' : 'var(--color-text-secondary)',
                              }}>
                              {s === 'present' ? '✓ P' : '✗ A'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (recommended)</label>
            <textarea className="form-textarea" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Parent confirmed child was present" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={changedCount === 0 || modifyMutation.isPending}
            onClick={() => modifyMutation.mutate({
              changes: Object.entries(changes).map(([studentId, newStatus]) => ({ studentId, newStatus })),
              reason
            })}>
            <Save size={15} /> Save {changedCount > 0 ? `${changedCount} Change${changedCount > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Modal ─────────────────────────────────────────────────
function HistoryModal({ record, onClose }) {
  const history = record.modificationHistory || [];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span style={{ fontWeight: 700 }}>Modification History</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {record.class?.name} — {formatDisplayDate(record.date)}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 14, fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 2 }}>✓ Original Submission</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>
              By <strong>{record.submittedByName}</strong> ({record.submittedByRole}) ·{' '}
              {record.createdAt ? new Date(record.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
            </div>
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No modifications yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((mod, i) => (
                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Modification #{i + 1} by {mod.modifiedByName}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {new Date(mod.modifiedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  {mod.reason && mod.reason !== 'No reason specified' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8, fontStyle: 'italic', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 7 }}>
                      "{mod.reason}"
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {mod.changes?.map((c, j) => (
                      <div key={j} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, minWidth: 120 }}>{c.entityName || '—'}</span>
                        <StatusBadge status={c.previousStatus} />
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <StatusBadge status={c.newStatus} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Submit On Behalf ───────────────────────────────────────
function AdminSubmitOnBehalf() {
  const { vbsYear } = useActiveYear();
  const qc = useQueryClient();
  const [date, setDate] = useState(getTodayIST());
  const [selectedClassId, setSelectedClassId] = useState('');
  const [records, setRecords] = useState({});
  const todayIST = getTodayIST();

  const { data: activeSettings } = useQuery({
    queryKey: ['active-settings'],
    queryFn: () => settingsAPI.getActive().then(r => r.data?.data),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes', vbsYear],
    queryFn: () => classesAPI.getAll({ year: vbsYear }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  const { data: classData } = useQuery({
    queryKey: ['class-full', selectedClassId],
    queryFn: () => classesAPI.getOne(selectedClassId).then(r => r.data?.data),
    enabled: !!selectedClassId,
  });

  const { data: existingRecord } = useQuery({
    queryKey: ['attendance-check-admin', date, selectedClassId],
    queryFn: () => attendanceAPI.getStudentAttendance({ date, classId: selectedClassId }).then(r => r.data?.data?.[0]),
    enabled: !!selectedClassId,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => attendanceAPI.submitStudentAttendance(data),
    onSuccess: () => {
      toast.success('Attendance submitted');
      qc.invalidateQueries(['attendance-check-admin']);
      qc.invalidateQueries(['admin-student-attendance']);
      setRecords({});
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const students = classData?.students || [];
  const alreadySubmitted = !!existingRecord;
  const markAll = (status) => { const all = {}; students.forEach(s => { all[s._id] = status; }); setRecords(all); };
  const presentCount = Object.values(records).filter(v => v === 'present').length;
  const markedCount = Object.keys(records).length;

  return (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        <Info size={15} style={{ flexShrink: 0 }} />
        <div>Submit student attendance on behalf — no time window restrictions for admin.</div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', minWidth: 180 }}>
          <DateInput
            label="Date"
            value={date}
            onChange={(v) => { setDate(v); setRecords({}); }}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays={true}
          />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <label className="form-label">Class</label>
          <select className="form-select" value={selectedClassId}
            onChange={e => { setSelectedClassId(e.target.value); setRecords({}); }}>
            <option value="">Select a class...</option>
            {(classes || []).map(c => <option key={c._id} value={c._id}>{c.name} ({c.category})</option>)}
          </select>
        </div>
        {students.length > 0 && !alreadySubmitted && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('present')}>All P</button>
            <button className="btn btn-secondary btn-sm" onClick={() => markAll('absent')}>All A</button>
          </div>
        )}
      </div>

      {selectedClassId && alreadySubmitted && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <div>Already submitted. Use <strong>Manage</strong> tab to modify.</div>
        </div>
      )}

      {selectedClassId && classData && !alreadySubmitted && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{classData.name} — {formatDisplayDate(date)}</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', gap: 12 }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>{presentCount} P</span>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{markedCount - presentCount} A</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{students.length - markedCount} left</span>
            </div>
          </div>
          {students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              <Users size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--color-text-muted)' }} />
              No students assigned to this class yet.
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead><tr><th>#</th><th>ID</th><th>Name</th><th>Grade</th><th>Status</th></tr></thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s._id}>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                        <td><span className="code">{s.studentId || '—'}</span></td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          {['PreKG', 'LKG', 'UKG'].includes(s.grade) ? s.grade : `Std ${s.grade}`}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {['present', 'absent'].map(st => (
                              <button key={st} onClick={() => setRecords(r => ({ ...r, [s._id]: st }))}
                                style={{
                                  padding: '4px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                  fontWeight: 600, fontSize: '0.78rem', transition: 'all 0.12s',
                                  background: records[s._id] === st ? (st === 'present' ? '#16a34a' : '#dc2626') : 'var(--color-bg)',
                                  color: records[s._id] === st ? 'white' : 'var(--color-text-secondary)',
                                }}>
                                {st === 'present' ? '✓' : '✗'}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" disabled={submitMutation.isPending} onClick={() => {
                  const recs = students.map(s => ({ studentId: s._id, status: records[s._id] || 'absent' }));
                  submitMutation.mutate({ date, classId: selectedClassId, records: recs });
                }}>
                  {submitMutation.isPending ? 'Submitting...' : <><Save size={15} /> Submit</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN ATTENDANCE PAGE ──────────────────────────────────────────
export default function AttendancePage({ initialTab }) {
  const { user } = useAuth();

  const tabsByRole = {
    admin: [
      { id: 'manage', label: '📋 Student Records' },
      { id: 'submit-behalf', label: '✏️ Submit (Admin)' },
      { id: 'teachers', label: '👩‍🏫 Teacher Attendance' },
      { id: 'volunteers', label: '🤝 Volunteer Attendance' },
    ],
    editor: [
      { id: 'teachers', label: '👩‍🏫 Teacher Attendance' },
      { id: 'volunteers', label: '🤝 Volunteer Attendance' },
    ],
    viewer: [
      { id: 'manage', label: '📋 Student Records' },
    ],
    teacher: [
      { id: 'submit', label: '✏️ Mark Attendance' },
      { id: 'history', label: '📅 Submission History' },
      { id: 'my-attendance', label: '👤 My Attendance' },
    ],
  };

  const tabs = tabsByRole[user.role] || [];
  const getDefaultTab = () => {
    if (initialTab === 'my-attendance') return 'my-attendance';
    if (initialTab === 'submit') return 'submit';
    return tabs[0]?.id;
  };
  const [activeTab, setActiveTab] = useState(getDefaultTab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {user.role === 'teacher' ? 'Mark attendance and view your records' : 'Manage daily attendance'}
          </p>
        </div>
      </div>

      {/* Mobile-friendly scrollable tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: `1.5px solid ${activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: activeTab === tab.id ? 'var(--color-primary)' : 'white',
              color: activeTab === tab.id ? 'white' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
              fontSize: '0.82rem', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'submit' && <TeacherMarkAttendance />}
      {activeTab === 'history' && <TeacherAttendanceHistory />}
      {activeTab === 'my-attendance' && <MyOwnAttendanceRecords />}
      {activeTab === 'manage' && <AdminStudentAttendance />}
      {activeTab === 'submit-behalf' && <AdminSubmitOnBehalf />}
      {activeTab === 'teachers' && <StaffAttendancePanel type="teacher" />}
      {activeTab === 'volunteers' && <StaffAttendancePanel type="volunteer" />}

      <style>{`
        .staff-att-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }
        @media (max-width: 480px) {
          .staff-att-grid { grid-template-columns: 1fr; }
          .sm-label { display: inline !important; }
        }
        .sm-label { display: none; }
      `}</style>
    </div>
  );
}
