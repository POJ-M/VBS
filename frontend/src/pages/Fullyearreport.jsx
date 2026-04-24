// FullYearReport.jsx  — drop-in replacement for the FullYearReport function in ReportsPage.jsx
// Place this as a named export and import it into ReportsPage.jsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download, Calendar, ChevronDown, ChevronUp, Users, GraduationCap, Heart, BookOpen } from 'lucide-react';
import { reportsAPI } from '../services/api';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage, Alert } from '../components/common';

/* ─── shared helpers ──────────────────────────────────────────────── */
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric'
}) : '—';

const RateBar = ({ rate = 0 }) => {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 50, height: 5, background: '#e2e8f0', borderRadius: 99 }}>
        <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', borderRadius: 99, background: color }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.8rem', color }}>{rate}%</span>
    </div>
  );
};

/* ─── PDF BUILDER ─────────────────────────────────────────────────── */
const buildFullYearPDF = (data, sections) => {
  const {
    ministry, vbsTitle, tagline, vbsYear, settings,
    summary, vbsDates, classes, teachers, volunteers, allStudents, generatedAt,
  } = data;
  
const headHtml = (title) => `
  <div class="hdr">
    <div class="hdr-top">
      <img class="logo" src="/poj-logo.png" alt="POJ Ministry" onerror="this.style.display='none'" />
      <div class="hdr-text">
        <div class="church">Presence of Jesus Ministry</div>
        <div class="vbs">${vbsTitle} — VBS ${vbsYear}</div>
        ${tagline ? `<div class="tagline">"${tagline}"</div>` : ''}
      </div>
    </div>
    <div class="hdr-divider"></div>
    <div class="rpt-title">${title}</div>
    <div class="dates">${fmtDate(settings?.dates?.startDate)} — ${fmtDate(settings?.dates?.endDate)} · ${vbsDates.length} Days</div>
  </div>`;

  const css = `
    @page { margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #111; }
    .hdr { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 3px solid #1a2f5e; }
    .hdr-top { display: flex; align-items: center; gap: 12px; margin-bottom: 5px; }
    .logo { width: 46px; height: 46px; object-fit: contain; flex-shrink: 0; border-radius: 6px; }
    .hdr-text { display: flex; flex-direction: column; }
    .church { font-size: 14pt; font-weight: 800; color: #1a2f5e; line-height: 1.2; }
    .vbs { font-size: 10pt; font-weight: 700; color: #c8922a; margin-top: 2px; }
    .tagline { font-size: 7.5pt; color: #555; font-style: italic; }
    .hdr-divider { height: 1px; background: #e2e8f0; margin: 5px 0; }
    .rpt-title { font-size: 9pt; font-weight: 700; color: #1a2f5e; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
    .dates { font-size: 7.5pt; color: #666; margin-top: 2px; }
    .section-hdr { background: #1a2f5e; color: white; padding: 5px 10px; font-weight: 800; font-size: 9pt; margin: 12px 0 6px; border-radius: 4px; }
    .sub-hdr { background: #e8edf6; color: #1a2f5e; padding: 4px 10px; font-weight: 700; font-size: 8pt; margin: 8px 0 4px; border-radius: 3px; border-left: 3px solid #1a2f5e; }
    .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 8px 0 12px; }
    .s-card { border: 1px solid #dde2ea; border-radius: 5px; padding: 7px 10px; text-align: center; }
    .s-card .n { font-size: 16pt; font-weight: 900; color: #1a2f5e; line-height: 1; }
    .s-card .l { font-size: 6.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th { background: #1a2f5e; color: white; padding: 4px 6px; text-align: left; font-size: 7.5pt; font-weight: 700; }
    td { padding: 3.5px 6px; border-bottom: 1px solid #e8edf2; font-size: 8pt; }
    tr:nth-child(even) td { background: #f9fafb; }
    .p { color: #15803d; font-weight: 700; }
    .a { color: #b91c1c; font-weight: 700; }
    .l-s { color: #d97706; font-weight: 700; }
    .rate-hi { color: #15803d; font-weight: 800; }
    .rate-mid { color: #d97706; font-weight: 800; }
    .rate-lo { color: #b91c1c; font-weight: 800; }
    .cat { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 7pt; font-weight: 700; }
    .cat-B { background: #ede9fe; color: #5b21b6; }
    .cat-P { background: #dbeafe; color: #1d4ed8; }
    .cat-J { background: #dcfce7; color: #065f46; }
    .cat-I { background: #fef9c3; color: #a16207; }
    .page-break { page-break-before: always; }
    .ftr { margin-top: 10px; font-size: 7pt; color: #888; border-top: 1px solid #ddd; padding-top: 6px; display: flex; justify-content: space-between; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  `;

  const rateClass = r => r >= 80 ? 'rate-hi' : r >= 60 ? 'rate-mid' : 'rate-lo';
  const catClass = c => ({ Beginner: 'cat-B', Primary: 'cat-P', Junior: 'cat-J', Inter: 'cat-I' }[c] || '');

  let body = '';

  // ── 1. OVERVIEW SUMMARY ─────────────────────────────────────────
  body += `<div class="section-hdr">📊 VBS ${vbsYear} Overview</div>`;
  body += `<div class="summary-grid">
    <div class="s-card"><div class="n">${summary.totalStudents}</div><div class="l">Students</div></div>
    <div class="s-card"><div class="n">${summary.totalTeachers}</div><div class="l">Teachers</div></div>
    <div class="s-card"><div class="n">${summary.totalVolunteers}</div><div class="l">Volunteers</div></div>
    <div class="s-card"><div class="n">${summary.totalClasses}</div><div class="l">Classes</div></div>
    <div class="s-card"><div class="n">${summary.vbsDuration}</div><div class="l">VBS Days</div></div>
    <div class="s-card"><div class="n" style="color:${summary.attendance.students.rate>=80?'#16a34a':summary.attendance.students.rate>=60?'#d97706':'#dc2626'}">${summary.attendance.students.rate}%</div><div class="l">Avg Attendance</div></div>
  </div>`;

  body += `<table>
    <thead><tr><th>Type</th><th>Total Records</th><th>Present/Attended</th><th>Rate</th></tr></thead>
    <tbody>
      <tr><td>Student Attendance</td><td>${summary.attendance.students.total}</td><td class="p">${summary.attendance.students.present}</td><td class="${rateClass(summary.attendance.students.rate)}">${summary.attendance.students.rate}%</td></tr>
      <tr><td>Teacher Attendance</td><td>${summary.attendance.teachers.total}</td><td class="p">${summary.attendance.teachers.present}</td><td class="${rateClass(summary.attendance.teachers.rate)}">${summary.attendance.teachers.rate}%</td></tr>
      <tr><td>Volunteer Attendance</td><td>${summary.attendance.volunteers.total}</td><td class="p">${summary.attendance.volunteers.present}</td><td class="${rateClass(summary.attendance.volunteers.rate)}">${summary.attendance.volunteers.rate}%</td></tr>
    </tbody>
  </table>`;

  // ── 2. STUDENT NAME LIST ────────────────────────────────────────
  if (sections.studentList) {
    body += `<div class="page-break"></div>`;
    body += `<div class="section-hdr">👨‍🎓 Complete Student List</div>`;
    body += `<table>
      <thead><tr>
        <th style="width:24px">S.No</th>
        <th style="width:65px">Student ID</th>
        <th style="width:130px">Name</th>
        <th style="width:38px">Grade</th>
        <th style="width:22px">Sex</th>
        <th style="width:100px">Class</th>
        <th style="width:65px">Category</th>
        <th style="width:80px">Contact</th>
        <th style="width:110px">Parent</th>
        <th style="width:90px">Village</th>
      </tr></thead>
      <tbody>
        ${allStudents.map(s => `<tr>
          <td>${s.sno}</td>
          <td style="font-family:monospace;font-size:7.5pt">${s.studentId || '—'}</td>
          <td>${s.name}</td>
          <td>${s.grade}</td>
          <td>${s.gender === 'male' ? 'M' : s.gender === 'female' ? 'F' : 'O'}</td>
          <td>${s.classAssigned || '—'}</td>
          <td><span class="cat ${catClass(s.category)}">${s.category}</span></td>
          <td style="font-family:monospace;font-size:7.5pt">${s.contactNumber || '—'}</td>
          <td>${s.parentName || '—'}</td>
          <td>${s.village || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  // ── 3. CLASS-WISE ATTENDANCE ────────────────────────────────────
  if (sections.classAttendance) {
    const maxDayCols = 15; // max date columns per page to avoid overflow

    classes.forEach(cls => {
      body += `<div class="page-break"></div>`;
      body += `<div class="section-hdr">📚 Class: ${cls.className} <span style="font-weight:400;font-size:8pt">(${cls.category}) · Teacher: ${cls.teacher?.name || 'Unassigned'} · ${cls.studentCount} Students · Rate: ${cls.stats.attendanceRate}%</span></div>`;

      if (cls.students.length === 0) {
        body += `<p style="color:#888;font-size:8pt;padding:8px 0">No students in this class.</p>`;
        return;
      }

      // Split dates into chunks if too many
      const dateChunks = [];
      for (let i = 0; i < vbsDates.length; i += maxDayCols) {
        dateChunks.push(vbsDates.slice(i, i + maxDayCols));
      }

      dateChunks.forEach((chunk, ci) => {
        if (ci > 0) body += `<div style="margin-top:6px"></div>`;
        body += `<table>
          <thead><tr>
            <th style="width:22px">S.No</th>
            <th style="width:130px">Name</th>
            <th style="width:36px">Grade</th>
            ${chunk.map((d, i) => `<th style="width:28px;text-align:center">D${vbsDates.indexOf(d) + 1}<br><span style="font-size:6pt;font-weight:400">${d.dateStr.slice(0, 5)}</span></th>`).join('')}
            <th style="width:32px;text-align:center">Total</th>
            <th style="width:32px;text-align:center">%</th>
          </tr></thead>
          <tbody>
            ${cls.students.map((s, idx) => {
              const dayCells = chunk.map(d =>
                `<td style="text-align:center;font-size:8pt;font-weight:700;color:${s.attendance[d.dateStr] === 'present' ? '#16a34a' : s.attendance[d.dateStr] === 'absent' ? '#dc2626' : '#ccc'}">${s.attendance[d.dateStr] === 'present' ? '✓' : s.attendance[d.dateStr] === 'absent' ? '✗' : ''}</td>`
              ).join('');
              const rClass = rateClass(s.percentage);
              return `<tr>
                <td>${s.sno}</td>
                <td>${s.name}</td>
                <td>${s.grade}</td>
                ${dayCells}
                <td style="text-align:center;font-weight:700">${s.totalPresent}</td>
                <td style="text-align:center" class="${rClass}">${s.percentage}%</td>
              </tr>`;
            }).join('')}
            <tr style="background:#e8edf6;font-weight:700">
              <td colspan="3" style="text-align:right;padding-right:8px">Total Present →</td>
              ${chunk.map(d => {
                const cnt = cls.students.filter(s => s.attendance[d.dateStr] === 'present').length;
                return `<td style="text-align:center;color:#16a34a;font-weight:800">${cnt}</td>`;
              }).join('')}
              <td style="text-align:center;color:#1a2f5e">${cls.stats.totalPresent}</td>
              <td style="text-align:center" class="${rateClass(cls.stats.attendanceRate)}">${cls.stats.attendanceRate}%</td>
            </tr>
          </tbody>
        </table>`;
      });
    });
  }

  // ── 4. TEACHER RECORDS ──────────────────────────────────────────
  if (sections.teacherRecords) {
    body += `<div class="page-break"></div>`;
    body += `<div class="section-hdr">👩‍🏫 Teacher Records & Attendance</div>`;
    body += `<table>
      <thead><tr>
        <th>Name</th>
        <th>Contact</th>
        <th>Class Assigned</th>
        <th>Category</th>
        <th>Present</th>
        <th>Late</th>
        <th>Absent</th>
        <th>Att. Rate</th>
        <th>Days Submitted</th>
        <th>Submission Rate</th>
      </tr></thead>
      <tbody>
        ${teachers.map(t => `<tr>
          <td style="font-weight:600">${t.name}</td>
          <td style="font-family:monospace;font-size:7.5pt">${t.contactNumber || '—'}</td>
          <td>${t.classAssigned}</td>
          <td><span class="cat ${catClass(t.classCategory)}">${t.classCategory}</span></td>
          <td class="p">${t.attendance.daysPresent}</td>
          <td class="l-s">${t.attendance.daysLate}</td>
          <td class="a">${t.attendance.daysAbsent}</td>
          <td class="${rateClass(t.attendance.attendanceRate)}">${t.attendance.attendanceRate}%</td>
          <td>${t.submissions.daysSubmitted}/${t.submissions.totalDays}</td>
          <td class="${rateClass(t.submissions.submissionRate)}">${t.submissions.submissionRate}%</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

    // Per-teacher daily attendance grid
    if (sections.teacherDailyGrid && vbsDates.length > 0) {
      body += `<div class="sub-hdr">Teacher Daily Attendance Grid</div>`;
      const maxCols = 20;
      const dateChunks = [];
      for (let i = 0; i < vbsDates.length; i += maxCols) dateChunks.push(vbsDates.slice(i, i + maxCols));

      dateChunks.forEach((chunk, ci) => {
        if (ci > 0) body += `<div style="margin-top:6px"></div>`;
        body += `<table>
          <thead><tr>
            <th style="width:140px">Teacher</th>
            ${chunk.map((d, i) => `<th style="width:26px;text-align:center">D${vbsDates.indexOf(d) + 1}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${teachers.map(t => `<tr>
              <td style="font-weight:600">${t.name}</td>
              ${chunk.map(d => {
                const s = t.attendance.history.find(h => h.dateStr === d.dateStr)?.status || '';
                const color = s === 'present' ? '#16a34a' : s === 'late' ? '#d97706' : s === 'absent' ? '#dc2626' : '#ccc';
                const sym = s === 'present' ? '✓' : s === 'late' ? 'L' : s === 'absent' ? '✗' : '';
                return `<td style="text-align:center;font-weight:700;color:${color}">${sym}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>`;
      });
    }
  }

  // ── 5. VOLUNTEER RECORDS ────────────────────────────────────────
  if (sections.volunteerRecords) {
    body += `<div class="page-break"></div>`;
    body += `<div class="section-hdr">🙋 Volunteer Records & Attendance</div>`;
    body += `<table>
      <thead><tr>
        <th>Name</th>
        <th>Role</th>
        <th>Shift</th>
        <th>Contact</th>
        <th>Present / Half Day</th>
        <th>Absent</th>
        <th>Attendance Rate</th>
      </tr></thead>
      <tbody>
        ${volunteers.map(v => `<tr>
          <td style="font-weight:600">${v.name}</td>
          <td>${v.role}</td>
          <td>${v.shift || '—'}</td>
          <td style="font-family:monospace;font-size:7.5pt">${v.contactNumber || '—'}</td>
          <td class="p">${v.attendance.daysPresent} / ${v.attendance.daysHalfDay}</td>
          <td class="a">${v.attendance.daysAbsent}</td>
          <td class="${rateClass(v.attendance.attendanceRate)}">${v.attendance.attendanceRate}%</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

    // Per-volunteer daily grid
    if (sections.volunteerDailyGrid && vbsDates.length > 0 && volunteers.length > 0) {
      body += `<div class="sub-hdr">Volunteer Daily Attendance Grid</div>`;
      const maxCols = 20;
      const dateChunks = [];
      for (let i = 0; i < vbsDates.length; i += maxCols) dateChunks.push(vbsDates.slice(i, i + maxCols));

      dateChunks.forEach((chunk) => {
        body += `<table>
          <thead><tr>
            <th style="width:130px">Volunteer</th>
            <th style="width:80px">Role</th>
            ${chunk.map((d, i) => `<th style="width:26px;text-align:center">D${vbsDates.indexOf(d) + 1}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${volunteers.map(v => `<tr>
              <td style="font-weight:600">${v.name}</td>
              <td style="font-size:7.5pt">${v.role}</td>
              ${chunk.map(d => {
                const s = v.attendance.history.find(h => h.dateStr === d.dateStr)?.status || '';
                const color = ['present', 'halfDay'].includes(s) ? '#16a34a' : s === 'absent' ? '#dc2626' : '#ccc';
                const sym = s === 'present' ? '✓' : s === 'halfDay' ? '½' : s === 'absent' ? '✗' : '';
                return `<td style="text-align:center;font-weight:700;color:${color}">${sym}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>`;
      });
    }
  }

  // ── FOOTER ──────────────────────────────────────────────────────
  body += `<div class="ftr">
    <span>Presence of Jesus Ministry — VBS Management System</span>
    <span>Generated: ${generatedAt} IST</span>
  </div>`;

  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Full Year Report — VBS ${vbsYear}</title>
    <style>${css}</style>
  </head><body>${headHtml(`Full Year Report — VBS ${vbsYear}`)}${body}</body></html>`;
};

/* ─── Section toggle ──────────────────────────────────────────────── */
const SectionToggle = ({ id, label, checked, onChange }) => (
  <label style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', border: `1.5px solid ${checked ? '#1a2f5e' : '#e2e8f0'}`,
    borderRadius: 8, cursor: 'pointer', background: checked ? 'rgba(26,47,94,0.06)' : 'white',
    fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s', userSelect: 'none',
  }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(id, e.target.checked)}
      style={{ accentColor: '#1a2f5e', width: 15, height: 15, cursor: 'pointer' }} />
    {label}
  </label>
);

const StatPill = ({ label, value, color }) => (
  <div style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', textAlign: 'center', minWidth: 90 }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || '#1a2f5e', lineHeight: 1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginTop: 4 }}>{label}</div>
  </div>
);

/* ─── Main Component ──────────────────────────────────────────────── */
export function FullYearReport({ vbsYear, allYears }) {
  const { activeYear } = useActiveYear();
  const [generating, setGenerating] = useState(false);
  const [expandClass, setExpandClass] = useState(null);
  const [sections, setSections] = useState({
    studentList: true,
    classAttendance: true,
    teacherRecords: true,
    teacherDailyGrid: true,
    volunteerRecords: true,
    volunteerDailyGrid: false,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-full-year', vbsYear],
    queryFn: () => reportsAPI.getFullYear({ vbsYear }),
    enabled: !!vbsYear,
    select: d => d.data?.data,
  });

  const toggleSection = (id, val) => setSections(s => ({ ...s, [id]: val }));

  const handlePrint = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const html = buildFullYearPDF(data, sections);
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.focus(); win.print(); setGenerating(false); }, 600);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  if (isLoading) return <LoadingPage />;
  if (error || !data) return <Alert type="warning">No data found for VBS {vbsYear}.</Alert>;

  const { summary, settings, vbsDates = [], classes = [], teachers = [], volunteers = [], allStudents = [] } = data;
  const att = summary?.attendance;

  return (
    <div>
      {/* Header card */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{settings?.vbsTitle || `VBS ${vbsYear}`}</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 3 }}>
              {fmtDate(settings?.dates?.startDate)} — {fmtDate(settings?.dates?.endDate)} · {vbsDates.length} days
            </div>
          </div>
          <button className="btn btn-primary" onClick={handlePrint} disabled={generating} style={{ gap: 8 }}>
            {generating
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
              : <><Printer size={15} /> Export Full Report (PDF)</>}
          </button>
        </div>
      </div>

      {/* Section selector */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 10 }}>
          Select Sections to Include in PDF
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SectionToggle id="studentList"       label="👨‍🎓 Student Name List"         checked={sections.studentList}       onChange={toggleSection} />
          <SectionToggle id="classAttendance"   label="📚 Class-wise Attendance"      checked={sections.classAttendance}   onChange={toggleSection} />
          <SectionToggle id="teacherRecords"    label="👩‍🏫 Teacher Records"            checked={sections.teacherRecords}    onChange={toggleSection} />
          <SectionToggle id="teacherDailyGrid"  label="📅 Teacher Daily Grid"         checked={sections.teacherDailyGrid}  onChange={toggleSection} />
          <SectionToggle id="volunteerRecords"  label="🙋 Volunteer Records"           checked={sections.volunteerRecords}  onChange={toggleSection} />
          <SectionToggle id="volunteerDailyGrid" label="📅 Volunteer Daily Grid"      checked={sections.volunteerDailyGrid} onChange={toggleSection} />
        </div>
      </div>

      {/* Overview stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatPill label="Students"     value={summary.totalStudents}   color="#3b82f6" />
        <StatPill label="Teachers"     value={summary.totalTeachers}   color="#8b5cf6" />
        <StatPill label="Volunteers"   value={summary.totalVolunteers} color="#10b981" />
        <StatPill label="Classes"      value={summary.totalClasses}    color="#f59e0b" />
        <StatPill label="VBS Days"     value={vbsDates.length}         color="#1a2f5e" />
        <StatPill label="Student Rate" value={`${att?.students?.rate ?? 0}%`} color={att?.students?.rate >= 80 ? '#16a34a' : '#d97706'} />
        <StatPill label="Teacher Rate" value={`${att?.teachers?.rate ?? 0}%`} color={att?.teachers?.rate >= 80 ? '#16a34a' : '#d97706'} />
        <StatPill label="Modified Records" value={summary.modifications} color="#f59e0b" />
      </div>

      {/* ── Class Summaries ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">📚 Class-wise Summary ({classes.length} Classes)</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Class</th><th>Category</th><th>Teacher</th>
                <th style={{ textAlign: 'center' }}>Students</th>
                <th style={{ textAlign: 'center' }}>Total Present</th>
                <th>Attendance Rate</th>
                <th style={{ width: 80 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => (
                <React.Fragment key={cls.classId}>
                  <tr>
                    <td style={{ fontWeight: 700 }}>{cls.className}</td>
                    <td><span className={`badge cat-${cls.category}`}>{cls.category}</span></td>
                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{cls.teacher?.name || <span style={{ color: '#9ca3af' }}>Unassigned</span>}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{cls.studentCount}</td>
                    <td style={{ textAlign: 'center' }}><span style={{ color: '#16a34a', fontWeight: 700 }}>{cls.stats.totalPresent}</span></td>
                    <td><RateBar rate={cls.stats.attendanceRate} /></td>
                    <td>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => setExpandClass(expandClass === cls.classId ? null : cls.classId)}
                        style={{ fontSize: '0.72rem', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {expandClass === cls.classId ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expandClass === cls.classId ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {expandClass === cls.classId && (
                    <tr>
                      <td colSpan={7} style={{ padding: '12px 16px', background: '#f8fafd' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, color: '#1a2f5e' }}>
                          Students in {cls.className}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ minWidth: 600 }}>
                            <thead>
                              <tr>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e' }}>S.No</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e' }}>ID</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e' }}>Name</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e' }}>Grade</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e', textAlign: 'center' }}>Present</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e', textAlign: 'center' }}>Total</th>
                                <th style={{ background: '#e8edf6', color: '#1a2f5e' }}>Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cls.students.map(s => (
                                <tr key={s.studentId}>
                                  <td style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{s.sno}</td>
                                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{s.studentId || '—'}</span></td>
                                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                                  <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{s.grade}</td>
                                  <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{s.totalPresent}</td>
                                  <td style={{ textAlign: 'center', color: '#6b7280' }}>{s.totalDays}</td>
                                  <td><RateBar rate={s.percentage} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Teacher Summary ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">👩‍🏫 Teacher Summary ({teachers.length} Teachers)</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Teacher</th><th>Class</th>
                <th style={{ textAlign: 'center' }}>Present</th>
                <th style={{ textAlign: 'center' }}>Late</th>
                <th style={{ textAlign: 'center' }}>Absent</th>
                <th>Att. Rate</th>
                <th>Submission Rate</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{t.classAssigned}</span>
                    {t.classCategory && <span className={`badge cat-${t.classCategory}`} style={{ marginLeft: 6, fontSize: '0.65rem' }}>{t.classCategory}</span>}
                  </td>
                  <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{t.attendance.daysPresent}</td>
                  <td style={{ textAlign: 'center', color: '#d97706', fontWeight: 700 }}>{t.attendance.daysLate}</td>
                  <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{t.attendance.daysAbsent}</td>
                  <td><RateBar rate={t.attendance.attendanceRate} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RateBar rate={t.submissions.submissionRate} />
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({t.submissions.daysSubmitted}/{t.submissions.totalDays})</span>
                    </div>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: '0.85rem' }}>No teacher attendance recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Volunteer Summary ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">🙋 Volunteer Summary ({volunteers.length} Volunteers)</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Volunteer</th><th>Role</th><th>Shift</th>
                <th style={{ textAlign: 'center' }}>Present</th>
                <th style={{ textAlign: 'center' }}>Half Day</th>
                <th style={{ textAlign: 'center' }}>Absent</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td><span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>{v.role}</span></td>
                  <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{v.shift || '—'}</td>
                  <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{v.attendance.daysPresent}</td>
                  <td style={{ textAlign: 'center', color: '#ea580c', fontWeight: 700 }}>{v.attendance.daysHalfDay}</td>
                  <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{v.attendance.daysAbsent}</td>
                  <td><RateBar rate={v.attendance.attendanceRate} /></td>
                </tr>
              ))}
              {volunteers.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: '0.85rem' }}>No volunteer records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Year-over-year comparison */}
      {allYears?.length > 1 && (
        <div className="card">
          <div className="card-header"><span className="card-title">📊 Year-over-Year Comparison</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>VBS Year</th><th>Title</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                {allYears.map(y => (
                  <tr key={y._id} style={{ background: y.year === vbsYear ? 'rgba(26,47,94,0.04)' : undefined }}>
                    <td style={{ fontWeight: y.year === vbsYear ? 700 : 400 }}>{y.year}</td>
                    <td>{y.vbsTitle || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{fmtDate(y.dates?.startDate)}</td>
                    <td style={{ fontSize: '0.82rem' }}>{fmtDate(y.dates?.endDate)}</td>
                    <td>
                      {y.isActive
                        ? <span className="badge badge-green">LIVE</span>
                        : y.year === vbsYear
                        ? <span className="badge badge-navy">Viewing</span>
                        : <span className="badge badge-gray">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
