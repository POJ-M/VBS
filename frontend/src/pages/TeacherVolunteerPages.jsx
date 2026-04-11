import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Link, UserPlus, Key, Eye, EyeOff,
  CheckCircle, X, AlertCircle, Calendar
} from 'lucide-react';
import { teachersAPI, volunteersAPI, classesAPI, usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { Modal, LoadingPage, EmptyState, SearchBar } from '../components/common';
import { useConfirm } from '../hooks/useConfirm';
import { useMutationSubmit } from '../hooks/useSubmit';
import toast from 'react-hot-toast';

/* ─── Year Banner ────────────────────────────────────────────────── */
function YearBanner({ vbsYear, activeYear, count, label }) {
  if (!vbsYear) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 16, fontSize: '0.83rem', color: '#1e40af' }}>
      <Calendar size={15} style={{ flexShrink: 0 }} />
      <span>Showing <strong>{count}</strong> {label} for <strong>{activeYear?.vbsTitle || `VBS ${vbsYear}`}</strong></span>
    </div>
  );
}

function NoYearState({ label }) {
  return (
    <div className="empty-state">
      <Calendar size={36} style={{ color: 'var(--color-text-muted)' }} />
      <h3>No VBS Year Selected</h3>
      <p>Use the year selector in the top bar to choose a year and view {label}.</p>
    </div>
  );
}

