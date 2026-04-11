import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Key, ChevronDown, ChevronUp,
  AlertCircle, X, Eye, EyeOff, Image, Youtube, BookOpen
} from 'lucide-react';
import { classesAPI, usersAPI, settingsAPI, authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { useConfirm } from '../hooks/useConfirm';
import { useMutationSubmit } from '../hooks/useSubmit';
import toast from 'react-hot-toast';

// ─── CLASSES PAGE ─────────────────────────────────────────────────
export function ClassesPage() {
  const { user } = useAuth();
  const { vbsYear } = useActiveYear();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const { confirm, ConfirmModal } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', capacity: 30, description: '' });

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes', vbsYear],
    queryFn: () => classesAPI.getAll({ year: vbsYear }),
    select: d => d.data?.data || [],
    enabled: !!vbsYear,
  });

  const createMut = useMutation({
    mutationFn: data => classesAPI.create({ ...data, year: vbsYear }),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Class created'); closeModal(); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => classesAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Class updated'); closeModal(); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleUpdate, loading: updateLoading } = useMutationSubmit(updateMut);

  const deleteMut = useMutation({
    mutationFn: classesAPI.delete,
    onSuccess: () => { qc.invalidateQueries(['classes']); toast.success('Class deleted'); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });

  const openEdit = c => {
    setEditClass(c);
    setForm({ name: c.name, category: c.category, capacity: c.capacity || 30, description: c.description || '' });
  };
  const closeModal = () => { setShowForm(false); setEditClass(null); setForm({ name: '', category: '', capacity: 30, description: '' }); };

  const handleDelete = async cls => {
    const ok = await confirm({
      title: `Delete "${cls.name}"?`,
      message: cls.studentCount > 0
        ? `This class has ${cls.studentCount} students assigned. Remove them first.`
        : 'The class will be permanently deleted.',
      confirmLabel: 'Delete Class', type: 'danger',
    });
    if (ok) deleteMut.mutate(cls._id);
  };

  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  const CATEGORY_COLOR = { Beginner: 'cat-Beginner', Primary: 'cat-Primary', Junior: 'cat-Junior', Inter: 'cat-Inter' };
  const CATEGORY_GRADE_RANGE = { Beginner: 'PreKG – Grade 2', Primary: 'Grade 3–5', Junior: 'Grade 6–8', Inter: 'Grade 9–12' };
  const isBusy = createLoading || updateLoading;

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">{classes?.length || 0} classes · VBS {vbsYear}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setEditClass(null); setForm({ name: '', category: '', capacity: 30, description: '' }); setShowForm(true); }}>
            <Plus size={16} /> Create Class
          </button>
        )}
      </div>

      <div className="grid-2">
        {(classes || []).length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
            No classes yet for VBS {vbsYear}. Create classes to get started.
          </div>
        )}
        {(classes || []).map(cls => (
          <motion.div key={cls._id} className="card" whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className={`badge ${CATEGORY_COLOR[cls.category]}`} style={{ fontSize: '0.6rem' }}>{cls.category?.slice(0, 3).toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{cls.name}</div>
                  <span className={`badge ${CATEGORY_COLOR[cls.category]}`}>{cls.category}</span>
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(cls)}><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(cls)}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'Grade Range', value: CATEGORY_GRADE_RANGE[cls.category] || cls.gradeRange || '—' },
                  { label: 'Students', value: `${cls.studentCount || 0} / ${cls.capacity}` },
                  { label: 'Teacher', value: cls.teacher?.name || 'Unassigned' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: item.label === 'Teacher' && !cls.teacher ? 'var(--color-text-muted)' : undefined }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(((cls.studentCount || 0) / cls.capacity) * 100, 100)}%`, background: (cls.studentCount || 0) >= cls.capacity ? 'var(--color-danger)' : 'var(--color-primary)' }} />
              </div>
              {cls.description && <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{cls.description}</div>}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {(showForm || editClass) && (
          <div className="modal-overlay" onClick={closeModal}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700 }}>{editClass ? 'Edit Class' : 'Create Class'} — VBS {vbsYear}</span>
                <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Class Name <span className="required">*</span></label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Beginner A, Primary 1" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category <span className="required">*</span></label>
                    <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      <option value="">Select category</option>
                      {['Beginner', 'Primary', 'Junior', 'Inter'].map(c => (
                        <option key={c} value={c}>{c} · {CATEGORY_GRADE_RANGE[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacity</label>
                    <input className="form-input" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} min={1} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Description <span className="optional">(optional)</span></label>
                    <textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal} disabled={isBusy}>Cancel</button>
                <button className="btn btn-primary" disabled={isBusy}
                  onClick={() => editClass ? handleUpdate({ id: editClass._id, data: form }) : handleCreate(form)}>
                  {isBusy ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : editClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── USER MANAGEMENT PAGE — Fix 7: Delete action ──────────────────
export function UsersPage() {
  const qc = useQueryClient();
  const { confirm, ConfirmModal } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [form, setForm] = useState({ userID: '', password: '', role: 'editor', name: '', email: '' });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll(),
    select: d => d.data?.data || [],
  });

  const createMut = useMutation({
    mutationFn: usersAPI.create,
    onSuccess: () => {
      qc.invalidateQueries(['users']);
      toast.success('User created');
      setShowForm(false);
      setForm({ userID: '', password: '', role: 'editor', name: '', email: '' });
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => usersAPI.update(id, { isActive }),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('User updated'); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleToggle, loading: toggleLoading } = useMutationSubmit(toggleMut);

  const resetMut = useMutation({
    mutationFn: ({ id, password }) => usersAPI.resetPassword(id, { newPassword: password }),
    onSuccess: () => {
      qc.invalidateQueries(['users']);
      toast.success('Password reset');
      setResetTarget(null);
      setNewPassword('');
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleReset, loading: resetLoading } = useMutationSubmit(resetMut);

  // Fix 7: Delete user mutation
  const deleteMut = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['users']);
      toast.success('User deleted successfully');
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to delete user'),
  });
  const { submit: handleDelete, loading: deleteLoading } = useMutationSubmit(deleteMut);

  const handleDeactivate = async u => {
    const ok = await confirm({
      title: `${u.isActive ? 'Deactivate' : 'Activate'} "${u.name}"?`,
      message: u.isActive ? 'The user will lose access to the system.' : 'The user will regain access.',
      confirmLabel: u.isActive ? 'Deactivate' : 'Activate',
      type: u.isActive ? 'warning' : 'success',
    });
    if (ok) handleToggle({ id: u._id, isActive: !u.isActive });
  };

  const handleDeleteUser = async u => {
    const ok = await confirm({
      title: `Delete "${u.name}"?`,
      message: `This will permanently delete the ${u.role} account "${u.userID}". This action cannot be undone.`,
      confirmLabel: 'Delete User',
      type: 'danger',
    });
    if (ok) handleDelete(u._id);
  };

  const ROLE_COLORS = { admin: 'badge-red', editor: 'badge-green', viewer: 'badge-purple', teacher: 'badge-gold' };
  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div><h1 className="page-title">User Management</h1><p className="page-subtitle">Manage system access</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Create User</button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Username</th><th>Role</th><th>Email</th>
                <th>Status</th><th>Last Login</th><th>Must Change PW</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td><span className="code">{u.userID}</span></td>
                  <td><span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{u.email || '—'}</td>
                  <td><span className={`badge ${u.isActive ? 'badge-green' : 'badge-gray'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN') : 'Never'}</td>
                  <td>{u.mustChangePassword ? <span className="badge badge-yellow">⚠️ Yes</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => handleDeactivate(u)}
                          disabled={toggleLoading}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => setResetTarget(u)} title="Reset password">
                          <Key size={13} />
                        </button>
                        {/* Fix 7: Delete button */}
                        <button className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => handleDeleteUser(u)}
                          disabled={deleteLoading}
                          title="Delete user">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <motion.div className="modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700 }}>Create New User</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username <span className="required">*</span></label>
                    <input className="form-input" value={form.userID} onChange={e => setForm({ ...form, userID: e.target.value.toLowerCase().replace(/\s/g, '') })} placeholder="Lowercase, no spaces" autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role <span className="required">*</span></label>
                    <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temporary Password <span className="required">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" autoComplete="new-password" style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Email <span className="optional">(optional)</span></label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="alert alert-info" style={{ marginTop: 8 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <div>User will be prompted to change their password on first login.</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={createLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={() => handleCreate(form)} disabled={createLoading}>
                  {createLoading ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</> : 'Create User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetTarget && (
          <div className="modal-overlay" onClick={() => setResetTarget(null)}>
            <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700 }}>Reset Password — {resetTarget?.name}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setResetTarget(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Temporary Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setResetTarget(null)} disabled={resetLoading}>Cancel</button>
                <button className="btn btn-primary" onClick={() => handleReset({ id: resetTarget._id, password: newPassword })} disabled={!newPassword || newPassword.length < 8 || resetLoading}>
                  {resetLoading ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Resetting…</> : 'Reset Password'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── VBS SETTINGS PAGE — Fix 4: theme verse, photos, youtube ──────
export function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { refreshYears, setActiveYear } = useActiveYear();
  const { confirm, ConfirmModal } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editSettings, setEditSettings] = useState(null);
  const [activeSection, setActiveSection] = useState('basic');
  const [form, setForm] = useState({});
  const [dailyThemes, setDailyThemes] = useState([]);
  const [prevPhotos, setPrevPhotos] = useState([]);
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showCurr, setShowCurr] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const { data: allSettings, isLoading } = useQuery({
    queryKey: ['all-settings'],
    queryFn: () => settingsAPI.getAll(),
    select: d => d.data?.data || [],
  });

  const createMut = useMutation({
    mutationFn: settingsAPI.create,
    onSuccess: () => { qc.invalidateQueries(['all-settings']); refreshYears(); toast.success('VBS year created'); closeModal(); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => settingsAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['all-settings']); refreshYears(); toast.success('Settings updated'); closeModal(); },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleUpdate, loading: updateLoading } = useMutationSubmit(updateMut);

  const activateMut = useMutation({
    mutationFn: settingsAPI.activate,
    onSuccess: (_, id) => {
      qc.invalidateQueries(['all-settings']); refreshYears();
      const activated = allSettings?.find(s => s._id === id);
      if (activated) setActiveYear(activated);
      toast.success('Year activated');
    },
  });
  const { submit: handleActivate, loading: activateLoading } = useMutationSubmit(activateMut);

  const changePwMut = useMutation({
    mutationFn: data => authAPI.changePassword(data),
    onSuccess: () => { toast.success('Password changed. Please login again.'); localStorage.clear(); window.location.href = '/login'; },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleChangePw, loading: pwLoading } = useMutationSubmit(changePwMut);

  const handleActivateConfirm = async s => {
    if (s.isActive) return;
    const ok = await confirm({
      title: `Activate VBS ${s.year}?`,
      message: `"${s.vbsTitle}" will become the active year.`,
      confirmLabel: `Activate ${s.year}`, type: 'info',
    });
    if (ok) handleActivate(s._id);
  };

  const submitPw = async () => {
    if (!pwForm.currentPassword) { toast.error('Current password required'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    handleChangePw({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const openCreate = () => {
    setEditSettings(null);
    setForm({
      year: new Date().getFullYear(),
      vbsTitle: '',
      vbsVerseRef: '',
      vbsVerse: '',
      tagline: '',
      startDate: '', endDate: '',
      timeWindowStart: '08:00', timeWindowEnd: '10:00',
      mainColor: '#1a2f5e', accentColor: '#c8922a',
    });
    setDailyThemes([]);
    setPrevPhotos([]);
    setYoutubeVideos([]);
    setActiveSection('basic');
    setShowModal(true);
  };

  const openEdit = s => {
    setEditSettings(s);
    setForm({
      year: s.year, vbsTitle: s.vbsTitle || '',
      vbsVerseRef: s.vbsVerseRef || '',
      vbsVerse: s.vbsVerse || '',
      tagline: s.tagline || '',
      startDate: s.dates?.startDate?.slice(0, 10) || '',
      endDate: s.dates?.endDate?.slice(0, 10) || '',
      timeWindowStart: s.timeWindow?.studentAttendance?.startTime || '08:00',
      timeWindowEnd: s.timeWindow?.studentAttendance?.endTime || '10:00',
      mainColor: s.theme?.mainColor || '#1a2f5e',
      accentColor: s.theme?.accentColor || '#c8922a',
    });
    setDailyThemes(s.dailyThemes || []);
    setPrevPhotos(s.previousYearPhotos || []);
    setYoutubeVideos(s.youtubeVideos || []);
    setActiveSection('basic');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditSettings(null); };

  const handleSave = () => {
    if (!form.vbsTitle?.trim()) { toast.error('VBS Title is required'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Start and end dates required'); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { toast.error('End date must be after start date'); return; }
    const data = {
      year: Number(form.year), vbsTitle: form.vbsTitle,
      vbsVerseRef: form.vbsVerseRef || '',
      vbsVerse: form.vbsVerse || '',
      tagline: form.tagline,
      dates: { startDate: form.startDate, endDate: form.endDate },
      timeWindow: {
        studentAttendance: { startTime: form.timeWindowStart, endTime: form.timeWindowEnd },
        teacherAttendance: { flexible: true }, volunteerAttendance: { flexible: true }, timezone: 'Asia/Kolkata',
      },
      theme: { mainColor: form.mainColor, accentColor: form.accentColor },
      dailyThemes,
      previousYearPhotos: prevPhotos,
      youtubeVideos,
    };
    if (editSettings?._id) handleUpdate({ id: editSettings._id, data });
    else handleCreate(data);
  };

  // Daily themes
  const addTheme = () => setDailyThemes(prev => [...prev, { day: prev.length + 1, title: '', verse: '', verseText: '', description: '' }]);
  const updateTheme = (idx, field, val) => setDailyThemes(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  const removeTheme = idx => setDailyThemes(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, day: i + 1 })));

  // Photos
  const addPhoto = () => setPrevPhotos(prev => [...prev, { url: '', caption: '', year: new Date().getFullYear() - 1 }]);
  const updatePhoto = (idx, field, val) => setPrevPhotos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  const removePhoto = idx => setPrevPhotos(prev => prev.filter((_, i) => i !== idx));

  // YouTube videos
  const addVideo = () => setYoutubeVideos(prev => [...prev, { url: '', title: '', year: new Date().getFullYear() - 1 }]);
  const updateVideo = (idx, field, val) => setYoutubeVideos(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));
  const removeVideo = idx => setYoutubeVideos(prev => prev.filter((_, i) => i !== idx));

  const totalDays = s => {
    if (!s.dates?.startDate || !s.dates?.endDate) return 0;
    return Math.round((new Date(s.dates.endDate) - new Date(s.dates.startDate)) / (1000 * 60 * 60 * 24)) + 1;
  };

  const isBusy = createLoading || updateLoading;
  if (isLoading) return <div className="loading-center"><div className="spinner" /></div>;

  const sections = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'dates', label: 'Dates & Window' },
    { id: 'theme', label: 'Theme' },
    { id: 'daily', label: `Daily Themes (${dailyThemes.length})` },
    { id: 'media', label: `Photos & Videos (${prevPhotos.length + youtubeVideos.length})` },
  ];

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div><h1 className="page-title">VBS Settings</h1><p className="page-subtitle">Configure VBS years, themes, and attendance windows</p></div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New VBS Year</button>
      </div>

      {/* Change Password Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={18} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Change Password</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Logged in as {user?.name} ({user?.role})</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowChangePw(!showChangePw)}>
            {showChangePw ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {showChangePw ? 'Cancel' : 'Change Password'}
          </button>
        </div>
        <AnimatePresence>
          {showChangePw && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div className="card-body">
                <div className="form-grid" style={{ maxWidth: 520 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Current Password <span className="required">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type={showCurr ? 'text' : 'password'} value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowCurr(!showCurr)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                        {showCurr ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password <span className="required">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type={showNewPw ? 'text' : 'password'} value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="Min 8 characters" style={{ paddingRight: 40 }} />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm New Password <span className="required">*</span></label>
                    <input className="form-input" type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                    {pwForm.confirm && pwForm.newPassword !== pwForm.confirm && <div className="form-error">Passwords do not match</div>}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={submitPw} disabled={pwLoading}>
                  {pwLoading ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Updating…</> : 'Update Password'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* VBS Years list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(allSettings || []).length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>No VBS years configured yet.</div>
        )}
        {(allSettings || []).map(s => (
          <div key={s._id} className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: s.theme?.mainColor || 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.85rem' }}>
                  {s.year}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>{s.vbsTitle}</div>
                  {s.tagline && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>"{s.tagline}"</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {s.isActive && <span className="badge badge-green">● ACTIVE</span>}
                    <span className="badge badge-gray">{totalDays(s)} days</span>
                    {(s.dailyThemes?.length > 0) && <span className="badge badge-blue">{s.dailyThemes.length} themes</span>}
                    {(s.previousYearPhotos?.length > 0) && <span className="badge badge-purple">{s.previousYearPhotos.length} photos</span>}
                    {(s.youtubeVideos?.length > 0) && <span className="badge badge-red">{s.youtubeVideos.length} videos</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!s.isActive && (
                  <button className="btn btn-success btn-sm" onClick={() => handleActivateConfirm(s)} disabled={activateLoading}>Set Active</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}><Edit2 size={13} /> Edit</button>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {[
                  { label: 'Start Date', value: s.dates?.startDate ? new Date(s.dates.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'End Date', value: s.dates?.endDate ? new Date(s.dates.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Duration', value: totalDays(s) > 0 ? `${totalDays(s)} days` : '—' },
                  { label: 'Attendance Window', value: `${s.timeWindow?.studentAttendance?.startTime || '—'} – ${s.timeWindow?.studentAttendance?.endTime || '—'} IST` },
                  { label: 'Daily Themes', value: `${s.dailyThemes?.length || 0} configured` },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <motion.div className="modal modal-xl" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="modal-header">
                <span style={{ fontWeight: 700 }}>{editSettings ? `Edit VBS ${editSettings.year}` : 'Create New VBS Year'}</span>
                <button className="btn btn-ghost btn-icon" onClick={closeModal}><X size={18} /></button>
              </div>

              {/* Section tabs */}
              <div style={{ padding: '0 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 4, overflowX: 'auto' }}>
                {sections.map(sec => (
                  <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                    style={{ padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'var(--font-sans)', color: activeSection === sec.id ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeSection === sec.id ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                    {sec.label}
                  </button>
                ))}
              </div>

              <div className="modal-body">
                {/* Basic Info */}
                {activeSection === 'basic' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Year <span className="required">*</span></label>
                      <input className="form-input" type="number" value={form.year || ''} onChange={e => setForm({ ...form, year: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">VBS Title <span className="required">*</span></label>
                      <input className="form-input" value={form.vbsTitle || ''} onChange={e => setForm({ ...form, vbsTitle: e.target.value })} placeholder="e.g., Walking with Jesus 2026" />
                    </div>
                    {/* NEW: VBS Main Verse */}
                    <div className="form-group">
                      <label className="form-label">VBS Theme Verse Reference <span className="optional">(optional)</span></label>
                      <input className="form-input" value={form.vbsVerseRef || ''} onChange={e => setForm({ ...form, vbsVerseRef: e.target.value })} placeholder="e.g., John 3:16" />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">VBS Theme Verse Text <span className="optional">(optional)</span></label>
                      <textarea className="form-textarea" rows={2} value={form.vbsVerse || ''} onChange={e => setForm({ ...form, vbsVerse: e.target.value })} placeholder="For God so loved the world..." />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Tagline <span className="optional">(optional)</span></label>
                      <input className="form-input" value={form.tagline || ''} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="e.g., Growing in God's Love — Together!" />
                    </div>
                  </div>
                )}

                {/* Dates & Window */}
                {activeSection === 'dates' && (
                  <div>
                    <div className="alert alert-info" style={{ marginBottom: 16 }}>
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      <div>The attendance window controls when teachers can submit attendance each day.</div>
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">VBS Start Date <span className="required">*</span></label>
                        <input className="form-input" type="date" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">VBS End Date <span className="required">*</span></label>
                        <input className="form-input" type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} min={form.startDate} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Window Opens (IST) <span className="required">*</span></label>
                        <input className="form-input" type="time" value={form.timeWindowStart || '08:00'} onChange={e => setForm({ ...form, timeWindowStart: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Window Closes (IST) <span className="required">*</span></label>
                        <input className="form-input" type="time" value={form.timeWindowEnd || '10:00'} onChange={e => setForm({ ...form, timeWindowEnd: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Theme */}
                {activeSection === 'theme' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Primary Color</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="color" value={form.mainColor || '#1a2f5e'} onChange={e => setForm({ ...form, mainColor: e.target.value })} style={{ width: 44, height: 38, border: '1.5px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        <input className="form-input" value={form.mainColor || '#1a2f5e'} onChange={e => setForm({ ...form, mainColor: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Accent Color</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="color" value={form.accentColor || '#c8922a'} onChange={e => setForm({ ...form, accentColor: e.target.value })} style={{ width: 44, height: 38, border: '1.5px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        <input className="form-input" value={form.accentColor || '#c8922a'} onChange={e => setForm({ ...form, accentColor: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1/-1', padding: 20, borderRadius: 12, border: '1px solid var(--color-border)', background: form.mainColor || '#1a2f5e', color: 'white', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{form.vbsTitle || 'VBS Title Preview'}</div>
                      {form.tagline && <div style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: 4 }}>"{form.tagline}"</div>}
                      <div style={{ marginTop: 12, display: 'inline-block', background: form.accentColor || '#c8922a', color: 'white', padding: '4px 16px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 700 }}>Accent Preview</div>
                    </div>
                  </div>
                )}

                {/* Fix 4: Daily Themes with theme verse */}
                {activeSection === 'daily' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Configure a theme for each VBS day including Bible verse</div>
                      <button className="btn btn-primary btn-sm" onClick={addTheme}><Plus size={14} /> Add Day {dailyThemes.length + 1}</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {dailyThemes.map((theme, idx) => (
                        <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, background: 'var(--color-surface-2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <BookOpen size={15} /> Day {theme.day}
                            </span>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => removeTheme(idx)}><Trash2 size={13} /></button>
                          </div>
                          <div className="form-grid">
                            <div className="form-group">
                              <label className="form-label">Theme Title <span className="required">*</span></label>
                              <input className="form-input" value={theme.title} onChange={e => updateTheme(idx, 'title', e.target.value)} placeholder="e.g., God's Love" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Bible Verse Reference</label>
                              <input className="form-input" value={theme.verse} onChange={e => updateTheme(idx, 'verse', e.target.value)} placeholder="e.g., John 3:16" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                              <label className="form-label">Verse Text</label>
                              <textarea className="form-textarea" rows={2} value={theme.verseText} onChange={e => updateTheme(idx, 'verseText', e.target.value)} placeholder="Full Bible verse text" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                              <label className="form-label">Theme Description <span className="optional">(optional)</span></label>
                              <textarea className="form-textarea" rows={2} value={theme.description || ''} onChange={e => updateTheme(idx, 'description', e.target.value)} placeholder="Brief description of the day's theme and activities" />
                            </div>
                          </div>
                        </div>
                      ))}
                      {dailyThemes.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          No daily themes configured. Click "Add Day 1" to start.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fix 4: Photos & YouTube Videos */}
                {activeSection === 'media' && (
                  <div>
                    {/* Previous Year Photos */}
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Image size={15} /> Previous Year Photos
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            Add photo URLs from previous VBS programs to display on home page
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={addPhoto}><Plus size={14} /> Add Photo</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {prevPhotos.map((photo, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface-2)' }}>
                            <div style={{ flex: 1 }}>
                              <div className="form-grid" style={{ marginBottom: 0 }}>
                                <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 8 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Photo URL <span className="required">*</span></label>
                                  <input className="form-input" value={photo.url} onChange={e => updatePhoto(idx, 'url', e.target.value)} placeholder="https://... (image URL)" style={{ fontSize: '0.82rem' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Caption</label>
                                  <input className="form-input" value={photo.caption || ''} onChange={e => updatePhoto(idx, 'caption', e.target.value)} placeholder="Brief caption" style={{ fontSize: '0.82rem' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Year</label>
                                  <input className="form-input" type="number" value={photo.year || ''} onChange={e => updatePhoto(idx, 'year', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                                </div>
                              </div>
                            </div>
                            {photo.url && (
                              <img src={photo.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid var(--color-border)' }}
                                onError={e => { e.target.style.display = 'none'; }} />
                            )}
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)', flexShrink: 0 }} onClick={() => removePhoto(idx)}><Trash2 size={13} /></button>
                          </div>
                        ))}
                        {prevPhotos.length === 0 && (
                          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: '0.82rem', border: '1px dashed var(--color-border)', borderRadius: 10 }}>
                            No photos added. Click "Add Photo" to add previous year highlights.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* YouTube Videos */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Youtube size={15} color="#dc2626" /> YouTube Videos
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            Add YouTube video links from previous VBS programs
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={addVideo}><Plus size={14} /> Add Video</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {youtubeVideos.map((video, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface-2)' }}>
                            <div style={{ flex: 1 }}>
                              <div className="form-grid" style={{ marginBottom: 0 }}>
                                <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 8 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>YouTube URL <span className="required">*</span></label>
                                  <input className="form-input" value={video.url} onChange={e => updateVideo(idx, 'url', e.target.value)} placeholder="https://youtube.com/watch?v=... or https://youtu.be/..." style={{ fontSize: '0.82rem' }} />
                                  {video.url && (
                                    <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                      Video ID: {video.url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || 'Not recognized'}
                                    </div>
                                  )}
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Video Title</label>
                                  <input className="form-input" value={video.title || ''} onChange={e => updateVideo(idx, 'title', e.target.value)} placeholder="e.g., VBS 2025 Highlights" style={{ fontSize: '0.82rem' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Year</label>
                                  <input className="form-input" type="number" value={video.year || ''} onChange={e => updateVideo(idx, 'year', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                                </div>
                              </div>
                            </div>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)', flexShrink: 0 }} onClick={() => removeVideo(idx)}><Trash2 size={13} /></button>
                          </div>
                        ))}
                        {youtubeVideos.length === 0 && (
                          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: '0.82rem', border: '1px dashed var(--color-border)', borderRadius: 10 }}>
                            No videos added. Click "Add Video" to add YouTube links.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal} disabled={isBusy}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isBusy}>
                  {isBusy ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : 'Save Settings'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
