import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Calendar, BookOpen, GraduationCap, Heart,
  MapPin, Users, Printer, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { reportsAPI, classesAPI, teachersAPI, volunteersAPI, studentsAPI, settingsAPI } from '../services/api';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage, Alert, CategoryBadge } from '../components/common';
import DateInput from '../components/Dateinput';
import { format } from 'date-fns';
import { FullYearReport } from './Fullyearreport';

/* ─── Helpers ─────────────────────────────────────────────────────── */
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateFull = d => d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RateBar = ({ rate = 0 }) => {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 50, height: 5, background: 'var(--color-border)', borderRadius: 99 }}>
        <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', borderRadius: 99, background: color }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.8rem', color }}>{rate}%</span>
    </div>
  );
};

function StatRow({ items }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map(s => (
        <div key={s.label} className="stat-card" style={{ flex: 1, minWidth: 90, padding: '12px 16px' }}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color || 'var(--color-primary)', fontSize: '1.6rem' }}>{s.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Print helper ─────────────────────────────────────────────────── */
const printPage = (title, body, summary = '', vbsYear = '') => {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.5pt;color:#111}
    .hdr{border-bottom:2.5px solid #1a2f5e;padding-bottom:10px;margin-bottom:12px}
    .hdr-top{display:flex;align-items:center;gap:12px;margin-bottom:4px}
    .hdr-logo{width:42px;height:42px;object-fit:contain;flex-shrink:0;border-radius:6px}
    .church-name{font-size:13pt;font-weight:800;color:#1a2f5e;line-height:1.2}
    .church-sub{font-size:7.5pt;color:#666;margin-top:1px}
    .rpt{font-size:10.5pt;font-weight:700;color:#c8922a;margin-top:5px}
    .sm{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
    .sc{border:1px solid #ddd;border-radius:5px;padding:7px 12px}
    .sc .n{font-size:15pt;font-weight:800;color:#1a2f5e}
    .sc .l{font-size:7.5pt;color:#555;text-transform:uppercase;margin-top:1px}
    table{width:100%;border-collapse:collapse}
    th{background:#1a2f5e;color:#fff;padding:5px 7px;text-align:left;font-size:7.5pt;font-weight:700}
    td{padding:4px 7px;border-bottom:1px solid #e8edf2;font-size:8.5pt}
    tr:nth-child(even)td{background:#f9fafb}
    .section-head{background:#e8edf2;padding:8px 12px;margin:16px 0 8px;font-weight:800;color:#1a2f5e;border-left:4px solid #1a2f5e;font-size:9.5pt}
    .class-block{margin-bottom:20px;page-break-inside:avoid}
    .class-header{background:#1a2f5e;color:white;padding:8px 12px;font-weight:700;font-size:9pt;display:flex;justify-content:space-between}
    .ftr{margin-top:14px;font-size:7.5pt;color:#888;border-top:1px solid #ddd;padding-top:7px;display:flex;justify-content:space-between}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
  <div class="hdr">
    <div class="hdr-top">
      <img class="hdr-logo" src="/poj-logo.png" alt="POJ" onerror="this.style.display='none'" />
      <div>
        <div class="church-name">Presence of Jesus Ministry</div>
        <div class="church-sub">Tuticorin, Tamil Nadu</div>
      </div>
    </div>
    <div class="rpt">${title}${vbsYear ? ` — VBS ${vbsYear}` : ''}</div>
  </div>
  ${summary}${body}
  <div class="ftr">
    <span>VBS Management System</span>
    <span>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
};

const mkSummary = items => `<div class="sm">${items.map(i => `<div class="sc"><div class="n">${i.v}</div><div class="l">${i.l}</div></div>`).join('')}</div>`;
const mkTable = (heads, rows) => `<table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;

/* ─── Shared ─────────────────────────────────────────────────────── */
function NoYearState() {
  return (
    <div className="empty-state">
      <Calendar size={36} style={{ color: 'var(--color-text-muted)' }} />
      <h3>No VBS Year Selected</h3>
      <p>Use the year selector in the top bar to choose a year.</p>
    </div>
  );
}

function YearBanner({ vbsYear, activeYear }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 16, fontSize: '0.82rem', color: '#1e40af', fontWeight: 600 }}>
      <Calendar size={14} />
      All reports scoped to: <strong>{activeYear?.vbsTitle || `VBS ${vbsYear}`}</strong>
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <span className="card-title">{title}</span>
        {action}
      </div>
      <div className="table-container">{children}</div>
    </div>
  );
}

/* ─── Collapsible Class Student List ─────────────────────────────── */
function ClassStudentList({ rec }) {
  const [expanded, setExpanded] = useState(false);
  const present = rec.records?.filter(r => r.status === 'present').length || 0;
  const absent = rec.records?.filter(r => r.status === 'absent').length || 0;
  const total = present + absent;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--color-bg)', cursor: 'pointer',
          gap: 12, flexWrap: 'wrap',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{rec.class?.name}</span>
          <span className={`badge cat-${rec.class?.category}`}>{rec.class?.category}</span>
          {rec.isModified && <span className="badge badge-orange">Modified</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>✓ {present}</span>
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>✗ {absent}</span>
          <RateBar rate={rate} />
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>by {rec.submittedByName}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      {expanded && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Student ID', 'Name', 'Grade', 'Status'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', background: 'white', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rec.records || []).map((r, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
                  <td style={{ padding: '6px 12px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                  <td style={{ padding: '6px 12px' }}><span className="code" style={{ fontSize: '0.75rem' }}>{r.student?.studentId || '—'}</span></td>
                  <td style={{ padding: '6px 12px', fontWeight: 600, fontSize: '0.845rem' }}>{r.student?.name || '—'}</td>
                  <td style={{ padding: '6px 12px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                    {['PreKG', 'LKG', 'UKG'].includes(r.student?.grade) ? r.student?.grade : r.student?.grade ? `Std ${r.student.grade}` : '—'}
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700, background: r.status === 'present' ? '#dcfce7' : '#fee2e2', color: r.status === 'present' ? '#15803d' : '#b91c1c' }}>
                      {r.status === 'present' ? '✓ Present' : '✗ Absent'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ 1. DAILY REPORT ════════════════════════════════ */
function DailyReport({ date, vbsYear, vbsStartDate, vbsEndDate }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-daily', date, vbsYear],
    queryFn: () => reportsAPI.getDaily({ date, vbsYear }),
    enabled: !!date && !!vbsYear,
    select: d => d.data?.data,
  });

  if (!date) return <Alert type="info">Select a date above to view the daily report.</Alert>;
  if (isLoading) return <LoadingPage />;
  if (!data) return <Alert type="warning">No data for {fmtDate(date)}.</Alert>;

  const { summary, studentAttendance = [], teacherAttendance = [], volunteerAttendance = [], unsubmittedClasses = [] } = data;

  const handlePrint = () => {
    const sum = mkSummary([
      { l: 'Students Present', v: summary?.students?.present ?? 0 },
      { l: 'Students Absent', v: summary?.students?.absent ?? 0 },
      { l: 'Attendance Rate', v: `${summary?.students?.rate ?? 0}%` },
      { l: 'Teachers Present', v: summary?.teachers?.present ?? 0 },
      { l: 'Teachers Absent', v: summary?.teachers?.absent ?? 0 },
      { l: 'Volunteers Present', v: summary?.volunteers?.present ?? 0 },
    ]);
 
    const stuSummaryRows = studentAttendance.map(a => {
      const p = a.records?.filter(r => r.status === 'present').length || 0;
      const ab = a.records?.filter(r => r.status === 'absent').length || 0;
      const t = p + ab;
      return `<tr><td>${a.class?.name}</td><td>${a.class?.category}</td><td>${p}</td><td>${ab}</td><td>${t > 0 ? Math.round((p / t) * 100) : 0}%</td><td>${a.submittedByName || '—'}</td><td>${a.isModified ? '⚠ Modified' : '✓ Original'}</td></tr>`;
    }).join('');
 
    const classBlocks = studentAttendance.map(a => {
      const p = a.records?.filter(r => r.status === 'present').length || 0;
      const ab = a.records?.filter(r => r.status === 'absent').length || 0;
      const t = p + ab;
      const rate = t > 0 ? Math.round((p / t) * 100) : 0;
      const studentRows = (a.records || []).map((r, i) =>
        `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'}">
          <td style="text-align:center;color:#888">${i + 1}</td>
          <td style="font-family:monospace;color:#1a2f5e;font-size:8pt">${r.student?.studentId || '—'}</td>
          <td style="font-weight:600">${r.student?.name || '—'}</td>
          <td style="color:#555">${r.student?.grade || '—'}</td>
          <td><span style="padding:1px 6px;border-radius:3px;font-size:7.5pt;font-weight:700;background:${r.status === 'present' ? '#dcfce7' : '#fee2e2'};color:${r.status === 'present' ? '#15803d' : '#b91c1c'}">${r.status === 'present' ? '✓ Present' : '✗ Absent'}</span></td>
        </tr>`
      ).join('');
      return `<div class="class-block">
        <div class="class-header">
          <span>${a.class?.name} (${a.class?.category})</span>
          <span>Teacher: ${a.submittedByName || '—'} | ✓${p} ✗${ab} ${rate}%</span>
        </div>
        <table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${studentRows}</tbody></table>
      </div>`;
    }).join('');
 
    // ── CHANGED: Status badge helpers for color in printed PDF ──────────────────
    const tStatusBadge = (s) => {
      const styles = { present: 'background:#dcfce7;color:#15803d', absent: 'background:#fee2e2;color:#b91c1c', late: 'background:#fef9c3;color:#a16207', leave: 'background:#ede9fe;color:#6d28d9' };
      const st = styles[s] || 'background:#f1f5f9;color:#475569';
      return `<span style="${st};font-weight:700;padding:2px 9px;border-radius:4px;font-size:8pt;text-transform:capitalize">${s}</span>`;
    };
    const vStatusBadge = (s) => {
      const styles = { present: 'background:#dcfce7;color:#15803d', absent: 'background:#fee2e2;color:#b91c1c', halfDay: 'background:#ffedd5;color:#c2410c', late: 'background:#fef9c3;color:#a16207' };
      const st = styles[s] || 'background:#f1f5f9;color:#475569';
      const label = s === 'halfDay' ? 'Half Day' : s;
      return `<span style="${st};font-weight:700;padding:2px 9px;border-radius:4px;font-size:8pt;text-transform:capitalize">${label}</span>`;
    };
    const tRows = teacherAttendance.map(t => `<tr><td>${t.teacher?.name || '—'}</td><td>${tStatusBadge(t.status)}</td><td>${t.arrivalTime || '—'}</td><td>${t.remarks || '—'}</td></tr>`).join('');
    const vRows = volunteerAttendance.map(v => `<tr><td>${v.volunteer?.name || '—'}</td><td>${v.volunteer?.role || '—'}</td><td>${vStatusBadge(v.status)}</td><td>${v.shift || '—'}</td></tr>`).join('');
 
    const body = `
      <div class="section-head">Summary by Class</div>
      ${mkTable(['Class', 'Category', 'Present', 'Absent', 'Rate', 'Submitted By', 'Status'], stuSummaryRows)}
      ${unsubmittedClasses.length ? `<div style="margin:10px 0;padding:8px 12px;background:#fef3c7;border-left:3px solid #fbbf24;font-size:8.5pt;color:#92400e"><strong>⚠ Pending (${unsubmittedClasses.length}):</strong> ${unsubmittedClasses.map(c => c.name).join(', ')}</div>` : ''}
      <div class="section-head">Class-wise Student Attendance</div>
      ${classBlocks}
      ${tRows ? `<div class="section-head">Teacher Attendance</div>${mkTable(['Teacher', 'Status', 'Arrival', 'Remarks'], tRows)}` : ''}
      ${vRows ? `<div class="section-head">Volunteer Attendance</div>${mkTable(['Volunteer', 'Role', 'Status', 'Shift'], vRows)}` : ''}
    `;
 
    printPage(`Daily Attendance — ${fmtDateFull(date)}`, body, sum, vbsYear);
  };

  return (
    <div>
      <StatRow items={[
        { label: 'Students Present', value: summary?.students?.present, color: '#16a34a' },
        { label: 'Students Absent', value: summary?.students?.absent, color: '#dc2626' },
        { label: 'Student Rate', value: `${summary?.students?.rate ?? 0}%`, color: '#3b82f6' },
        { label: 'Teachers Present', value: summary?.teachers?.present, color: '#8b5cf6' },
        { label: 'Teachers Late', value: summary?.teachers?.late, color: '#d97706' },
        { label: 'Volunteers Present', value: summary?.volunteers?.present, color: '#f59e0b' },
      ]} />

      {unsubmittedClasses.length > 0 && (
        <Alert type="warning" style={{ marginBottom: 12 }}>
          ⚠️ <strong>{unsubmittedClasses.length}</strong> class(es) pending: {unsubmittedClasses.map(c => c.name).join(', ')}
        </Alert>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">📚 Class-wise Attendance</span>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print All</button>
        </div>
        <div style={{ padding: '14px' }}>
          {studentAttendance.length === 0
            ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>No student attendance submitted for this date.</div>
            : studentAttendance.map(rec => (
              <ClassStudentList key={rec._id} rec={rec} />
            ))
          }
        </div>
      </div>

      <SectionCard title="👩‍🏫 Teacher Attendance">
        <table>
          <thead><tr><th>Teacher</th><th>Class</th><th>Status</th><th>Arrival</th><th>Departure</th><th>Remarks</th></tr></thead>
          <tbody>
            {teacherAttendance.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No teacher attendance recorded.</td></tr>
              : teacherAttendance.map(t => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 600 }}>{t.teacher?.name || '—'}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t.teacher?.classAssigned?.name || '—'}</td>
                  <td><span className={`badge ${t.status === 'present' ? 'badge-green' : t.status === 'late' ? 'badge-yellow' : t.status === 'leave' ? 'badge-purple' : 'badge-red'}`}>{t.status}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{t.arrivalTime || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{t.departureTime || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{t.remarks || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="🤝 Volunteer Attendance">
        <table>
          <thead><tr><th>Volunteer</th><th>Role</th><th>Status</th><th>Shift</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {volunteerAttendance.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No volunteer attendance recorded.</td></tr>
              : volunteerAttendance.map(v => (
                <tr key={v._id}>
                  <td style={{ fontWeight: 600 }}>{v.volunteer?.name || '—'}</td>
                  <td><span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>{v.volunteer?.role || '—'}</span></td>
                  <td><span className={`badge ${v.status === 'present' ? 'badge-green' : v.status === 'halfDay' ? 'badge-orange' : 'badge-red'}`}>{v.status}</span></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{v.shift || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{v.checkInTime || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{v.checkOutTime || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 2. CLASS REPORT ════════════════════════════════ */
function ClassReport({ classId, vbsYear }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data: activeSettings } = useQuery({ queryKey: ['active-settings'], queryFn: () => settingsAPI.getActive().then(r => r.data?.data) });

  const { data, isLoading } = useQuery({
    queryKey: ['report-class', classId, startDate, endDate, vbsYear],
    queryFn: () => reportsAPI.getClass(classId, { startDate: startDate || undefined, endDate: endDate || undefined }),
    enabled: !!classId && !!vbsYear,
    select: d => d.data?.data,
  });

  if (!classId) return <Alert type="info">Select a class above to view its report.</Alert>;
  if (isLoading) return <LoadingPage />;
  if (!data) return <Alert type="warning">No data for this class.</Alert>;

  const handlePrint = () => {
    const sum = mkSummary([
      { l: 'Students', v: data.students?.length ?? 0 },
      { l: 'Days Recorded', v: data.totalDays ?? 0 },
      { l: 'Avg Rate', v: `${data.classAvgRate ?? 0}%` },
      { l: 'Teacher', v: data.class?.teacher?.name || 'Unassigned' },
    ]);
    const rows = (data.students || []).map(s =>
      `<tr><td>${s.studentId || '—'}</td><td>${s.name}</td><td>${s.grade}</td><td>${s.gender}</td><td>${s.village || '—'}</td><td>${s.present}</td><td>${s.absent}</td><td>${s.rate}%</td></tr>`
    ).join('');
    printPage(`Class Report — ${data.class?.name}`, mkTable(['ID', 'Name', 'Grade', 'Gender', 'Village', 'Present', 'Absent', 'Rate'], rows), sum, vbsYear);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <DateInput label="From (optional)" value={startDate} onChange={setStartDate}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <DateInput label="To (optional)" value={endDate} onChange={setEndDate}
            min={startDate}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
            showVBSDays />
        </div>
        {(startDate || endDate) && <button className="btn btn-ghost btn-sm" style={{ marginBottom: 1 }} onClick={() => { setStartDate(''); setEndDate(''); }}>✕ Clear</button>}
      </div>

      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{data.class?.name} <span className={`badge cat-${data.class?.category}`}>{data.class?.category}</span></div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Teacher: <strong>{data.class?.teacher?.name || 'Unassigned'}</strong> · {data.totalDays} days recorded
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print</button>
        </div>
      </div>

      <StatRow items={[
        { label: 'Total Students', value: data.students?.length, color: '#3b82f6' },
        { label: 'Days Recorded', value: data.totalDays, color: '#8b5cf6' },
        { label: 'Class Avg Rate', value: `${data.classAvgRate ?? 0}%`, color: data.classAvgRate >= 80 ? '#16a34a' : '#d97706' },
      ]} />

      <SectionCard title="👥 Student Attendance Records">
        <table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Grade</th><th>Gender</th><th>Village</th><th>Contact</th><th>Present</th><th>Absent</th><th>Rate</th></tr></thead>
          <tbody>
            {(data.students || []).map(s => (
              <tr key={s._id}>
                <td><span className="code" style={{ fontSize: '0.75rem' }}>{s.studentId || '—'}</span></td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.grade}</td>
                <td style={{ textTransform: 'capitalize', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{s.gender}</td>
                <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{s.village || '—'}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{s.contactNumber || '—'}</td>
                <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.present}</span></td>
                <td><span style={{ color: '#dc2626', fontWeight: 700 }}>{s.absent}</span></td>
                <td><RateBar rate={s.rate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 3. TEACHER REPORT ════════════════════════════════ */
function TeacherReport({ teacherId, vbsYear }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-teacher', teacherId, vbsYear],
    queryFn: () => reportsAPI.getTeacher(teacherId),
    enabled: !!teacherId && !!vbsYear,
    select: d => d.data?.data,
  });
  if (!teacherId) return <Alert type="info">Select a teacher above.</Alert>;
  if (isLoading) return <LoadingPage />;
  if (!data) return <Alert type="warning">No data for this teacher.</Alert>;
  const { teacher, submissions, ownAttendance } = data;

  const handlePrint = () => {
    const sum = mkSummary([
      { l: 'Class', v: teacher?.classAssigned?.name || '—' },
      { l: 'Submitted', v: submissions?.total ?? 0 },
      { l: 'Rate', v: `${submissions?.submissionRate ?? 0}%` },
      { l: 'Present', v: ownAttendance?.present ?? 0 },
    ]);
    const rows = (submissions?.history || []).map(s =>
      `<tr><td>${fmtDate(s.date)}</td><td>${s.submittedByName || '—'}</td><td>${s.records?.length ?? 0}</td><td>${s.isModified ? 'Modified' : 'Original'}</td></tr>`
    ).join('');
    printPage(`Teacher Report — ${teacher?.name}`, mkTable(['Date', 'Submitted By', 'Students', 'Status'], rows), sum, vbsYear);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{teacher?.name}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Class: <strong>{teacher?.classAssigned?.name || 'Unassigned'}</strong> · {teacher?.contactNumber || '—'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print</button>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">📋 Submission Stats</span></div>
          <div className="card-body">
            {[{ label: 'Days Submitted', value: submissions?.total, color: '#3b82f6' },
              { label: 'Expected Days', value: submissions?.expectedDays, color: '#8b5cf6' },
              { label: 'Submission Rate', value: `${submissions?.submissionRate ?? 0}%`, color: '#16a34a' }].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">📅 Own Attendance</span></div>
          <div className="card-body">
            {[{ label: 'Present', value: ownAttendance?.present, color: '#16a34a' },
              { label: 'Absent', value: ownAttendance?.absent, color: '#dc2626' },
              { label: 'Late', value: ownAttendance?.late, color: '#d97706' },
              { label: 'Rate', value: `${ownAttendance?.rate ?? 0}%`, color: '#3b82f6' }].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SectionCard title="📁 Submission History">
        <table>
          <thead><tr><th>Date</th><th>Submitted By</th><th>Students</th><th>Status</th></tr></thead>
          <tbody>
            {(submissions?.history || []).length === 0
              ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No submissions yet.</td></tr>
              : (submissions?.history || []).map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{fmtDate(s.date)}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{s.submittedByName || '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{s.records?.length ?? 0} students</td>
                  <td>{s.isModified ? <span className="badge badge-orange">Modified</span> : <span className="badge badge-green">Original</span>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 4. STUDENT REPORT ════════════════════════════════ */
function StudentReport({ vbsYear }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: students } = useQuery({
    queryKey: ['students-search', search, vbsYear],
    queryFn: () => studentsAPI.getAll({ search, limit: 20, vbsYear }),
    select: d => d.data?.data || [],
    enabled: search.length >= 2 && !!vbsYear,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['report-student', selectedId, vbsYear],
    queryFn: () => reportsAPI.getStudent(selectedId),
    enabled: !!selectedId && !!vbsYear,
    select: d => d.data?.data,
  });

  // Enhanced print with all student details
  const handlePrint = () => {
    if (!data) return;
    const { student, attendance } = data;
    const sum = mkSummary([
      { l: 'Student ID', v: student?.studentId || '—' },
      { l: 'Grade', v: student?.grade },
      { l: 'Category', v: student?.category },
      { l: 'Present', v: attendance?.present },
      { l: 'Absent', v: attendance?.absent },
      { l: 'Rate', v: `${attendance?.rate ?? 0}%` },
    ]);

    const profileSection = `
      <div class="section-head">Student Profile</div>
      <table>
        <tbody>
          <tr><td style="font-weight:700;width:180px">Student ID</td><td style="font-family:monospace">${student?.studentId || '—'}</td><td style="font-weight:700;width:180px">Name</td><td>${student?.name || '—'}</td></tr>
          <tr><td style="font-weight:700">Grade</td><td>${student?.grade || '—'}</td><td style="font-weight:700">Category</td><td>${student?.category || '—'}</td></tr>
          <tr><td style="font-weight:700">Gender</td><td style="text-transform:capitalize">${student?.gender || '—'}</td><td style="font-weight:700">Religion</td><td>${student?.religion || '—'}${student?.christianDenomination ? ` (${student.christianDenomination})` : ''}</td></tr>
          <tr><td style="font-weight:700">Parent / Guardian</td><td>${student?.parentName || '—'}</td><td style="font-weight:700">Village</td><td>${student?.village || '—'}</td></tr>
          <tr><td style="font-weight:700">Contact Number</td><td style="font-family:monospace">${student?.contactNumber || '—'}</td><td style="font-weight:700">WhatsApp</td><td style="font-family:monospace">${student?.whatsappNumber || student?.contactNumber || '—'}</td></tr>
          <tr><td style="font-weight:700">School</td><td colspan="3">${student?.schoolName || '—'}</td></tr>
          <tr><td style="font-weight:700">Class Assigned</td><td>${student?.classAssigned?.name || 'Unassigned'}</td><td style="font-weight:700">VBS Year</td><td>${student?.vbsYear || '—'}</td></tr>
        </tbody>
      </table>`;

    const historyRows = (attendance?.history || []).map((h, i) =>
      `<tr style="background:${i%2===0?'#f9fafb':'white'}">
        <td>${fmtDate(h.date)}</td>
        <td><span style="padding:2px 8px;border-radius:4px;font-size:7.5pt;font-weight:700;background:${h.status==='present'?'#dcfce7':'#fee2e2'};color:${h.status==='present'?'#15803d':'#b91c1c'}">${h.status === 'present' ? '✓ Present' : '✗ Absent'}</span></td>
        <td>${h.isModified ? '<span style="color:#c2410c;font-weight:700">⚠ Modified</span>' : '<span style="color:#16a34a">✓ Original</span>'}</td>
      </tr>`
    ).join('');

    const body = `${profileSection}
      <div class="section-head">Attendance Summary</div>
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Days Present</td><td style="font-weight:700;color:#16a34a">${attendance?.present || 0}</td></tr>
          <tr><td>Days Absent</td><td style="font-weight:700;color:#dc2626">${attendance?.absent || 0}</td></tr>
          <tr><td>Total Days</td><td style="font-weight:700">${attendance?.total || 0}</td></tr>
          <tr><td>Attendance Rate</td><td style="font-weight:800;color:${(attendance?.rate||0)>=80?'#16a34a':(attendance?.rate||0)>=60?'#d97706':'#dc2626'}">${attendance?.rate ?? 0}%</td></tr>
        </tbody>
      </table>
      <div class="section-head">Day-by-Day History</div>
      ${mkTable(['Date', 'Status', 'Record Type'], historyRows)}`;

    printPage(`Student Report — ${student?.name}`, body, sum, vbsYear);
  };

  if (!selectedId) return (
    <div>
      <div style={{ marginBottom: 16, position: 'relative', display: 'inline-block' }}>
        <label className="form-label">Search Student</label>
        <input className="form-input" style={{ width: 300 }} placeholder="Type name or student ID…"
          value={search} onChange={e => { setSearch(e.target.value); setShowSearch(true); }} />
        {showSearch && search.length >= 2 && (students || []).length > 0 && (
          <div style={{ position: 'absolute', zIndex: 50, background: 'white', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', width: 300, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
            {students.map(s => (
              <button key={s._id} onClick={() => { setSelectedId(s._id); setSearch(`${s.name} (${s.studentId})`); setShowSearch(false); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: '0.845rem', borderBottom: '1px solid var(--color-border-light)' }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--color-text-secondary)' }}>{s.studentId} · {s.grade} · {s.village}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <Alert type="info">Type at least 2 characters to search for a student.</Alert>
    </div>
  );

  if (isLoading) return <LoadingPage />;
  if (!data) return <Alert type="warning">No data for this student.</Alert>;

  const { student, attendance } = data;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedId(''); setSearch(''); }}>← Back</button>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {student?.name}
              <span className="code" style={{ fontSize: '0.8rem', marginLeft: 10 }}>{student?.studentId}</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Grade {student?.grade} · <span className={`badge cat-${student?.category}`}>{student?.category}</span> · {student?.gender}
              {student?.classAssigned && <> · Class: <strong>{student.classAssigned.name}</strong></>}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print Full Report</button>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { label: 'Religion', value: `${student?.religion || '—'}${student?.christianDenomination ? ` · ${student.christianDenomination}` : ''}` },
              { label: 'Parent / Guardian', value: student?.parentName || '—' },
              { label: 'Village', value: student?.village || '—' },
              { label: 'Contact', value: student?.contactNumber || '—', mono: true },
              { label: 'WhatsApp', value: student?.whatsappNumber || student?.contactNumber || '—', mono: true },
              { label: 'School', value: student?.schoolName || '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', fontFamily: f.mono ? 'var(--font-mono)' : undefined }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <StatRow items={[
        { label: 'Present', value: attendance?.present, color: '#16a34a' },
        { label: 'Absent', value: attendance?.absent, color: '#dc2626' },
        { label: 'Total Days', value: attendance?.total, color: '#3b82f6' },
        { label: 'Rate', value: `${attendance?.rate ?? 0}%`, color: attendance?.rate >= 80 ? '#16a34a' : attendance?.rate >= 60 ? '#d97706' : '#dc2626' },
      ]} />

      {/* History */}
      <SectionCard title="📅 Attendance History">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Record</th></tr></thead>
          <tbody>
            {(attendance?.history || []).length === 0
              ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No records.</td></tr>
              : (attendance?.history || []).map((h, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{fmtDate(h.date)}</td>
                  <td><span className={`badge ${h.status === 'present' ? 'badge-green' : 'badge-red'}`}>{h.status === 'present' ? '✓ Present' : '✗ Absent'}</span></td>
                  <td>{h.isModified ? <span className="badge badge-orange">Modified</span> : <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Original</span>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 5. VILLAGE REPORT ════════════════════════════════ */
// FIX: Replaced direct api.get calls with reportsAPI
function VillageReport({ vbsYear }) {
  const [village, setVillage] = useState('');
  const [queried, setQueried] = useState('');

  const { data: villageList } = useQuery({
    queryKey: ['village-list', vbsYear],
    queryFn: () => reportsAPI.getVillageList({ vbsYear }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['report-village', queried, vbsYear],
    queryFn: () => reportsAPI.getVillage({ village: queried, vbsYear }),
    select: d => d.data?.data,
    enabled: !!queried && !!vbsYear,
  });

  const handlePrint = () => {
    if (!data) return;
    const sum = mkSummary([
      { l: 'Village', v: queried },
      { l: 'Total Students', v: data.totalStudents },
      { l: 'Attendance Rate', v: `${data.stats?.attendance?.rate ?? 0}%` },
      { l: 'Present', v: data.stats?.attendance?.present ?? 0 },
    ]);
    const rows = (data.students || []).map(s =>
      `<tr><td>${s.studentId || '—'}</td><td>${s.name}</td><td>${s.grade}</td><td>${s.category}</td><td>${s.contactNumber || '—'}</td><td>${s.parentName || '—'}</td><td>${s.classAssigned?.name || '—'}</td><td>${s.attendance?.present ?? 0}</td><td>${s.attendance?.rate ?? 0}%</td></tr>`
    ).join('');
    printPage(`Village Report — ${queried}`, mkTable(['Student ID', 'Name', 'Grade', 'Category', 'Contact', 'Parent', 'Class', 'Present', 'Rate'], rows), sum, vbsYear);
  };

  if (!queried) return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Select Village</label>
          <select className="form-select" style={{ width: 280 }} value={village} onChange={e => setVillage(e.target.value)}>
            <option value="">Choose a village…</option>
            {(villageList || []).map(v => <option key={v.village || v._id} value={v.village || v._id}>{v.village || v._id} ({v.count} students)</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setQueried(village)} disabled={!village}>View Report</button>
      </div>
      {(villageList || []).length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">📍 All Villages ({villageList.length})</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Village</th><th>Students</th><th>Actions</th></tr></thead>
              <tbody>
                {villageList.map((v, i) => (
                  <tr key={v.village || v._id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{v.village || v._id}</td>
                    <td><span className="badge badge-blue">{v.count}</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setVillage(v.village || v._id); setQueried(v.village || v._id); }}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Alert type="info" style={{ marginTop: 12 }}>Select a village from the dropdown or the list above.</Alert>
    </div>
  );

  if (isLoading) return <LoadingPage />;
  if (!data) return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { setQueried(''); setVillage(''); }}>← Back</button>
      </div>
      <Alert type="warning">No data for {queried}.</Alert>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { setQueried(''); setVillage(''); }}>← All Villages</button>
        <span style={{ fontWeight: 800, fontSize: '1rem' }}>📍 {queried}</span>
        <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Download size={13} /> Export PDF</button>
      </div>
      <StatRow items={[
        { label: 'Total Students', value: data.totalStudents, color: '#3b82f6' },
        { label: 'Present', value: data.stats?.attendance?.present, color: '#16a34a' },
        { label: 'Total Records', value: data.stats?.attendance?.total, color: '#8b5cf6' },
        { label: 'Attendance Rate', value: `${data.stats?.attendance?.rate ?? 0}%`, color: '#10b981' },
      ]} />
      <SectionCard title={`👥 Students from ${queried}`}>
        <table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Grade</th><th>Category</th><th>Contact</th><th>Parent</th><th>Class</th><th>Present</th><th>Rate</th></tr></thead>
          <tbody>
            {(data.students || []).map(s => (
              <tr key={s._id}>
                <td><span className="code" style={{ fontSize: '0.75rem' }}>{s.studentId || '—'}</span></td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.grade}</td>
                <td><CategoryBadge category={s.category} /></td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{s.contactNumber || '—'}</td>
                <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{s.parentName || '—'}</td>
                <td>{s.classAssigned?.name ? <span className="badge badge-navy">{s.classAssigned.name}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>}</td>
                <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.attendance?.present ?? 0}</span></td>
                <td><RateBar rate={s.attendance?.rate ?? 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 6. VOLUNTEER REPORT ════════════════════════════════ */
function VolunteerReport({ volunteerId, vbsYear }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-volunteer', volunteerId, vbsYear],
    queryFn: () => reportsAPI.getVolunteer(volunteerId),
    enabled: !!volunteerId && !!vbsYear,
    select: d => d.data?.data,
  });
  if (!volunteerId) return <Alert type="info">Select a volunteer above.</Alert>;
  if (isLoading) return <LoadingPage />;
  if (!data) return <Alert type="warning">No data.</Alert>;
  const { volunteer, attendance } = data;
  return (
    <div>
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{volunteer?.name}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Role: <strong>{volunteer?.role || '—'}</strong>
          {volunteer?.shift && <> · Shift: <strong>{volunteer.shift}</strong></>}
          {' · '}{volunteer?.contactNumber || '—'}
        </div>
      </div>
      <StatRow items={[
        { label: 'Present', value: attendance?.present, color: '#16a34a' },
        { label: 'Half Day', value: attendance?.halfDay, color: '#ea580c' },
        { label: 'Absent', value: attendance?.absent, color: '#dc2626' },
        { label: 'Rate', value: `${attendance?.rate ?? 0}%`, color: '#3b82f6' },
      ]} />
      <SectionCard title="📅 Attendance History">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Shift</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {(attendance?.history || []).length === 0
              ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>No records.</td></tr>
              : (attendance?.history || []).map((h, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{fmtDate(h.date)}</td>
                  <td><span className={`badge ${h.status === 'present' ? 'badge-green' : h.status === 'halfDay' ? 'badge-orange' : 'badge-red'}`}>{h.status}</span></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{h.shift || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{h.checkInTime || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{h.checkOutTime || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ═══════════════ 7. CATEGORY REPORT ════════════════════════════════ */
// FIX: Replaced direct api.get calls with reportsAPI
function CategoryReport({ vbsYear }) {
  const [category, setCategory] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['report-category', category, vbsYear],
    queryFn: () => reportsAPI.getCategory(category, { vbsYear }),
    enabled: !!category && !!vbsYear,
    select: d => d.data?.data,
  });

  const CATS = ['Beginner', 'Primary', 'Junior', 'Inter'];
  const GRADE_RANGES = { Beginner: 'PreKG – Grade 2', Primary: 'Grade 3–5', Junior: 'Grade 6–8', Inter: 'Grade 9–12' };

  const handlePrint = () => {
    if (!data) return;
    const sum = mkSummary([
      { l: 'Category', v: category },
      { l: 'Grade Range', v: GRADE_RANGES[category] || '—' },
      { l: 'Students', v: data.totalStudents },
      { l: 'Classes', v: data.totalClasses },
      { l: 'Rate', v: `${data.stats?.attendance?.rate ?? 0}%` },
    ]);
    const classRows = (data.classes || []).map(c =>
      `<tr><td>${c.name}</td><td>${c.teacher || 'Unassigned'}</td><td>${c.capacity || '—'}</td></tr>`
    ).join('');
    const studentRows = (data.students || []).map(s =>
      `<tr><td>${s.studentId || '—'}</td><td>${s.name}</td><td>${s.grade}</td><td>${s.contactNumber || '—'}</td><td>${s.parentName || '—'}</td><td>${s.village || '—'}</td><td>${s.classAssigned?.name || '—'}</td><td>${s.attendance?.present ?? 0}</td><td>${s.attendance?.rate ?? 0}%</td></tr>`
    ).join('');
    const body = `
      ${classRows ? `<div class="section-head">Classes (${data.classes?.length || 0})</div>${mkTable(['Class Name', 'Teacher', 'Capacity'], classRows)}` : ''}
      <div class="section-head">Students (${data.totalStudents})</div>
      ${mkTable(['Student ID', 'Name', 'Grade', 'Contact', 'Parent', 'Village', 'Class', 'Present', 'Rate'], studentRows)}`;
    printPage(`Category Report — ${category}`, body, sum, vbsYear);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`btn ${c === category ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '8px 16px', gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{c}</span>
            <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>{GRADE_RANGES[c]}</span>
          </button>
        ))}
      </div>

      {!category && <Alert type="info">Select a category above to view the report.</Alert>}
      {category && isLoading && <LoadingPage />}
      {category && !isLoading && !data && <Alert type="warning">No data for {category}.</Alert>}
      {category && !isLoading && data && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{category} Category <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>— {GRADE_RANGES[category]}</span></div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>{data.totalStudents} students · {data.totalClasses} classes</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Download size={13} /> Export PDF</button>
            </div>
          </div>

          <StatRow items={[
            { label: 'Students', value: data.totalStudents, color: '#3b82f6' },
            { label: 'Classes', value: data.totalClasses, color: '#8b5cf6' },
            { label: 'Present', value: data.stats?.attendance?.present, color: '#16a34a' },
            { label: 'Rate', value: `${data.stats?.attendance?.rate ?? 0}%`, color: '#10b981' },
          ]} />

          {(data.classes || []).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">🏫 Classes in {category}</span></div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.classes.map(c => (
                  <div key={c._id} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)', minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.845rem' }}>{c.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {c.teacher || 'No teacher'} · Cap: {c.capacity || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionCard title={`👥 ${category} Students`}>
            <table>
              <thead><tr><th>Student ID</th><th>Name</th><th>Grade</th><th>Contact</th><th>Village</th><th>Class</th><th>Present</th><th>Rate</th></tr></thead>
              <tbody>
                {(data.students || []).map(s => (
                  <tr key={s._id}>
                    <td><span className="code" style={{ fontSize: '0.75rem' }}>{s.studentId || '—'}</span></td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.grade}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{s.contactNumber || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{s.village || '—'}</td>
                    <td>{s.classAssigned?.name ? <span className="badge badge-navy">{s.classAssigned.name}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>}</td>
                    <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{s.attendance?.present ?? 0}</span></td>
                    <td><RateBar rate={s.attendance?.rate ?? 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </div>
  );
}

/* ═══════════════ MAIN PAGE ════════════════════════════════════════ */
const REPORT_TYPES = [
  { id: 'daily',     label: 'Daily',     icon: Calendar,      desc: 'All classes on a date' },
  { id: 'class',     label: 'Class',     icon: BookOpen,      desc: 'Per-student class breakdown' },
  { id: 'full-year', label: 'Full Year', icon: FileText,      desc: 'Complete VBS statistics' },
  { id: 'teacher',   label: 'Teacher',   icon: GraduationCap, desc: 'Submissions & attendance' },
  { id: 'student',   label: 'Student',   icon: Users,         desc: 'Individual history' },
  { id: 'village',   label: 'Village',   icon: MapPin,        desc: 'Students by village' },
  { id: 'volunteer', label: 'Volunteer', icon: Heart,         desc: 'Volunteer attendance' },
  { id: 'category',  label: 'Category',  icon: BookOpen,      desc: 'Beginner/Primary/Junior/Inter' },
];

export default function ReportsPage() {
  const { vbsYear, activeYear, allYears } = useActiveYear();
  const [activeReport, setActiveReport] = useState('daily');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedVol, setSelectedVol] = useState('');

  const { data: activeSettings } = useQuery({ queryKey: ['active-settings'], queryFn: () => settingsAPI.getActive().then(r => r.data?.data) });
  const { data: classes } = useQuery({ queryKey: ['classes', vbsYear], queryFn: () => classesAPI.getAll({ year: vbsYear }), select: d => d.data?.data || [], enabled: !!vbsYear });
  const { data: teachers } = useQuery({ queryKey: ['teachers-list', vbsYear], queryFn: () => teachersAPI.getAll({ isActive: true }), select: d => d.data?.data || [], enabled: !!vbsYear });
  const { data: volunteers } = useQuery({ queryKey: ['vol-list', vbsYear], queryFn: () => volunteersAPI.getAll(), select: d => d.data?.data || [], enabled: !!vbsYear });

  if (!vbsYear) return <NoYearState />;

  const handleTypeChange = (id) => {
    setActiveReport(id);
    setSelectedClass('');
    setSelectedTeacher('');
    setSelectedVol('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate detailed reports · <Printer size={13} style={{ verticalAlign: 'middle' }} /> prints as PDF</p>
        </div>
      </div>
      <YearBanner vbsYear={vbsYear} activeYear={activeYear} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = activeReport === rt.id;
          return (
            <button key={rt.id} onClick={() => handleTypeChange(rt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
                borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-primary)' : 'white',
                color: active ? 'white' : 'var(--color-text)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
              }}>
              <Icon size={14} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{rt.label}</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.75, lineHeight: 1.2 }}>{rt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {['daily', 'class', 'teacher', 'volunteer'].includes(activeReport) && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {activeReport === 'daily' && (
              <div style={{ flex: '1 1 200px' }}>
                <DateInput
                  label="Date"
                  value={date}
                  onChange={setDate}
                  vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
                  vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
                  showVBSDays={true}
                />
              </div>
            )}
            {activeReport === 'class' && (
              <div>
                <label className="form-label">Class — VBS {vbsYear}</label>
                <select className="form-select" style={{ width: 260 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  <option value="">Choose a class…</option>
                  {(classes || []).map(c => <option key={c._id} value={c._id}>{c.name} ({c.category})</option>)}
                </select>
              </div>
            )}
            {activeReport === 'teacher' && (
              <div>
                <label className="form-label">Teacher</label>
                <select className="form-select" style={{ width: 260 }} value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
                  <option value="">Choose a teacher…</option>
                  {(teachers || []).map(t => <option key={t._id} value={t._id}>{t.name}{t.classAssigned?.name ? ` — ${t.classAssigned.name}` : ''}</option>)}
                </select>
              </div>
            )}
            {activeReport === 'volunteer' && (
              <div>
                <label className="form-label">Volunteer</label>
                <select className="form-select" style={{ width: 260 }} value={selectedVol} onChange={e => setSelectedVol(e.target.value)}>
                  <option value="">Choose a volunteer…</option>
                  {(volunteers || []).map(v => <option key={v._id} value={v._id}>{v.name} — {v.role}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {activeReport === 'daily' && (
        <DailyReport date={date} vbsYear={vbsYear}
          vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
          vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
        />
      )}
      {activeReport === 'class'     && <ClassReport classId={selectedClass} vbsYear={vbsYear} />}
      {activeReport === 'full-year' && <FullYearReport vbsYear={vbsYear} allYears={allYears} />}
      {activeReport === 'teacher'   && <TeacherReport teacherId={selectedTeacher} vbsYear={vbsYear} />}
      {activeReport === 'student'   && <StudentReport vbsYear={vbsYear} />}
      {activeReport === 'village'   && <VillageReport vbsYear={vbsYear} />}
      {activeReport === 'volunteer' && <VolunteerReport volunteerId={selectedVol} vbsYear={vbsYear} />}
      {activeReport === 'category'  && <CategoryReport vbsYear={vbsYear} />}
    </div>
  );
}