// ─── TEACHERS PAGE ─────────────────────────────────────────────────
export function TeachersPage() {
  const { user } = useAuth();
  const { vbsYear, activeYear } = useActiveYear();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isReadOnly = user?.role === 'viewer';
  const { confirm, ConfirmModal } = useConfirm();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [accountTarget, setAccountTarget] = useState(null);
  const [resetPwTarget, setResetPwTarget] = useState(null);
  const [accForm, setAccForm] = useState({ userID: '', password: '', confirmPassword: '' });
  const [showAccPw, setShowAccPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [form, setForm] = useState({ name: '', contactNumber: '', email: '', yearsOfExperience: '', qualification: '' });

  // Fetch all active teachers
  const { data: allTeachers, isLoading } = useQuery({
    queryKey: ['teachers', search],
    queryFn: () => teachersAPI.getAll({ search, isActive: true }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  // Classes for the selected year — used for assignment modal and year-scoped filter
  const { data: yearClasses } = useQuery({
    queryKey: ['classes', vbsYear],
    queryFn: () => classesAPI.getAll({ year: vbsYear }),
    select: d => d.data?.data || [],
    enabled: isAdmin && !!vbsYear,
  });

  // Year-scoped filter: show teachers assigned to a class in this year, OR unassigned teachers
  const yearClassIds = useMemo(
    () => new Set((yearClasses || []).map(c => c._id?.toString())),
    [yearClasses]
  );

  const teachers = useMemo(() => {
    if (!allTeachers) return [];
    return allTeachers.filter(t => {
      const cid = t.classAssigned?._id?.toString() || t.classAssigned?.toString();
      return !cid || yearClassIds.has(cid);
    });
  }, [allTeachers, yearClassIds]);

  // ── Mutations ─────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: teachersAPI.create,
    onSuccess: res => {
      qc.invalidateQueries(['teachers']);
      toast.success(res.data?.staged ? 'Teacher submitted for approval' : 'Teacher created');
      closeForm();
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => teachersAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['teachers']); toast.success('Teacher updated'); setEditTeacher(null); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleUpdate, loading: updateLoading } = useMutationSubmit(updateMut);

  const deleteMut = useMutation({
    mutationFn: id => teachersAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['teachers']); toast.success('Teacher deleted'); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });

  const assignMut = useMutation({
    mutationFn: ({ teacherId, classId }) => teachersAPI.assignClass(teacherId, classId),
    onSuccess: () => { qc.invalidateQueries(['teachers']); toast.success('Teacher assigned to class'); setAssignTarget(null); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleAssign, loading: assignLoading } = useMutationSubmit(assignMut);

  const createAccMut = useMutation({
    mutationFn: async ({ teacher, userID, password }) => {
      const userRes = await usersAPI.create({
        userID, password, role: 'teacher',
        name: teacher.name, email: teacher.email || undefined,
      });
      await teachersAPI.update(teacher._id, { user: userRes.data?.data?._id });
      return userRes;
    },
    onSuccess: res => {
      qc.invalidateQueries(['teachers']);
      toast.success(`Login account created! Username: ${res.data?.data?.userID}`);
      setAccountTarget(null);
      setAccForm({ userID: '', password: '', confirmPassword: '' });
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to create account'),
  });
  const { submit: handleCreateAcc, loading: accLoading } = useMutationSubmit(createAccMut);

  const resetPwMut = useMutation({
    mutationFn: ({ userId, newPassword }) => usersAPI.resetPassword(userId, { newPassword }),
    onSuccess: () => {
      qc.invalidateQueries(['teachers']);
      toast.success('Password reset. Teacher must change on next login.');
      setResetPwTarget(null);
      setNewPw('');
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleResetPw, loading: resetPwLoading } = useMutationSubmit(resetPwMut);

  const handleDelete = async t => {
    const ok = await confirm({
      title: `Delete "${t.name}"?`,
      message: 'Teacher profile will be permanently removed. Their login account (if any) will remain but lose teacher access.',
      confirmLabel: 'Delete Teacher',
      type: 'danger',
    });
    if (ok) deleteMut.mutate(t._id);
  };

  const openEdit = t => {
    setEditTeacher(t);
    setForm({ name: t.name, contactNumber: t.contactNumber, email: t.email || '', yearsOfExperience: t.yearsOfExperience || '', qualification: t.qualification || '' });
  };
  const closeForm = () => {
    setShowForm(false);
    setEditTeacher(null);
    setForm({ name: '', contactNumber: '', email: '', yearsOfExperience: '', qualification: '' });
  };

  if (!vbsYear) return <NoYearState label="teachers" />;
  if (isLoading) return <LoadingPage />;

  const isBusy = createLoading || updateLoading;

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} · VBS {vbsYear}</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={() => { closeForm(); setShowForm(true); }}>
            <Plus size={16} /> Add Teacher
          </button>
        )}
      </div>

      <YearBanner vbsYear={vbsYear} activeYear={activeYear} count={teachers.length} label="teachers" />
      <div style={{ marginBottom: 14 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or contact…" />
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Contact</th><th>Qualification</th>
                <th>Class ({vbsYear})</th><th>Exp.</th><th>Login Account</th>
                {!isReadOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={null} title={`No teachers for VBS ${vbsYear}`} description="Add teachers and assign them to classes for this year." />
                  </td>
                </tr>
              ) : teachers.map(t => (
                <motion.tr key={t._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    {t.email && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t.email}</div>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{t.contactNumber}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{t.qualification || '—'}</td>
                  <td>
                    {t.classAssigned
                      ? <span className="badge badge-blue">{t.classAssigned.name}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Unassigned</span>}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                    {t.yearsOfExperience ? `${t.yearsOfExperience} yrs` : '—'}
                  </td>
                  <td>
                    {t.user ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge badge-green"><CheckCircle size={11} /> Active</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>@{t.user?.userID || 'linked'}</span>
                      </div>
                    ) : (
                      <span className="badge badge-gray">No Account</span>
                    )}
                  </td>
                  {!isReadOnly && (
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {isAdmin && !t.user && (
                          <button className="btn btn-success btn-sm" onClick={() => setAccountTarget(t)} title="Create login account">
                            <UserPlus size={13} /> Account
                          </button>
                        )}
                        {isAdmin && t.user && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setResetPwTarget(t)} title="Reset password">
                            <Key size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setAssignTarget(t)} title="Assign to class">
                            <Link size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(t)}>
                            <Edit2 size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(t)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm || !!editTeacher}
        onClose={closeForm}
        title={editTeacher ? 'Edit Teacher' : 'Add Teacher'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeForm} disabled={isBusy}>Cancel</button>
            <button className="btn btn-primary" disabled={isBusy}
              onClick={() => editTeacher ? handleUpdate({ id: editTeacher._id, data: form }) : handleCreate(form)}>
              {isBusy
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
                : isEditor ? 'Submit for Approval' : editTeacher ? 'Save Changes' : 'Create Teacher'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Teacher's full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Number <span className="required">*</span></label>
            <input className="form-input" value={form.contactNumber} onChange={e => setForm({ ...form, contactNumber: e.target.value })} maxLength={10} placeholder="10-digit number" inputMode="numeric" />
          </div>
          <div className="form-group">
            <label className="form-label">Email <span className="optional">(optional)</span></label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Years of Experience</label>
            <input className="form-input" type="number" value={form.yearsOfExperience} onChange={e => setForm({ ...form, yearsOfExperience: e.target.value })} min={0} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Qualification <span className="optional">(optional)</span></label>
            <input className="form-input" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="e.g., B.Ed, M.A. Theology" />
          </div>
        </div>
        {isEditor && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <div>Entry will be submitted for admin approval.</div>
          </div>
        )}
        {isAdmin && !editTeacher && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <div>After creating, use the <strong>"Account"</strong> button to create a login for this teacher.</div>
          </div>
        )}
      </Modal>

      {/* Assign Class — only year's classes */}
      <Modal
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title={`Assign Class — ${assignTarget?.name}`}
        footer={<button className="btn btn-secondary" onClick={() => setAssignTarget(null)}>Close</button>}
      >
        <div style={{ marginBottom: 10, fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} /> Classes for VBS {vbsYear}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!(yearClasses || []).length && (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 24, fontSize: '0.85rem' }}>
              No classes for VBS {vbsYear}. Create classes in Settings first.
            </div>
          )}
          {(yearClasses || []).map(c => {
            const isCurrent = c._id?.toString() === (assignTarget?.classAssigned?._id?.toString() || assignTarget?.classAssigned?.toString());
            return (
              <button key={c._id}
                onClick={() => handleAssign({ teacherId: assignTarget._id, classId: c._id })}
                disabled={assignLoading}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px',
                  border: `1.5px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 10,
                  background: isCurrent ? 'rgba(26,47,94,0.06)' : 'white',
                  cursor: assignLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {c.category} · {c.studentCount || 0}/{c.capacity} students
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {c.teacher && !isCurrent && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Has teacher</span>
                  )}
                  {isCurrent && <span className="badge badge-green">Current</span>}
                  <span className="badge badge-gray">{c.category}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Create Account Modal */}
      <Modal
        isOpen={!!accountTarget}
        onClose={() => { setAccountTarget(null); setAccForm({ userID: '', password: '', confirmPassword: '' }); }}
        title={`Create Login — ${accountTarget?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAccountTarget(null)} disabled={accLoading}>Cancel</button>
            <button className="btn btn-primary"
              disabled={accLoading || !accForm.userID || !accForm.password || accForm.password !== accForm.confirmPassword}
              onClick={() => handleCreateAcc({ teacher: accountTarget, userID: accForm.userID, password: accForm.password })}>
              {accLoading
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
                : <><UserPlus size={15} /> Create Account</>}
            </button>
          </>
        }
      >
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <div>Creates a login account for <strong>{accountTarget?.name}</strong> to submit student attendance. Share these credentials with the teacher.</div>
        </div>
        <div className="form-group">
          <label className="form-label">Username <span className="required">*</span></label>
          <input className="form-input" value={accForm.userID}
            onChange={e => setAccForm(f => ({ ...f, userID: e.target.value.toLowerCase().replace(/\s/g, '') }))}
            placeholder="e.g., teacher.john" autoComplete="new-password" />
          <div className="form-hint">Lowercase only, no spaces</div>
        </div>
        <div className="form-group">
          <label className="form-label">Password <span className="required">*</span></label>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showAccPw ? 'text' : 'password'}
              value={accForm.password} onChange={e => setAccForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 characters" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowAccPw(!showAccPw)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
              {showAccPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Password <span className="required">*</span></label>
          <input className="form-input" type="password" value={accForm.confirmPassword}
            onChange={e => setAccForm(f => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="Re-enter password" />
          {accForm.confirmPassword && accForm.password !== accForm.confirmPassword && (
            <div className="form-error">Passwords do not match</div>
          )}
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPwTarget}
        onClose={() => { setResetPwTarget(null); setNewPw(''); }}
        title={`Reset Password — ${resetPwTarget?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setResetPwTarget(null)} disabled={resetPwLoading}>Cancel</button>
            <button className="btn btn-primary"
              disabled={!newPw || newPw.length < 8 || resetPwLoading}
              onClick={() => {
                const userId = resetPwTarget?.user?._id || resetPwTarget?.user;
                if (userId) handleResetPw({ userId, newPassword: newPw });
                else toast.error('No user account linked to this teacher');
              }}>
              {resetPwLoading
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Resetting…</>
                : <><Key size={15} /> Reset Password</>}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New Password</label>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showNewPw ? 'text' : 'password'}
              value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Min 8 characters" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowNewPw(!showNewPw)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
              {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── VOLUNTEERS PAGE ───────────────────────────────────────────────
export function VolunteersPage() {
  const { user } = useAuth();
  const { vbsYear, activeYear } = useActiveYear();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isReadOnly = user?.role === 'viewer';
  const { confirm, ConfirmModal } = useConfirm();

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editVol, setEditVol] = useState(null);
  const [form, setForm] = useState({ name: '', contactNumber: '', email: '', role: '', shift: '', notes: '' });

  const { data: volunteers, isLoading } = useQuery({
    queryKey: ['volunteers', search, filterRole, vbsYear],
    queryFn: () => volunteersAPI.getAll({ search, role: filterRole }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  const uniqueRoles = [...new Set((volunteers || []).map(v => v.role).filter(Boolean))];

  const filteredVols = useMemo(() => {
    if (!volunteers) return [];
    return filterShift ? volunteers.filter(v => v.shift === filterShift) : volunteers;
  }, [volunteers, filterShift]);

  const shiftCounts = useMemo(() => {
    const c = { Morning: 0, Afternoon: 0, 'Full Day': 0 };
    (volunteers || []).forEach(v => { if (v.shift && c[v.shift] !== undefined) c[v.shift]++; });
    return c;
  }, [volunteers]);

  const createMut = useMutation({
    mutationFn: volunteersAPI.create,
    onSuccess: res => {
      qc.invalidateQueries(['volunteers']);
      toast.success(res.data?.staged ? 'Submitted for approval' : 'Volunteer added');
      closeForm();
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => volunteersAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['volunteers']); toast.success('Volunteer updated'); setEditVol(null); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleUpdate, loading: updateLoading } = useMutationSubmit(updateMut);

  const deleteMut = useMutation({
    mutationFn: volunteersAPI.delete,
    onSuccess: () => { qc.invalidateQueries(['volunteers']); toast.success('Volunteer deleted'); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });

  const handleDelete = async v => {
    const ok = await confirm({
      title: `Delete "${v.name}"?`,
      message: 'This will permanently remove the volunteer record.',
      confirmLabel: 'Delete Volunteer',
      type: 'danger',
    });
    if (ok) deleteMut.mutate(v._id);
  };

  const openEdit = v => {
    setEditVol(v);
    setForm({ name: v.name, contactNumber: v.contactNumber, email: v.email || '', role: v.role, shift: v.shift || '', notes: v.notes || '' });
  };
  const closeForm = () => {
    setShowForm(false);
    setEditVol(null);
    setForm({ name: '', contactNumber: '', email: '', role: '', shift: '', notes: '' });
  };

  const SHIFT_COLORS = { Morning: 'badge-blue', Afternoon: 'badge-yellow', 'Full Day': 'badge-green' };
  const isBusy = createLoading || updateLoading;

  if (!vbsYear) return <NoYearState label="volunteers" />;
  if (isLoading) return <LoadingPage />;

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div>
          <h1 className="page-title">Volunteers</h1>
          <p className="page-subtitle">{filteredVols.length} volunteer{filteredVols.length !== 1 ? 's' : ''} · VBS {vbsYear}</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={() => { closeForm(); setShowForm(true); }}>
            <Plus size={16} /> Add Volunteer
          </button>
        )}
      </div>

      <YearBanner vbsYear={vbsYear} activeYear={activeYear} count={filteredVols.length} label="volunteers" />

      {/* Shift filter pills */}
      {(volunteers || []).length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            ['', 'All', (volunteers || []).length],
            ...Object.entries(shiftCounts).filter(([, c]) => c > 0).map(([s, c]) => [s, s, c]),
          ].map(([val, label, count]) => (
            <button key={val} onClick={() => setFilterShift(val)}
              style={{
                padding: '5px 14px', borderRadius: 99, border: '1.5px solid',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600,
                transition: 'all 0.15s',
                borderColor: filterShift === val ? 'var(--color-primary)' : 'var(--color-border)',
                background: filterShift === val ? 'var(--color-primary)' : 'white',
                color: filterShift === val ? 'white' : 'var(--color-text-secondary)',
              }}>
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Search + role filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search volunteers..." />
        {uniqueRoles.length > 0 && (
          <select className="form-select" style={{ width: 160 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">All Roles</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {(search || filterRole) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterRole(''); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Shift</th><th>Contact</th>
                <th>Email</th><th>Status</th>{!isReadOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredVols.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={null}
                      title="No volunteers found"
                      description={search || filterRole || filterShift
                        ? 'Try adjusting your filters.'
                        : `No volunteers for VBS ${vbsYear}.`}
                    />
                  </td>
                </tr>
              ) : filteredVols.map(v => (
                <motion.tr key={v._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.name}</div>
                    {v.notes && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{v.notes}</div>}
                  </td>
                  <td><span className="badge badge-purple">{v.role}</span></td>
                  <td>
                    {v.shift
                      ? <span className={`badge ${SHIFT_COLORS[v.shift] || 'badge-gray'}`}>{v.shift}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{v.contactNumber}</td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{v.email || '—'}</td>
                  <td>
                    <span className={`badge ${v.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {!isReadOnly && (
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {isAdmin && (
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(v)}>
                            <Edit2 size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(v)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm || !!editVol}
        onClose={closeForm}
        title={editVol ? 'Edit Volunteer' : 'Add Volunteer'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeForm} disabled={isBusy}>Cancel</button>
            <button className="btn btn-primary" disabled={isBusy}
              onClick={() => editVol ? handleUpdate({ id: editVol._id, data: form }) : handleCreate(form)}>
              {isBusy
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
                : isEditor ? 'Submit for Approval' : editVol ? 'Save Changes' : 'Create Volunteer'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Name <span className="required">*</span></label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact <span className="required">*</span></label>
            <input className="form-input" value={form.contactNumber} onChange={e => setForm({ ...form, contactNumber: e.target.value })} maxLength={10} inputMode="numeric" />
          </div>
          <div className="form-group">
            <label className="form-label">Role <span className="required">*</span></label>
            <input className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g., Registration, Snacks, Security" />
          </div>
          <div className="form-group">
            <label className="form-label">Shift</label>
            <select className="form-select" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
              <option value="">Select shift</option>
              <option>Morning</option><option>Afternoon</option><option>Full Day</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email <span className="optional">(optional)</span></label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes <span className="optional">(optional)</span></label>
            <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special skills or responsibilities" />
          </div>
        </div>
        {isEditor && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <div>Entry will be submitted for admin approval.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}