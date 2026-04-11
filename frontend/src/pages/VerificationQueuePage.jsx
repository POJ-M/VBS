import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Users, GraduationCap, Heart, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { studentsAPI, teachersAPI, volunteersAPI } from '../services/api';
import { Modal, LoadingPage, EmptyState, CategoryBadge } from '../components/common';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Reject Modal ─────────────────────────────────────────────────
function RejectModal({ isOpen, onClose, onReject, entityName, loading }) {
  const [reason, setReason] = useState('');

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reject Entry"
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={() => { onReject(reason); }}
            disabled={!reason.trim() || loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Rejecting…</>
              : <><XCircle size={14} /> Reject Entry</>
            }
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: '0.875rem' }}>
        Rejecting: <strong>{entityName}</strong>
      </p>
      <div className="form-group">
        <label className="form-label">Rejection Reason <span className="required">*</span></label>
        <textarea
          className="form-textarea"
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explain why this entry is being rejected..."
          autoFocus
        />
        {reason.trim() === '' && (
          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            A reason is required before rejecting.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Individual Row ───────────────────────────────────────────────
function StagingRow({ item, type, onApprove, onReject, disabled }) {
  const [showDetails, setShowDetails] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleApprove = () => {
    if (disabled) return;
    onApprove(item._id);
  };

  const handleRejectConfirm = (reason) => {
    onReject(item._id, reason);
    setRejectOpen(false);
  };

  return (
    <>
      <RejectModal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        entityName={item.name}
        onReject={handleRejectConfirm}
        loading={false}
      />
      <motion.tr
        key={item._id}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
        layout
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            {(item.religion || item.contactNumber) && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 2 }}
                title="Toggle details"
              >
                {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
          {/* Expandable details */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {item.religion && <div>Religion: {item.religion}{item.christianDenomination ? ` (${item.christianDenomination})` : ''}</div>}
                  {item.contactNumber && <div>Contact: {item.contactNumber}</div>}
                  {item.parentName && <div>Parent: {item.parentName}</div>}
                  {item.schoolName && <div>School: {item.schoolName}</div>}
                  {item.notes && <div>Notes: {item.notes}</div>}
                  {item.qualification && <div>Qualification: {item.qualification}</div>}
                  {item.yearsOfExperience != null && <div>Experience: {item.yearsOfExperience} yrs</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </td>
        {type === 'students' && (
          <>
            <td>{item.grade}</td>
            <td><CategoryBadge category={item.category} /></td>
            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{item.village || '—'}</td>
            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{item.parentName || '—'}</td>
          </>
        )}
        {type === 'teachers' && (
          <>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.contactNumber}</td>
            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{item.email || '—'}</td>
            <td style={{ fontSize: '0.82rem' }}>{item.yearsOfExperience ? `${item.yearsOfExperience} yrs` : '—'}</td>
          </>
        )}
        {type === 'volunteers' && (
          <>
            <td><span className="badge badge-blue">{item.role}</span></td>
            <td>{item.shift ? <span className="badge badge-gray">{item.shift}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>}</td>
            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.contactNumber}</td>
          </>
        )}
        <td>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{item.createdBy?.name || '—'}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
            {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '—'}
          </div>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-success btn-sm"
              onClick={handleApprove}
              disabled={disabled}
              style={{ minWidth: 80 }}
            >
              {disabled
                ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> …</>
                : <><CheckCircle size={13} /> Approve</>
              }
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => !disabled && setRejectOpen(true)}
              disabled={disabled}
              style={{ minWidth: 72 }}
            >
              <XCircle size={13} /> Reject
            </button>
          </div>
        </td>
      </motion.tr>
    </>
  );
}

// ─── Staging Table ────────────────────────────────────────────────
function StagingTable({ type, data, isLoading, onApprove, onReject, processingIds }) {
  const items = data || [];

  if (isLoading) return <LoadingPage />;

  if (items.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <CheckCircle size={28} color="var(--color-success)" />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: 6 }}>
          All caught up!
        </h3>
        <p style={{ fontSize: '0.845rem', color: 'var(--color-text-secondary)' }}>
          No pending {type} entries to review.
        </p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {type === 'students' && <><th>Grade</th><th>Category</th><th>Village</th><th>Parent</th></>}
            {type === 'teachers' && <><th>Contact</th><th>Email</th><th>Experience</th></>}
            {type === 'volunteers' && <><th>Role</th><th>Shift</th><th>Contact</th></>}
            <th>Submitted By</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {items.map(item => (
              <StagingRow
                key={item._id}
                item={item}
                type={type}
                onApprove={onApprove}
                onReject={onReject}
                disabled={processingIds.has(item._id)}
              />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────
function BulkActionsBar({ type, count, onBulkApprove, loading }) {
  if (count < 2) return null;
  return (
    <div style={{ padding: '10px 16px', background: '#f0f7ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.82rem', color: '#1e40af', fontWeight: 600 }}>
        {count} pending {type} — approve all at once?
      </span>
      <button
        className="btn btn-primary btn-sm"
        onClick={onBulkApprove}
        disabled={loading}
      >
        {loading
          ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Approving all…</>
          : <><CheckCircle size={13} /> Approve All {count}</>
        }
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function VerificationQueuePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('students');
  // FIX 6: Track which IDs are being processed to prevent double-clicks
  const processingIds = useRef(new Set());
  const [processingState, setProcessingState] = useState(new Set());

  const markProcessing = useCallback((id) => {
    processingIds.current.add(id);
    setProcessingState(new Set(processingIds.current));
  }, []);

  const clearProcessing = useCallback((id) => {
    processingIds.current.delete(id);
    setProcessingState(new Set(processingIds.current));
  }, []);

  const invalidate = useCallback(() => {
    qc.invalidateQueries(['staging-students']);
    qc.invalidateQueries(['staging-teachers']);
    qc.invalidateQueries(['staging-volunteers']);
    qc.invalidateQueries(['dashboard-stats']);
  }, [qc]);

  // ── Queries ────────────────────────────────────────────────────
  const { data: stagingStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ['staging-students'],
    queryFn: () => studentsAPI.getStaging(),
    select: d => d.data?.data || [],
  });
  const { data: stagingTeachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['staging-teachers'],
    queryFn: () => teachersAPI.getStaging(),
    select: d => d.data?.data || [],
  });
  const { data: stagingVolunteers, isLoading: loadingVolunteers } = useQuery({
    queryKey: ['staging-volunteers'],
    queryFn: () => volunteersAPI.getStaging(),
    select: d => d.data?.data || [],
  });

  // ── Approve mutations ──────────────────────────────────────────
  const approveStudentMut = useMutation({
    mutationFn: (id) => studentsAPI.approve(id),
    onSuccess: (_, id) => { clearProcessing(id); toast.success('Student approved!'); invalidate(); },
    onError: (err, id) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Approval failed'); },
  });

  const approveTeacherMut = useMutation({
    mutationFn: (id) => teachersAPI.approve(id),
    onSuccess: (_, id) => { clearProcessing(id); toast.success('Teacher approved!'); invalidate(); },
    onError: (err, id) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Approval failed'); },
  });

  const approveVolunteerMut = useMutation({
    mutationFn: (id) => volunteersAPI.approve(id),
    onSuccess: (_, id) => { clearProcessing(id); toast.success('Volunteer approved!'); invalidate(); },
    onError: (err, id) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Approval failed'); },
  });

  // ── Reject mutations ───────────────────────────────────────────
  const rejectStudentMut = useMutation({
    mutationFn: ({ id, reason }) => studentsAPI.reject(id, reason),
    onSuccess: (_, { id }) => { clearProcessing(id); toast.success('Student rejected'); invalidate(); },
    onError: (err, { id }) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Rejection failed'); },
  });

  const rejectTeacherMut = useMutation({
    mutationFn: ({ id, reason }) => teachersAPI.reject(id, reason),
    onSuccess: (_, { id }) => { clearProcessing(id); toast.success('Teacher rejected'); invalidate(); },
    onError: (err, { id }) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Rejection failed'); },
  });

  const rejectVolunteerMut = useMutation({
    mutationFn: ({ id, reason }) => volunteersAPI.reject(id, reason),
    onSuccess: (_, { id }) => { clearProcessing(id); toast.success('Volunteer rejected'); invalidate(); },
    onError: (err, { id }) => { clearProcessing(id); toast.error(err.response?.data?.message || 'Rejection failed'); },
  });

  // ── Bulk approve mutations ─────────────────────────────────────
  const bulkApproveStudentsMut = useMutation({
    mutationFn: (ids) => studentsAPI.bulkApprove(ids),
    onSuccess: (res) => {
      const { approved = [], failed = [] } = res.data?.data || {};
      if (approved.length) toast.success(`${approved.length} students approved!`);
      if (failed.length) toast.error(`${failed.length} failed to approve`);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk approval failed'),
  });

  const bulkApproveTeachersMut = useMutation({
    mutationFn: (ids) => teachersAPI.bulkApprove(ids),
    onSuccess: (res) => {
      const { approved = [], failed = [] } = res.data?.data || {};
      if (approved.length) toast.success(`${approved.length} teachers approved!`);
      if (failed.length) toast.error(`${failed.length} failed`);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk approval failed'),
  });

  const bulkApproveVolunteersMut = useMutation({
    mutationFn: (ids) => volunteersAPI.bulkApprove(ids),
    onSuccess: (res) => {
      const { approved = [], failed = [] } = res.data?.data || {};
      if (approved.length) toast.success(`${approved.length} volunteers approved!`);
      if (failed.length) toast.error(`${failed.length} failed`);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk approval failed'),
  });

  // ── Handler factories ──────────────────────────────────────────
  const makeApproveHandler = useCallback((mutate) => (id) => {
    if (processingIds.current.has(id)) return; // FIX 6: block duplicate
    markProcessing(id);
    mutate(id);
  }, [markProcessing]);

  const makeRejectHandler = useCallback((mutate) => (id, reason) => {
    if (processingIds.current.has(id)) return;
    markProcessing(id);
    mutate({ id, reason });
  }, [markProcessing]);

  const studentHandlers = {
    onApprove: makeApproveHandler(approveStudentMut.mutate),
    onReject: makeRejectHandler(rejectStudentMut.mutate),
  };
  const teacherHandlers = {
    onApprove: makeApproveHandler(approveTeacherMut.mutate),
    onReject: makeRejectHandler(rejectTeacherMut.mutate),
  };
  const volunteerHandlers = {
    onApprove: makeApproveHandler(approveVolunteerMut.mutate),
    onReject: makeRejectHandler(rejectVolunteerMut.mutate),
  };

  const totalPending = (stagingStudents?.length || 0) + (stagingTeachers?.length || 0) + (stagingVolunteers?.length || 0);

  const tabs = [
    { id: 'students',   label: 'Students',   icon: Users,         count: stagingStudents?.length  || 0 },
    { id: 'teachers',   label: 'Teachers',   icon: GraduationCap, count: stagingTeachers?.length  || 0 },
    { id: 'volunteers', label: 'Volunteers', icon: Heart,         count: stagingVolunteers?.length || 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title">Verification Queue</h1>
          {totalPending > 0 && (
            <span className="badge badge-red" style={{ fontSize: '0.875rem', padding: '4px 12px' }}>
              {totalPending} pending
            </span>
          )}
        </div>
        <p className="page-subtitle">Review and approve/reject entries submitted by editors</p>
      </div>

      {/* Info banner */}
      {totalPending > 0 && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <div>
            Click <strong>Approve</strong> to add to the main system, or <strong>Reject</strong> with a reason. The editor will be notified of your decision.
          </div>
        </div>
      )}

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card">
        {/* Bulk approve bar */}
        {activeTab === 'students' && (stagingStudents?.length || 0) > 1 && (
          <BulkActionsBar
            type="students"
            count={stagingStudents?.length}
            onBulkApprove={() => bulkApproveStudentsMut.mutate(stagingStudents.map(s => s._id))}
            loading={bulkApproveStudentsMut.isPending}
          />
        )}
        {activeTab === 'teachers' && (stagingTeachers?.length || 0) > 1 && (
          <BulkActionsBar
            type="teachers"
            count={stagingTeachers?.length}
            onBulkApprove={() => bulkApproveTeachersMut.mutate(stagingTeachers.map(t => t._id))}
            loading={bulkApproveTeachersMut.isPending}
          />
        )}
        {activeTab === 'volunteers' && (stagingVolunteers?.length || 0) > 1 && (
          <BulkActionsBar
            type="volunteers"
            count={stagingVolunteers?.length}
            onBulkApprove={() => bulkApproveVolunteersMut.mutate(stagingVolunteers.map(v => v._id))}
            loading={bulkApproveVolunteersMut.isPending}
          />
        )}

        <div style={{ padding: 0 }}>
          {activeTab === 'students' && (
            <StagingTable
              type="students"
              data={stagingStudents}
              isLoading={loadingStudents}
              processingIds={processingState}
              {...studentHandlers}
            />
          )}
          {activeTab === 'teachers' && (
            <StagingTable
              type="teachers"
              data={stagingTeachers}
              isLoading={loadingTeachers}
              processingIds={processingState}
              {...teacherHandlers}
            />
          )}
          {activeTab === 'volunteers' && (
            <StagingTable
              type="volunteers"
              data={stagingVolunteers}
              isLoading={loadingVolunteers}
              processingIds={processingState}
              {...volunteerHandlers}
            />
          )}
        </div>
      </div>
    </div>
  );
}
