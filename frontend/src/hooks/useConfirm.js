import React, { useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Modal Overlay ──────────────────────────────────────────────── */
function ConfirmModalUI({ open, title, message, confirmLabel, cancelLabel, type, loading, onConfirm, onCancel }) {
  const icons = {
    danger:  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Trash2 size={22} color="#dc2626" /></div>,
    warning: <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><AlertTriangle size={22} color="#d97706" /></div>,
    info:    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Info size={22} color="#2563eb" /></div>,
    success: <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><CheckCircle size={22} color="#16a34a" /></div>,
  };
  const confirmBtnClass = {
    danger: 'btn-danger', warning: 'btn-accent', info: 'btn-primary', success: 'btn-success',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999 }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 16, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}
          >
            {icons[type] || icons.danger}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>{title}</h3>
            {message && (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.65, marginBottom: 24 }}>{message}</p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={onCancel} disabled={loading} style={{ minWidth: 90 }}>
                {cancelLabel || 'Cancel'}
              </button>
              <button className={`btn ${confirmBtnClass[type] || 'btn-primary'}`} onClick={onConfirm} disabled={loading} style={{ minWidth: 90 }}>
                {loading ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Processing…</> : (confirmLabel || 'Confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Drop-in replacement for window.confirm() using a modal.
 *
 * Usage:
 *   const { confirm, ConfirmModal } = useConfirm();
 *
 *   // In JSX:
 *   <>{ConfirmModal}</>
 *
 *   // In handlers (awaitable):
 *   const ok = await confirm({ title: 'Delete?', message: '...', type: 'danger' });
 *   if (ok) doDelete();
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, loading: false, resolve: null, title: '', message: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', type: 'danger' });

  const confirm = useCallback((opts = {}) => {
    return new Promise(resolve => {
      setState({ open: true, loading: false, resolve, title: opts.title || 'Are you sure?', message: opts.message || '', confirmLabel: opts.confirmLabel || 'Confirm', cancelLabel: opts.cancelLabel || 'Cancel', type: opts.type || 'danger' });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    // Short delay so loading state is visible, then resolve
    setTimeout(() => {
      setState(s => {
        s.resolve?.(true);
        return { ...s, open: false, loading: false, resolve: null };
      });
    }, 60);
  }, []);

  const handleCancel = useCallback(() => {
    setState(s => {
      s.resolve?.(false);
      return { ...s, open: false, loading: false, resolve: null };
    });
  }, []);

  const ConfirmModal = (
    <ConfirmModalUI
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      type={state.type}
      loading={state.loading}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmModal };
}

/**
 * Standalone ConfirmModal for cases where you manage state yourself.
 */
export { ConfirmModalUI as ConfirmModal };