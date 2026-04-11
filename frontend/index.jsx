import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// ─── Loading Spinner ───────────────────────────────────────────────
export function Spinner({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, border: `${size / 10}px solid var(--color-border)`, borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  );
}

export function LoadingPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, flexDirection: 'column', gap: 16 }}>
      <Spinner size={40} />
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Loading...</span>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-secondary)' }}>
      {Icon && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Icon size={48} color="var(--color-text-muted)" /></div>}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>{title}</h3>
      {description && <p style={{ fontSize: '0.875rem', maxWidth: 360, margin: '0 auto 20px' }}>{description}</p>}
      {action}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = '', footer }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          className={`modal ${size}`}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="modal-header">
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)' }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', type = 'danger', loading }) {
  if (!isOpen) return null;
  const colors = { danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
  const icons = { danger: AlertTriangle, warning: AlertTriangle, info: Info };
  const Icon = icons[type];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-body" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${colors[type]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon size={24} color={colors[type]} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>{title}</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={onConfirm} disabled={loading} className={`btn ${type === 'danger' ? 'btn-danger' : type === 'warning' ? 'btn-accent' : 'btn-primary'}`}>
              {loading ? <Spinner size={16} /> : confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────
export function CategoryBadge({ category }) {
  const map = {
    Beginner: { cls: 'badge-purple', label: 'Beginner' },
    Primary: { cls: 'badge-blue', label: 'Primary' },
    Junior: { cls: 'badge-green', label: 'Junior' },
    Inter: { cls: 'badge-yellow', label: 'Inter' },
  };
  const info = map[category] || { cls: 'badge-gray', label: category };
  return <span className={`badge ${info.cls}`}>{info.label}</span>;
}

export function RoleBadge({ role }) {
  const map = {
    admin: 'badge-red',
    editor: 'badge-green',
    viewer: 'badge-purple',
    teacher: 'badge-yellow',
  };
  return <span className={`badge ${map[role] || 'badge-gray'}`}>{role}</span>;
}

export function StatusBadge({ status }) {
  const map = {
    present: { cls: 'badge-green', label: 'Present' },
    absent: { cls: 'badge-red', label: 'Absent' },
    late: { cls: 'badge-yellow', label: 'Late' },
    leave: { cls: 'badge-blue', label: 'Leave' },
    halfDay: { cls: 'badge-orange', label: 'Half Day' },
    pending: { cls: 'badge-yellow', label: 'Pending' },
    approved: { cls: 'badge-green', label: 'Approved' },
    rejected: { cls: 'badge-red', label: 'Rejected' },
    active: { cls: 'badge-green', label: 'Active' },
    inactive: { cls: 'badge-gray', label: 'Inactive' },
  };
  const info = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${info.cls}`}>{info.label}</span>;
}

// ─── Stat Card ─────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = '#3b82f6', trend, subtitle }) {
  return (
    <motion.div className="stat-card" whileHover={{ y: -2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
          {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>{subtitle}</div>}
        </div>
        {Icon && (
          <div className="stat-icon" style={{ background: `${color}15` }}>
            <Icon size={22} color={color} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 12, fontSize: '0.75rem', color: trend >= 0 ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </motion.div>
  );
}

// ─── Search Bar ────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search...', width = 280 }) {
  return (
    <div style={{ position: 'relative', width }}>
      <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2}>
        <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 14px 9px 38px', border: '1.5px solid var(--color-border)', borderRadius: 10, fontSize: '0.875rem', outline: 'none', background: 'white', fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s' }}
        onFocus={(e) => e.target.style.borderColor = 'var(--color-primary-light)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
      />
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────
export function Pagination({ page, pages, total, limit, onPageChange }) {
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Showing {start}–{end} of {total}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="btn btn-secondary btn-sm">← Prev</button>
        {[...Array(Math.min(pages, 5))].map((_, i) => {
          const p = i + 1;
          return (
            <button key={p} onClick={() => onPageChange(p)} className="btn btn-sm" style={{ background: p === page ? 'var(--color-primary)' : 'var(--color-surface)', color: p === page ? 'white' : 'var(--color-text)', border: '1px solid var(--color-border)' }}>{p}</button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page === pages} className="btn btn-secondary btn-sm">Next →</button>
      </div>
    </div>
  );
}

// ─── Info Alert ────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const colors = { info: '#dbeafe,#3b82f6', warning: '#fef3c7,#f59e0b', error: '#fee2e2,#ef4444', success: '#d1fae5,#10b981' };
  const [bg, border] = colors[type].split(',');
  return (
    <div style={{ background: bg, border: `1px solid ${border}40`, borderRadius: 10, padding: '12px 16px', fontSize: '0.875rem', color: 'var(--color-text)' }}>
      {children}
    </div>
  );
}
