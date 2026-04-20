// frontend/src/pages/ExtraReportsPage.jsx
// ─── Extra Reports: Student Attendance Grid + Religion-wise Report ──
// Place this file in frontend/src/pages/ExtraReportsPage.jsx

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Printer, Download, RefreshCw, Users, BookOpen,
  ChevronDown, ChevronUp, Filter, BarChart2, Cross,
  Star, TrendingUp, Award, Calendar, ArrowRight,
} from 'lucide-react';
import { reportsAPI } from '../services/api';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage, Alert } from '../components/common';

/* ─── Helpers ──────────────────────────────────────────────────────── */
const CATEGORIES = ['Beginner', 'Primary', 'Junior', 'Inter'];

const GRADE_RANGES = {
  Beginner: 'PreKG – Grade 2',
  Primary: 'Grade 3 – 5',
  Junior: 'Grade 6 – 8',
  Inter: 'Grade 9 – 12',
};

const CAT_COLORS = {
  Beginner: { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed', light: '#f5f3ff' },
  Primary:  { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6', light: '#eff6ff' },
  Junior:   { bg: '#dcfce7', color: '#15803d', dot: '#22c55e', light: '#f0fdf4' },
  Inter:    { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b', light: '#fffbeb' },
};

const RELIGION_COLORS = {
  Christian: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', icon: '✝️' },
  Hindu:     { bg: '#fef9c3', color: '#92400e', border: '#fde68a', icon: '🕉️' },
  Muslim:    { bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: '☪️' },
  Other:     { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '🌐' },
};

const RateBar = ({ rate = 0, compact = false }) => {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  if (compact) {
    return (
      <span style={{ fontWeight: 800, fontSize: '0.78rem', color }}>{rate}%</span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 44, height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontWeight: 800, fontSize: '0.75rem', color, minWidth: 32 }}>{rate}%</span>
    </div>
  );
};

const StatPill = ({ label, value, color = '#1a2f5e', bg = '#eff6ff' }) => (
  <div style={{ padding: '10px 16px', borderRadius: 12, background: bg, border: `1px solid ${color}20`, textAlign: 'center', minWidth: 90 }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 900, color, lineHeight: 1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginTop: 4 }}>{label}</div>
  </div>
);

/* ─── PDF print helper ─────────────────────────────────────────────── */
const printStudentAttendance = (data, vbsYear) => {
  if (!data) return;
  const { category, dates, rows, summary } = data;
  const catColor = CAT_COLORS[category];

  const MAX_COLS_PER_PAGE = 18;
  const dateChunks = [];
  for (let i = 0; i < dates.length; i += MAX_COLS_PER_PAGE) {
    dateChunks.push(dates.slice(i, i + MAX_COLS_PER_PAGE));
  }

  const rateClass = (r) =>
    r >= 80 ? '#15803d' : r >= 60 ? '#d97706' : '#b91c1c';

  const css = `
    @page { size: A4 landscape; margin: 10mm 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #111; }
    .hdr { border-bottom: 3px solid #1a2f5e; padding-bottom: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; }
    .hdr-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 6px; }
    .hdr-text .church { font-size: 13pt; font-weight: 800; color: #1a2f5e; }
    .hdr-text .vbs { font-size: 8.5pt; font-weight: 700; color: #c8922a; margin-top: 1px; }
    .hdr-text .rpt { font-size: 10pt; font-weight: 800; color: ${catColor.color}; margin-top: 3px; }
    .summary { display: flex; gap: 8px; margin-bottom: 10px; }
    .s-card { border: 1px solid #dde2ea; border-radius: 5px; padding: 6px 12px; }
    .s-card .n { font-size: 14pt; font-weight: 900; color: #1a2f5e; line-height: 1; }
    .s-card .l { font-size: 6.5pt; color: #666; text-transform: uppercase; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background: #1a2f5e; color: white; padding: 4px 3px; text-align: center; font-size: 7pt; font-weight: 700; }
    th.name-col { text-align: left; padding-left: 7px; min-width: 120px; }
    td { padding: 3px; border-bottom: 1px solid #e8edf2; font-size: 7.5pt; text-align: center; }
    td.name-cell { text-align: left; padding-left: 7px; font-weight: 500; }
    td.id-cell { font-family: monospace; font-size: 7pt; color: #555; }
    .p { color: #15803d; font-weight: 800; }
    .a { color: #b91c1c; font-weight: 800; }
    tr:nth-child(even) td { background: #f9fafb; }
    .total-row td { background: ${catColor.bg} !important; font-weight: 800; }
    .page-break { page-break-before: always; }
    .chunk-header { font-size: 7.5pt; color: #666; margin: 8px 0 3px; font-weight: 600; }
    .ftr { margin-top: 8px; font-size: 7pt; color: #888; border-top: 1px solid #ddd; padding-top: 5px; display: flex; justify-content: space-between; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  `;

  // Per-date totals for footer row
  const perDateTotals = dates.map(d =>
    rows.filter(r => r.daily[dates.indexOf(d)] === 'present').length
  );

  let body = `
    <div class="summary">
      <div class="s-card"><div class="n">${rows.length}</div><div class="l">Total Students</div></div>
      <div class="s-card"><div class="n" style="color:#15803d">${summary.grandTotalPresent}</div><div class="l">Total Present</div></div>
      <div class="s-card"><div class="n" style="color:${rateClass(summary.overallRate)}">${summary.overallRate}%</div><div class="l">Avg Rate</div></div>
      <div class="s-card"><div class="n">${dates.length}</div><div class="l">VBS Days</div></div>
    </div>
  `;

  dateChunks.forEach((chunk, ci) => {
    if (ci > 0) body += `<div class="page-break"></div>`;
    body += `
      ${ci > 0 ? `<div class="chunk-header">Continued — Days ${chunk[0].dayNum} to ${chunk[chunk.length - 1].dayNum}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th style="width:22px">#</th>
            <th style="width:65px">ID</th>
            <th class="name-col">Name</th>
            <th style="width:30px">Grade</th>
            ${chunk.map(d => `<th style="width:28px">D${d.dayNum}<br><span style="font-size:5.5pt;font-weight:400">${d.dateStr.slice(0,5)}</span></th>`).join('')}
            <th style="width:28px">Pres.</th>
            <th style="width:28px">Abs.</th>
            <th style="width:32px">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const dayCells = chunk.map(d => {
              const status = r.daily[dates.indexOf(d)];
              return `<td class="${status === 'present' ? 'p' : status === 'absent' ? 'a' : ''}">${
                status === 'present' ? '✓' : status === 'absent' ? '✗' : '—'
              }</td>`;
            }).join('');
            return `<tr>
              <td style="color:#9ca3af;font-size:6.5pt">${r.sno}</td>
              <td class="id-cell">${r.studentId}</td>
              <td class="name-cell">${r.name}</td>
              <td style="color:#555">${r.grade}</td>
              ${dayCells}
              <td class="p">${r.totalPresent}</td>
              <td class="a">${r.totalAbsent}</td>
              <td style="font-weight:800;color:${rateClass(r.percentage)}">${r.percentage}%</td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td colspan="4" style="text-align:right;padding-right:6px;font-size:7pt;color:#1a2f5e">Day Total →</td>
            ${chunk.map(d => `<td style="color:#15803d">${perDateTotals[dates.indexOf(d)]}</td>`).join('')}
            <td style="color:#15803d">${summary.grandTotalPresent}</td>
            <td style="color:#b91c1c">${summary.grandTotalRecorded - summary.grandTotalPresent}</td>
            <td style="color:${rateClass(summary.overallRate)}">${summary.overallRate}%</td>
          </tr>
        </tbody>
      </table>
    `;
  });

  body += `<div class="ftr">
    <span>VBS Management System — Presence of Jesus Ministry</span>
    <span>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
  </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${category} Attendance Report — VBS ${vbsYear}</title>
    <style>${css}</style>
  </head><body>
    <div class="hdr">
      <img class="hdr-logo" src="/poj-logo.png" alt="POJ" onerror="this.style.display='none'" />
      <div class="hdr-text">
        <div class="church">Presence of Jesus Ministry, Tuticorin</div>
        <div class="vbs">Vacation Bible School ${vbsYear}</div>
        <div class="rpt">📋 ${category} Student Attendance Report (${GRADE_RANGES[category]})</div>
      </div>
    </div>
    ${body}
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500); }
};

const printReligionReport = (data, religion, vbsYear) => {
  if (!data?.religionStudents) return;
  const students = data.religionStudents;
  const rc = RELIGION_COLORS[religion] || RELIGION_COLORS.Other;

  const css = `
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #111; }
    .hdr { border-bottom: 3px solid #1a2f5e; padding-bottom: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; }
    .hdr-logo { width: 40px; height: 40px; object-fit: contain; }
    .church { font-size: 13pt; font-weight: 800; color: #1a2f5e; }
    .vbs { font-size: 8.5pt; font-weight: 700; color: #c8922a; margin-top: 1px; }
    .rpt { font-size: 10pt; font-weight: 800; color: ${rc.color}; margin-top: 3px; }
    .summary { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .s-card { border: 1px solid #dde2ea; border-radius: 5px; padding: 6px 12px; }
    .s-card .n { font-size: 14pt; font-weight: 900; color: #1a2f5e; }
    .s-card .l { font-size: 6.5pt; color: #666; text-transform: uppercase; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a2f5e; color: white; padding: 5px 7px; text-align: left; font-size: 7.5pt; font-weight: 700; }
    td { padding: 4px 7px; border-bottom: 1px solid #e8edf2; font-size: 8pt; }
    tr:nth-child(even) td { background: #f9fafb; }
    .ftr { margin-top: 10px; font-size: 7pt; color: #888; border-top: 1px solid #ddd; padding-top: 5px; display: flex; justify-content: space-between; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  `;

  const rateColor = (r) => r >= 80 ? '#15803d' : r >= 60 ? '#d97706' : '#b91c1c';

  const rows = students.map(s => `<tr>
    <td style="color:#9ca3af;font-size:7pt">${s.sno}</td>
    <td style="font-family:monospace;font-size:7.5pt">${s.studentId}</td>
    <td style="font-weight:600">${s.name}</td>
    <td>${s.grade}</td>
    <td>${s.category}</td>
    <td style="text-transform:capitalize">${s.gender}</td>
    ${religion === 'Christian' ? `<td>${s.christianDenomination || '—'}</td>` : ''}
    <td>${s.village || '—'}</td>
    <td style="font-family:monospace;font-size:7.5pt">${s.contactNumber || '—'}</td>
    <td>${s.classAssigned}</td>
    <td style="color:#15803d;font-weight:700">${s.attendance.present}</td>
    <td>${s.attendance.total}</td>
    <td style="font-weight:800;color:${rateColor(s.attendance.rate)}">${s.attendance.rate}%</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${religion} Students — VBS ${vbsYear}</title>
    <style>${css}</style>
  </head><body>
    <div class="hdr">
      <img class="hdr-logo" src="/poj-logo.png" alt="POJ" onerror="this.style.display='none'" />
      <div>
        <div class="church">Presence of Jesus Ministry, Tuticorin</div>
        <div class="vbs">Vacation Bible School ${vbsYear}</div>
        <div class="rpt">${rc.icon} ${religion} Students Report</div>
      </div>
    </div>
    <div class="summary">
      <div class="s-card"><div class="n">${students.length}</div><div class="l">Total Students</div></div>
      <div class="s-card"><div class="n" style="color:#15803d">${students.reduce((s,r)=>s+r.attendance.present,0)}</div><div class="l">Total Present</div></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:22px">#</th>
        <th style="width:70px">Student ID</th>
        <th style="width:140px">Name</th>
        <th style="width:35px">Grade</th>
        <th style="width:60px">Category</th>
        <th style="width:40px">Gender</th>
        ${religion === 'Christian' ? '<th style="width:80px">Denomination</th>' : ''}
        <th style="width:90px">Village</th>
        <th style="width:80px">Contact</th>
        <th style="width:100px">Class</th>
        <th style="width:30px">Pres.</th>
        <th style="width:30px">Days</th>
        <th style="width:35px">Rate</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ftr">
      <span>VBS Management System — Presence of Jesus Ministry</span>
      <span>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
    </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500); }
};

/* ═══════════════════════════════════════════════════════════════════
   REPORT 1: Student Attendance by Category
   ═══════════════════════════════════════════════════════════════════ */
function StudentAttendanceReport({ vbsYear }) {
  const [category, setCategory] = useState('Beginner');
  const [sortField, setSortField] = useState('sno');
  const [sortDir, setSortDir] = useState('asc');
  const [filterAbsent, setFilterAbsent] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['report-student-attendance', category, vbsYear],
    queryFn: () => reportsAPI.getStudentAttendanceReport(category, { vbsYear }),
    enabled: !!category && !!vbsYear,
    select: d => d.data?.data,
  });

  const catColor = CAT_COLORS[category] || CAT_COLORS.Beginner;

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const sortedRows = useMemo(() => {
    if (!data?.rows) return [];
    let rows = filterAbsent
      ? data.rows.filter(r => r.percentage < 75)
      : [...data.rows];

    rows.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, sortField, sortDir, filterAbsent]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pagedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePrint = () => {
    setPrinting(true);
    printStudentAttendance(data, vbsYear);
    setTimeout(() => setPrinting(false), 1000);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ color: '#ccc', fontSize: '0.6rem', marginLeft: 2 }}>↕</span>;
    return <span style={{ color: catColor.dot, fontSize: '0.7rem', marginLeft: 2 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = (field) => ({
    padding: '8px 6px',
    textAlign: 'center',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: '#1a2f5e',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderRight: '1px solid rgba(255,255,255,0.1)',
  });

  return (
    <div>
      {/* Category Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => {
          const cc = CAT_COLORS[cat];
          const active = category === cat;
          return (
            <button key={cat} onClick={() => { setCategory(cat); setPage(1); setSortField('sno'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 12,
                border: `2px solid ${active ? cc.dot : '#e2e8f0'}`,
                background: active ? cc.bg : 'white',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'all 0.18s',
              }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cc.dot, flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: active ? cc.color : 'var(--color-text)' }}>{cat}</div>
                <div style={{ fontSize: '0.65rem', color: active ? cc.color : '#9ca3af', opacity: 0.85 }}>{GRADE_RANGES[cat]}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Stats + Actions */}
      {data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <StatPill label="Students" value={data.totalStudents} color={catColor.color} bg={catColor.bg} />
          <StatPill label="VBS Days" value={data.dates?.length} color="#1a2f5e" bg="#eff6ff" />
          <StatPill label="Total Present" value={data.summary?.grandTotalPresent} color="#16a34a" bg="#f0fdf4" />
          <StatPill label="Overall Rate" value={`${data.summary?.overallRate}%`}
            color={data.summary?.overallRate >= 80 ? '#15803d' : data.summary?.overallRate >= 60 ? '#d97706' : '#b91c1c'}
            bg={data.summary?.overallRate >= 80 ? '#f0fdf4' : data.summary?.overallRate >= 60 ? '#fffbeb' : '#fef2f2'} />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '6px 12px', borderRadius: 8, border: '1px solid #c4b5fd', userSelect: 'none' }}>
              <input type="checkbox" checked={filterAbsent} onChange={e => { setFilterAbsent(e.target.checked); setPage(1); }}
                style={{ accentColor: '#7c3aed' }} />
              Low attendance (&lt;75%)
            </label>
            <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
            </button>
            <button
              onClick={handlePrint}
              disabled={printing || !data}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#1a2f5e', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 700, opacity: printing ? 0.7 : 1 }}>
              {printing
                ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Preparing…</>
                : <><Printer size={14} /> Print PDF</>}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingPage />
      ) : !data ? (
        <Alert type="warning">No data for {category} — VBS {vbsYear}.</Alert>
      ) : data.rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
          <div style={{ fontWeight: 700 }}>No students in {category} category</div>
        </div>
      ) : (
        <>
          {/* Attendance Grid Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ background: `linear-gradient(135deg, #1a2f5e, #2a4a8e)`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ padding: '3px 12px', borderRadius: 99, background: catColor.bg, color: catColor.color, fontSize: '0.72rem', fontWeight: 800 }}>
                  {category}
                </span>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
                  Student Attendance Grid — {GRADE_RANGES[category]}
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
                {sortedRows.length} students · {data.dates?.length} days
              </span>
            </div>

            {/* Legend */}
            <div style={{ padding: '7px 16px', background: 'rgba(26,47,94,0.04)', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16, alignItems: 'center' }}>
              {[
                { color: '#dcfce7', border: '#86efac', textColor: '#15803d', label: '✓ Present' },
                { color: '#fee2e2', border: '#fca5a5', textColor: '#b91c1c', label: '✗ Absent' },
                { color: '#f1f5f9', border: '#e2e8f0', textColor: '#9ca3af', label: '— No Record' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: `1px solid ${l.border}` }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: l.textColor }}>{l.label}</span>
                </div>
              ))}
              {filterAbsent && (
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#7c3aed', fontWeight: 700, background: '#ede9fe', padding: '2px 8px', borderRadius: 99 }}>
                  Filtered: low attendance
                </span>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('sno')} style={{ ...thStyle('sno'), width: 36, textAlign: 'left', paddingLeft: 12 }}>
                      # <SortIcon field="sno" />
                    </th>
                    <th onClick={() => handleSort('studentId')} style={{ ...thStyle('studentId'), width: 80, textAlign: 'left', paddingLeft: 8 }}>
                      ID <SortIcon field="studentId" />
                    </th>
                    <th onClick={() => handleSort('name')} style={{ ...thStyle('name'), textAlign: 'left', paddingLeft: 8, minWidth: 140 }}>
                      Name <SortIcon field="name" />
                    </th>
                    <th onClick={() => handleSort('grade')} style={{ ...thStyle('grade'), width: 44 }}>
                      Grade <SortIcon field="grade" />
                    </th>
                    {data.dates.map((d, di) => (
                      <th key={di} style={{ ...thStyle(`day_${di}`), width: 30, padding: '4px 2px', cursor: 'default' }}
                        title={d.dayLabel}>
                        D{d.dayNum}
                      </th>
                    ))}
                    <th onClick={() => handleSort('totalPresent')} style={{ ...thStyle('totalPresent'), width: 38, background: '#15803d' }}>
                      P <SortIcon field="totalPresent" />
                    </th>
                    <th onClick={() => handleSort('totalAbsent')} style={{ ...thStyle('totalAbsent'), width: 38, background: '#b91c1c' }}>
                      A <SortIcon field="totalAbsent" />
                    </th>
                    <th onClick={() => handleSort('percentage')} style={{ ...thStyle('percentage'), width: 54, background: '#4b5563' }}>
                      Rate <SortIcon field="percentage" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, rowIdx) => {
                    const isLow = row.percentage < 75 && row.totalRecorded > 0;
                    return (
                      <tr key={row.sno}
                        style={{ background: rowIdx % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ padding: '7px 6px 7px 12px', fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>
                          {row.sno}
                        </td>
                        <td style={{ padding: '7px 6px', fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: '#1a2f5e', fontWeight: 600 }}>
                          {row.studentId}
                        </td>
                        <td style={{ padding: '7px 6px 7px 8px', fontWeight: 600, fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.name}
                            {isLow && (
                              <span style={{ fontSize: '0.58rem', background: '#fee2e2', color: '#b91c1c', borderRadius: 4, padding: '1px 5px', fontWeight: 800 }}>
                                LOW
                              </span>
                            )}
                          </div>
                          {row.village && <div style={{ fontSize: '0.67rem', color: '#9ca3af', marginTop: 1 }}>{row.village}</div>}
                        </td>
                        <td style={{ padding: '7px 2px', textAlign: 'center', fontSize: '0.78rem', color: '#4b5563' }}>
                          {row.grade}
                        </td>
                        {row.daily.map((status, di) => (
                          <td key={di} style={{
                            padding: '5px 2px',
                            textAlign: 'center',
                            background: status === 'present' ? '#dcfce7' : status === 'absent' ? '#fee2e2' : '#f8fafd',
                            borderRight: '1px solid #f0f4f8',
                          }}>
                            {status === 'present' && <span style={{ color: '#15803d', fontWeight: 800, fontSize: '0.75rem' }}>✓</span>}
                            {status === 'absent' && <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.75rem' }}>✗</span>}
                            {!status && <span style={{ color: '#d1d5db', fontSize: '0.65rem' }}>—</span>}
                          </td>
                        ))}
                        <td style={{ padding: '7px 4px', textAlign: 'center', background: '#f0fdf4', color: '#15803d', fontWeight: 800, fontSize: '0.82rem' }}>
                          {row.totalPresent}
                        </td>
                        <td style={{ padding: '7px 4px', textAlign: 'center', background: '#fef2f2', color: '#b91c1c', fontWeight: 800, fontSize: '0.82rem' }}>
                          {row.totalAbsent}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                          <RateBar rate={row.percentage} compact />
                        </td>
                      </tr>
                    );
                  })}

                  {/* Footer total row */}
                  <tr style={{ background: catColor.bg, borderTop: '2px solid ' + catColor.dot }}>
                    <td colSpan={4} style={{ padding: '8px 12px', fontWeight: 800, fontSize: '0.78rem', color: catColor.color }}>
                      Total — {sortedRows.length} students
                    </td>
                    {data.dates.map((d, di) => {
                      const dayPresent = sortedRows.filter(r => r.daily[di] === 'present').length;
                      return (
                        <td key={di} style={{ padding: '8px 2px', textAlign: 'center', fontWeight: 800, fontSize: '0.72rem', color: '#15803d' }}>
                          {dayPresent}
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 900, color: '#15803d', fontSize: '0.85rem' }}>
                      {data.summary.grandTotalPresent}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 900, color: '#b91c1c', fontSize: '0.85rem' }}>
                      {data.summary.grandTotalRecorded - data.summary.grandTotalPresent}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <RateBar rate={data.summary.overallRate} compact />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfd' }}>
                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, sortedRows.length)} of {sortedRows.length} students
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p}
                      onClick={() => setPage(p)}
                      style={{
                        padding: '4px 10px', borderRadius: 7, border: '1px solid',
                        borderColor: p === page ? catColor.dot : '#e2e8f0',
                        background: p === page ? catColor.bg : 'white',
                        color: p === page ? catColor.color : '#4b5563',
                        fontWeight: p === page ? 800 : 500, fontSize: '0.78rem',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}>
                      {p}
                    </button>
                  ))}
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT 2: Religion-wise Report
   ═══════════════════════════════════════════════════════════════════ */
function ReligionReport({ vbsYear }) {
  const [selectedReligion, setSelectedReligion] = useState('');
  const [sortField, setSortField] = useState('sno');
  const [sortDir, setSortDir] = useState('asc');
  const [filterDenom, setFilterDenom] = useState('');
  const [printing, setPrinting] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['report-religion', vbsYear, selectedReligion],
    queryFn: () => reportsAPI.getReligionReport({ vbsYear, religion: selectedReligion || undefined }),
    enabled: !!vbsYear,
    select: d => d.data?.data,
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedStudents = useMemo(() => {
    if (!data?.religionStudents) return [];
    let rows = [...data.religionStudents];
    if (filterDenom) rows = rows.filter(r => r.christianDenomination === filterDenom);
    rows.sort((a, b) => {
      let va = sortField === 'attendance' ? a.attendance.rate : a[sortField];
      let vb = sortField === 'attendance' ? b.attendance.rate : b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, sortField, sortDir, filterDenom]);

  const religions = useMemo(() => (data?.religionDistribution || []).map(r => r._id), [data]);
  const denoms = useMemo(() => (data?.denominationDistribution || []).map(d => d._id), [data]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', marginLeft: 2 }}>↕</span>;
    return <span style={{ color: '#fbbf24', fontSize: '0.7rem', marginLeft: 2 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handlePrint = () => {
    if (!data) return;
    setPrinting(true);
    printReligionReport(data, selectedReligion, vbsYear);
    setTimeout(() => setPrinting(false), 1000);
  };

  // Build cat breakdown per religion for the overview
  const catBreakdownMap = useMemo(() => {
    const map = {};
    (data?.categoryByReligion || []).forEach(item => {
      const rel = item._id.religion;
      const cat = item._id.category;
      if (!map[rel]) map[rel] = {};
      map[rel][cat] = item.count;
    });
    return map;
  }, [data]);

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      {/* Overview Cards */}
      {!selectedReligion && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            {(data?.religionDistribution || []).map(r => {
              const rc = RELIGION_COLORS[r._id] || RELIGION_COLORS.Other;
              const catBreakdown = catBreakdownMap[r._id] || {};
              return (
                <button key={r._id} onClick={() => setSelectedReligion(r._id)}
                  style={{
                    border: `2px solid ${rc.border}`,
                    borderRadius: 14,
                    padding: '16px 18px',
                    background: rc.bg,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                    transition: 'all 0.18s',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${rc.border}60`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.4rem' }}>{rc.icon}</span>
                    <span style={{ fontSize: '0.62rem', background: rc.border + '50', color: rc.color, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                      View →
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: rc.color }}>{r._id}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{r.count}</div>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>students</div>
                  </div>
                  {Object.keys(catBreakdown).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {CATEGORIES.filter(c => catBreakdown[c]).map(c => (
                        <span key={c} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 99, background: CAT_COLORS[c].bg, color: CAT_COLORS[c].color, fontWeight: 700 }}>
                          {c.slice(0, 3)} {catBreakdown[c]}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Denomination breakdown */}
          {(data?.denominationDistribution || []).length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">✝️ Christian Denomination Breakdown</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {data.denominationDistribution.map(d => (
                  <div key={d._id} style={{ padding: '10px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', textAlign: 'center', minWidth: 100 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>{d.count}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', marginTop: 3 }}>{d._id}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Alert type="info">Click on a religion card above to see detailed student list with attendance.</Alert>
        </>
      )}

      {/* Religion Detail View */}
      {selectedReligion && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedReligion(''); setFilterDenom(''); }}>
              ← All Religions
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>{(RELIGION_COLORS[selectedReligion] || RELIGION_COLORS.Other).icon}</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{selectedReligion} Students</span>
            </div>
            {selectedReligion === 'Christian' && denoms.length > 0 && (
              <select className="form-select" style={{ width: 160 }} value={filterDenom} onChange={e => setFilterDenom(e.target.value)}>
                <option value="">All Denominations</option>
                {denoms.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
              </button>
              <button
                onClick={handlePrint}
                disabled={printing || !data?.religionStudents}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 9, border: 'none', background: '#1a2f5e', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 700 }}>
                {printing
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Preparing…</>
                  : <><Printer size={14} /> Print PDF</>}
              </button>
            </div>
          </div>

          {/* Stats */}
          {data?.religionStudents && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <StatPill label="Students" value={sortedStudents.length} color="#1d4ed8" bg="#dbeafe" />
              {CATEGORIES.map(cat => {
                const count = sortedStudents.filter(s => s.category === cat).length;
                if (!count) return null;
                const cc = CAT_COLORS[cat];
                return <StatPill key={cat} label={cat} value={count} color={cc.color} bg={cc.bg} />;
              })}
              <StatPill
                label="Avg Attendance"
                value={sortedStudents.length > 0
                  ? `${Math.round(sortedStudents.reduce((s, r) => s + r.attendance.rate, 0) / sortedStudents.length)}%`
                  : '—'}
                color="#16a34a" bg="#f0fdf4" />
            </div>
          )}

          {/* Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1a2f5e, #2a4a8e)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>{(RELIGION_COLORS[selectedReligion] || RELIGION_COLORS.Other).icon}</span>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
                {selectedReligion} Students
                {filterDenom && <span style={{ marginLeft: 8, fontSize: '0.72rem', opacity: 0.7 }}>· {filterDenom}</span>}
              </span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{sortedStudents.length} records</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: '#1a2f5e' }}>
                    {[
                      { label: '#', field: 'sno', w: 36 },
                      { label: 'Student ID', field: 'studentId', w: 85 },
                      { label: 'Name', field: 'name', w: null },
                      { label: 'Grade', field: 'grade', w: 55 },
                      { label: 'Category', field: 'category', w: 80 },
                      { label: 'Gender', field: 'gender', w: 65 },
                      ...(selectedReligion === 'Christian' ? [{ label: 'Denomination', field: 'christianDenomination', w: 100 }] : []),
                      { label: 'Village', field: 'village', w: 100 },
                      { label: 'Contact', field: 'contactNumber', w: 95 },
                      { label: 'Class', field: 'classAssigned', w: 110 },
                      { label: 'Present', field: 'attendance', w: 58 },
                      { label: 'Rate', field: 'rate', w: 70 },
                    ].map(col => (
                      <th key={col.field}
                        onClick={() => handleSort(col.field)}
                        style={{
                          padding: '9px 8px',
                          textAlign: col.field === 'sno' || col.field === 'attendance' || col.field === 'rate' ? 'center' : 'left',
                          fontSize: '0.62rem', fontWeight: 700, color: 'white',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          width: col.w || undefined, whiteSpace: 'nowrap',
                          cursor: 'pointer', userSelect: 'none',
                          borderRight: '1px solid rgba(255,255,255,0.08)',
                        }}>
                        {col.label} <SortIcon field={col.field} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, idx) => {
                    const cc = CAT_COLORS[s.category] || CAT_COLORS.Beginner;
                    return (
                      <tr key={s.sno} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f0f4f8' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af' }}>{s.sno}</td>
                        <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#1a2f5e', fontWeight: 600 }}>{s.studentId}</td>
                        <td style={{ padding: '8px 8px', fontWeight: 600, fontSize: '0.845rem' }}>
                          {s.name}
                          {s.village && <div style={{ fontSize: '0.67rem', color: '#9ca3af', marginTop: 1 }}>{s.village}</div>}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '0.8rem', color: '#4b5563' }}>{s.grade}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 99, background: cc.bg, color: cc.color, fontWeight: 700 }}>{s.category}</span>
                        </td>
                        <td style={{ padding: '8px 6px', fontSize: '0.78rem', color: '#6b7280', textTransform: 'capitalize' }}>{s.gender}</td>
                        {selectedReligion === 'Christian' && (
                          <td style={{ padding: '8px 8px', fontSize: '0.78rem', color: '#4b5563' }}>
                            {s.christianDenomination
                              ? <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 }}>{s.christianDenomination}</span>
                              : <span style={{ color: '#d1d5db', fontSize: '0.72rem' }}>—</span>}
                          </td>
                        )}
                        <td style={{ padding: '8px 8px', fontSize: '0.78rem', color: '#6b7280' }}>{s.village || '—'}</td>
                        <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#4b5563' }}>{s.contactNumber || '—'}</td>
                        <td style={{ padding: '8px 8px', fontSize: '0.78rem' }}>
                          {s.classAssigned !== 'Unassigned'
                            ? <span style={{ background: '#e0e7ff', color: '#1a2f5e', padding: '1px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 }}>{s.classAssigned}</span>
                            : <span style={{ color: '#d1d5db', fontSize: '0.72rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <span style={{ color: '#15803d', fontWeight: 800, fontSize: '0.845rem' }}>{s.attendance.present}</span>
                          <span style={{ color: '#9ca3af', fontSize: '0.68rem' }}>/{s.attendance.total}</span>
                        </td>
                        <td style={{ padding: '8px 8px' }}>
                          <RateBar rate={s.attendance.rate} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedStudents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: '0.875rem' }}>
                No students found{filterDenom ? ` for denomination: ${filterDenom}` : ''}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function ExtraReportsPage() {
  const { vbsYear, activeYear } = useActiveYear();
  const [activeTab, setActiveTab] = useState('attendance');

  if (!vbsYear) {
    return (
      <div className="empty-state">
        <Calendar size={36} style={{ color: 'var(--color-text-muted)' }} />
        <h3>No VBS Year Selected</h3>
        <p>Use the year selector in the top bar to choose a year.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'attendance', label: '📋 Attendance Grid', desc: 'Category-wise student attendance by day' },
    { id: 'religion', label: '🕊️ Religion-wise', desc: 'Students grouped by religion & denomination' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Extra Reports</h1>
          <p className="page-subtitle">
            Advanced attendance & demographic reports ·{' '}
            <strong>{activeYear?.vbsTitle || `VBS ${vbsYear}`}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
          <Calendar size={14} /> VBS {vbsYear}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, background: 'var(--color-bg)', borderRadius: 14, padding: 5, border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '10px 18px', borderRadius: 10, border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: active ? 'white' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}>
              <span style={{ fontWeight: 700, fontSize: '0.845rem', color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                {tab.label}
              </span>
              <span style={{ fontSize: '0.67rem', color: active ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', marginTop: 1 }}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'attendance' && <StudentAttendanceReport vbsYear={vbsYear} />}
      {activeTab === 'religion' && <ReligionReport vbsYear={vbsYear} />}
    </div>
  );
}
