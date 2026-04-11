import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Key, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: () => authAPI.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
    onSuccess: () => {
      toast.success('Password changed. Please log in again.');
      localStorage.clear();
      window.location.href = '/login';
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to change password');
    },
  });

  const validate = () => {
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Current password is required';
    if (!form.newPassword) errs.newPassword = 'New password is required';
    else if (form.newPassword.length < 8) errs.newPassword = 'Must be at least 8 characters';
    if (form.newPassword !== form.confirm) errs.confirm = 'Passwords do not match';
    if (form.newPassword === form.currentPassword) errs.newPassword = 'New password must differ from current';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) mutation.mutate();
  };

  const toggle = (field) => setShowPasswords(s => ({ ...s, [field]: !s[field] }));

  const strength = () => {
    const p = form.newPassword;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: 'Weak', color: '#dc2626', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: '#d97706', width: '45%' };
    if (score <= 3) return { label: 'Good', color: '#2563eb', width: '70%' };
    return { label: 'Strong', color: '#16a34a', width: '100%' };
  };

  const pwStrength = strength();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Key size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 6 }}>
            {user?.mustChangePassword ? 'Set New Password' : 'Change Password'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            {user?.mustChangePassword
              ? 'Your account requires a password change before continuing.'
              : `Updating password for ${user?.name}`}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          {user?.mustChangePassword && (
            <div className="alert alert-warning" style={{ marginBottom: 20 }}>
              <CheckCircle size={15} />
              <div>You must change your temporary password before using the system.</div>
            </div>
          )}

          {/* Current password */}
          <div className="form-group">
            <label className="form-label">Current Password <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className={`form-input ${errors.currentPassword ? 'error' : ''}`}
                type={showPasswords.current ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="Enter current password"
                style={{ paddingRight: 44 }}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => toggle('current')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.currentPassword && <div className="form-error">{errors.currentPassword}</div>}
          </div>

          {/* New password */}
          <div className="form-group">
            <label className="form-label">New Password <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className={`form-input ${errors.newPassword ? 'error' : ''}`}
                type={showPasswords.new ? 'text' : 'password'}
                value={form.newPassword}
                onChange={e => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Minimum 8 characters"
                style={{ paddingRight: 44 }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => toggle('new')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Strength bar */}
            {form.newPassword && pwStrength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pwStrength.width, background: pwStrength.color, borderRadius: 99, transition: 'all 0.3s' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: pwStrength.color, fontWeight: 600, marginTop: 4 }}>
                  {pwStrength.label} password
                </div>
              </div>
            )}
            {errors.newPassword && <div className="form-error">{errors.newPassword}</div>}
          </div>

          {/* Confirm */}
          <div className="form-group">
            <label className="form-label">Confirm New Password <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className={`form-input ${errors.confirm ? 'error' : ''}`}
                type={showPasswords.confirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                placeholder="Re-enter new password"
                style={{ paddingRight: 44 }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => toggle('confirm')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.confirm && form.confirm === form.newPassword && (
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Passwords match
              </div>
            )}
            {errors.confirm && <div className="form-error">{errors.confirm}</div>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {!user?.mustChangePassword && (
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              style={{ flex: 1, justifyContent: 'center', height: 44 }}
            >
              {mutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Updating...
                </span>
              ) : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Password tips */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text)' }}>Strong password tips:</div>
          {['At least 8 characters', 'Mix uppercase and lowercase letters', 'Include numbers and symbols', 'Avoid personal information'].map(tip => (
            <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}