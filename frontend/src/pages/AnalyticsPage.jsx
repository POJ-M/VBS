import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { Calendar, TrendingUp, Users, BarChart2 } from 'lucide-react';
import { analyticsAPI } from '../services/api';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage, CategoryBadge } from '../components/common';

/* ─── Helpers ────────────────────────────────────────────────────── */
const CATEGORY_COLORS = { Beginner: '#8b5cf6', Primary: '#3b82f6', Junior: '#10b981', Inter: '#f59e0b' };
const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6' };
const RELIGION_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

/**
 * Safely formats a date value (ISO string, Date, timestamp) to a locale display string.
 * Returns '—' for invalid/null/undefined dates.
 */
const safeFormatDate = (dateVal) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    // Check for Invalid Date
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

function ChartCard({ title, children, height = 280 }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="card-body" style={{ padding: '16px 12px' }}>
        <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
    </div>
  );
}

/* ─── No Year Guard ──────────────────────────────────────────────── */
function NoYearState() {
  return (
    <div className="empty-state">
      <Calendar size={36} style={{ color: 'var(--color-text-muted)' }} />
      <h3>No VBS Year Selected</h3>
      <p>Use the year selector in the top bar to view analytics for a specific year.</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { vbsYear, activeYear } = useActiveYear();

  const { data: studentData, isLoading: loadingStudents } = useQuery({
    queryKey: ['student-analytics', vbsYear],
    queryFn: () => analyticsAPI.getStudentAnalytics({ vbsYear }),
    select: d => d.data?.data,
    enabled: !!vbsYear,
  });

  const { data: trendsData, isLoading: loadingTrends } = useQuery({
    queryKey: ['attendance-trends', vbsYear],
    queryFn: () => analyticsAPI.getAttendanceTrends({ vbsYear }),
    select: d => d.data?.data,
    enabled: !!vbsYear,
  });

  const { data: modsData } = useQuery({
    queryKey: ['modifications', vbsYear],
    queryFn: () => analyticsAPI.getModifications({ vbsYear }),
    select: d => d.data?.data,
    enabled: !!vbsYear,
  });

  if (!vbsYear) return <NoYearState />;
  if (loadingStudents || loadingTrends) return <LoadingPage />;

  // ── Data transforms ────────────────────────────────────────────
  const gradeData = (studentData?.gradeDistribution || []).map(g => ({ grade: g._id, count: g.count }));
  const categoryData = (studentData?.categoryDistribution || []).map(c => ({ name: c._id, value: c.count }));
  const genderData = (studentData?.genderDistribution || []).map(g => ({ name: g._id, value: g.count }));
  const religionData = (studentData?.religionDistribution || []).map(r => ({ name: r._id, value: r.count }));
  const villageData = (studentData?.villageDistribution || []).slice(0, 10);
  const denomData = (studentData?.denominationDistribution || []);

  // ── Student Trends — safe date formatting ─────────────────────
  const studentTrends = (trendsData?.studentTrends || [])
    .filter(t => t.date && !isNaN(new Date(t.date).getTime())) // skip invalid dates
    .map(t => ({
      date: safeFormatDate(t.date),
      'Rate (%)': Math.round(t.rate || 0),
      Present: t.present,
      Absent: t.absent,
    }))
    .filter(t => t.date !== '—'); // extra guard

  // ── Teacher Trends — safe date formatting (was the buggy one) ─
  const teacherTrends = (trendsData?.teacherTrends || [])
    .filter(t => {
      // The _id field from MongoDB aggregation may be a Date object or ISO string
      const dateVal = t._id || t.date;
      if (!dateVal) return false;
      const parsed = new Date(dateVal);
      return !isNaN(parsed.getTime());
    })
    .map(t => {
      const dateVal = t._id || t.date;
      return {
        date: safeFormatDate(dateVal),
        Present: t.present || 0,
        Absent: t.absent || 0,
        Late: t.late || 0,
      };
    })
    .filter(t => t.date !== '—'); // skip any that still failed

  const classPerf = (trendsData?.classPerformance || []).map(c => ({
    class: c.className,
    rate: Math.round(c.attendanceRate || 0),
    category: c.category,
  }));

  const avgRate = studentTrends.length
    ? Math.round(studentTrends.reduce((s, t) => s + (t['Rate (%)'] || 0), 0) / studentTrends.length)
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Insights</h1>
          <p className="page-subtitle">
            {activeYear?.vbsTitle || `VBS ${vbsYear}`} — Visual overview of program data
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
          <Calendar size={14} /> VBS {vbsYear}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatBadge label="Total Students" value={studentData?.totalStudents || 0} color="#3b82f6" />
        <StatBadge label="Avg Attendance Rate" value={`${avgRate}%`} color="#10b981" />
        <StatBadge label="Records Modified" value={modsData?.totalModifications || 0} color="#f59e0b" />
        <StatBadge label="Modified Records" value={modsData?.totalModifiedRecords || 0} color="#8b5cf6" />
      </div>

      {/* Row 1: Category + Gender */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <ChartCard title="📊 Category Distribution">
          <PieChart>
            <Pie data={categoryData} cx="50%" cy="50%" outerRadius={95} dataKey="value"
              label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
              {categoryData.map(e => <Cell key={e.name} fill={CATEGORY_COLORS[e.name] || '#94a3b8'} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>

        <ChartCard title="👫 Gender Distribution">
          <PieChart>
            <Pie data={genderData} cx="50%" cy="50%" outerRadius={95} dataKey="value"
              label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
              {genderData.map(e => <Cell key={e.name} fill={GENDER_COLORS[e.name] || '#94a3b8'} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>
      </div>

      {/* Row 2: Religion + Denomination */}
      {(religionData.length > 0 || denomData.length > 0) && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {religionData.length > 0 && (
            <ChartCard title="🕊️ Religion Distribution">
              <PieChart>
                <Pie data={religionData} cx="50%" cy="50%" outerRadius={95} dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {religionData.map((e, i) => <Cell key={e.name} fill={RELIGION_COLORS[i % RELIGION_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartCard>
          )}
          {denomData.length > 0 && (
            <ChartCard title="⛪ Christian Denomination Breakdown">
              <BarChart data={denomData.map(d => ({ name: d._id, count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [v, 'Students']} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          )}
        </div>
      )}

      {/* Student Attendance Trend */}
      {studentTrends.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <ChartCard title={`📈 Student Attendance Rate — VBS ${vbsYear}`} height={240}>
            <LineChart data={studentTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={v => [`${v}%`]} />
              <Line type="monotone" dataKey="Rate (%)" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ChartCard>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20, padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          📈 No student attendance data available for VBS {vbsYear} yet.
        </div>
      )}

      {/* Teacher Attendance Trend — fixed invalid date */}
      {teacherTrends.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <ChartCard title="👩‍🏫 Teacher Attendance Trend" height={220}>
            <BarChart data={teacherTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20, padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          👩‍🏫 No teacher attendance data available for VBS {vbsYear} yet.
        </div>
      )}

      {/* Class Performance */}
      {classPerf.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard title="🏆 Class Performance Comparison" height={240}>
            <BarChart data={classPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={v => [`${v}%`, 'Attendance Rate']} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {classPerf.map((e, i) => (
                  <Cell key={i} fill={e.rate >= 80 ? '#10b981' : e.rate >= 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      )}

      {/* Grade Distribution */}
      {gradeData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard title="📚 Grade Distribution" height={220}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [v, 'Students']} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}

      {/* Village Distribution */}
      {villageData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">📍 Top Villages by Participation</span></div>
            <div className="card-body" style={{ padding: '16px 12px' }}>
              <ResponsiveContainer width="100%" height={villageData.length > 5 ? 300 : 200}>
                <BarChart data={villageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="_id" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={v => [v, 'Students']} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Modifications Summary */}
      {(modsData?.adminModifications || []).length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔧 Attendance Modifications by Admin</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Admin Name</th><th>Modifications Made</th></tr></thead>
              <tbody>
                {modsData.adminModifications.map(a => (
                  <tr key={a.name}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td><span className="badge badge-orange">{a.count} changes</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when no data */}
      {!studentData?.totalStudents && !studentTrends.length && !teacherTrends.length && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <BarChart2 size={36} style={{ color: 'var(--color-text-muted)' }} />
          <h3>No Data for VBS {vbsYear}</h3>
          <p>Add students, mark attendance, and return here to see analytics.</p>
        </div>
      )}
    </div>
  );
}
