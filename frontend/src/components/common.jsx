// Re-export DateInput from its own file for convenience
export { default as DateInput } from './Dateinput';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Info, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// ─── MODAL ────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, footer, size = '' }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div className={`modal ${size}`} onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}>
          <div className="modal-header">
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────
export function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Are you sure?', message = 'This action cannot be undone.', confirmLabel = 'Confirm', type = 'danger', loading = false }) {
  if (!isOpen) return null;
  const btnClass = type === 'danger' ? 'btn-danger' : type === 'success' ? 'btn-success' : 'btn-primary';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button className={`btn ${btnClass}`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </>}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

// ─── LOADING PAGE ─────────────────────────────────────────────────
export function LoadingPage() {
  return (
    <div className="loading-center" style={{ minHeight: 200 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Loading…</span>
      </div>
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={28} color="var(--color-text-muted)" />
          </div>
        </div>
      )}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ─── ALERT ────────────────────────────────────────────────────────
const ALERT_STYLES = {
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', Icon: Info },
  success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', Icon: CheckCircle },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', Icon: AlertTriangle },
  danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', Icon: AlertCircle },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', Icon: AlertCircle },
};

export function Alert({ type = 'info', children, style }) {
  const s = ALERT_STYLES[type] || ALERT_STYLES.info;
  const { Icon } = s;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10, color: s.color, fontSize: '0.875rem', lineHeight: 1.5, ...style }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search...', width = 260 }) {
  return (
    <div style={{ position: 'relative', width }}>
      <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
      <input className="form-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ paddingLeft: 36, width: '100%' }} />
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────
export function Pagination({ page, pages, total, limit, onPageChange }) {
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Showing {from}–{to} of {total}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={{ padding: '6px 10px' }}>
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
          .map((p, i) => p === '...'
            ? <span key={`e-${i}`} style={{ padding: '6px 4px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>…</span>
            : <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onPageChange(p)} style={{ minWidth: 32, justifyContent: 'center', padding: '6px 10px' }}>{p}</button>
          )}
        <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages} style={{ padding: '6px 10px' }}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── CATEGORY BADGE ───────────────────────────────────────────────
const CATEGORY_STYLES = {
  Beginner: { bg: '#ede9fe', color: '#5b21b6' },
  Primary:  { bg: '#dbeafe', color: '#1d4ed8' },
  Junior:   { bg: '#d1fae5', color: '#065f46' },
  Inter:    { bg: '#fef3c7', color: '#92400e' },
};
export function CategoryBadge({ category }) {
  const s = CATEGORY_STYLES[category] || { bg: '#f1f5f9', color: '#475569' };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{category || '—'}</span>;
}

// ─── ROLE BADGE ───────────────────────────────────────────────────
const ROLE_STYLES = { admin: { bg: '#fee2e2', color: '#991b1b' }, editor: { bg: '#d1fae5', color: '#065f46' }, viewer: { bg: '#ede9fe', color: '#5b21b6' }, teacher: { bg: '#fef3c7', color: '#92400e' } };
export function RoleBadge({ role }) {
  const s = ROLE_STYLES[role] || { bg: '#f1f5f9', color: '#475569' };
  return <span className="badge" style={{ background: s.bg, color: s.color, textTransform: 'capitalize' }}>{role || '—'}</span>;
}

// ─── STATUS BADGE ─────────────────────────────────────────────────
const STATUS_STYLES = {
  present:  { bg: '#d1fae5', color: '#065f46', label: '✓ Present' },
  absent:   { bg: '#fee2e2', color: '#991b1b', label: '✗ Absent' },
  late:     { bg: '#fef3c7', color: '#92400e', label: '⏰ Late' },
  leave:    { bg: '#ede9fe', color: '#5b21b6', label: '📋 Leave' },
  halfDay:  { bg: '#ffedd5', color: '#9a3412', label: '½ Half Day' },
  active:   { bg: '#d1fae5', color: '#065f46', label: 'Active' },
  inactive: { bg: '#f1f5f9', color: '#475569', label: 'Inactive' },
};
export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#f1f5f9', color: '#475569', label: status || '—' };
  return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

// ─── STAT CARD ────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = '#3b82f6', subtitle }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color, marginTop: 6 }}>
            {value ?? <span style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>—</span>}
          </div>
          {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 6, fontWeight: 500 }}>{subtitle}</div>}
        </div>
        {Icon && (
          <div className="stat-icon" style={{ background: `${color}15` }}>
            <Icon size={22} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}