import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Users, GraduationCap, Heart } from 'lucide-react';
import { studentsAPI, teachersAPI, volunteersAPI } from '../services/api';
import { LoadingPage, EmptyState, CategoryBadge } from '../components/common';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_CONFIG = {
  pending: {
    badge: 'badge-yellow',
    label: '⏳ Pending Approval',
    icon: Clock,
    color: '#92400e',
  },
};

function SubmissionRow({ item, type }) {
  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <td style={{ fontWeight: 600 }}>{item.name}</td>
      {type === 'student' && (
        <>
          <td>{item.grade}</td>
          <td><CategoryBadge category={item.category} /></td>
          <td style={{ color: 'var(--color-text-secondary)' }}>{item.village}</td>
        </>
      )}
      {type === 'teacher' && (
        <>
          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.contactNumber}</td>
          <td style={{ color: 'var(--color-text-secondary)' }}>{item.email || '—'}</td>
        </>
      )}
      {type === 'volunteer' && (
        <>
          <td><span className="badge badge-blue">{item.role}</span></td>
          <td>{item.shift || '—'}</td>
        </>
      )}
      <td>
        <span className="badge badge-yellow">⏳ Pending Approval</span>
      </td>
      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
        {item.createdAt
          ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
          : '—'}
      </td>
    </motion.tr>
  );
}

function SubmissionsTable({ type, data, isLoading }) {
  if (isLoading) return <LoadingPage />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={CheckCircle}
        title={`No pending ${type} submissions`}
        description="Any entries you submit will appear here until they are reviewed by the admin."
      />
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {type === 'student' && <><th>Grade</th><th>Category</th><th>Village</th></>}
            {type === 'teacher' && <><th>Contact</th><th>Email</th></>}
            {type === 'volunteer' && <><th>Role</th><th>Shift</th></>}
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <SubmissionRow key={item._id} item={item} type={type} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MySubmissionsPage() {
  const [activeTab, setActiveTab] = useState('students');

  const { data: stagingStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ['my-staging-students'],
    queryFn: () => studentsAPI.getStaging(),
    select: (d) => d.data?.data || [],
  });

  const { data: stagingTeachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['my-staging-teachers'],
    queryFn: () => teachersAPI.getStaging(),
    select: (d) => d.data?.data || [],
  });

  const { data: stagingVolunteers, isLoading: loadingVolunteers } = useQuery({
    queryKey: ['my-staging-volunteers'],
    queryFn: () => volunteersAPI.getStaging(),
    select: (d) => d.data?.data || [],
  });

  const totalPending =
    (stagingStudents?.length || 0) +
    (stagingTeachers?.length || 0) +
    (stagingVolunteers?.length || 0);

  const tabs = [
    { id: 'students', label: 'Students', icon: Users, count: stagingStudents?.length || 0 },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap, count: stagingTeachers?.length || 0 },
    { id: 'volunteers', label: 'Volunteers', icon: Heart, count: stagingVolunteers?.length || 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">My Submissions</h1>
          {totalPending > 0 && (
            <span className="badge badge-yellow" style={{ fontSize: '0.875rem', padding: '4px 12px' }}>
              {totalPending} pending review
            </span>
          )}
        </div>
        <p className="page-subtitle">
          Entries you have submitted for admin approval. You will be notified once reviewed.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Pending Students</div>
          <div className="stat-value" style={{ color: '#92400e' }}>
            {stagingStudents?.length ?? '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Teachers</div>
          <div className="stat-value" style={{ color: '#5b21b6' }}>
            {stagingTeachers?.length ?? '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Volunteers</div>
          <div className="stat-value" style={{ color: '#065f46' }}>
            {stagingVolunteers?.length ?? '—'}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
        padding: '12px 16px', marginBottom: 20, fontSize: '0.875rem', color: '#1e40af',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          All entries you submit are reviewed by the admin before being added to the main system.
          You will receive a notification when an entry is approved or rejected.
          Rejected entries will include a reason — you may re-submit as a new entry with corrections.
        </div>
      </div>

      {/* Tab selector */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-bg)',
        borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: '#f59e0b', color: 'white', borderRadius: 10,
                  fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {activeTab === 'students' && (
            <SubmissionsTable type="student" data={stagingStudents} isLoading={loadingStudents} />
          )}
          {activeTab === 'teachers' && (
            <SubmissionsTable type="teacher" data={stagingTeachers} isLoading={loadingTeachers} />
          )}
          {activeTab === 'volunteers' && (
            <SubmissionsTable type="volunteer" data={stagingVolunteers} isLoading={loadingVolunteers} />
          )}
        </div>
      </div>
    </div>
  );
}