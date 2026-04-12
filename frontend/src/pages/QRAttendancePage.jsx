// frontend/src/pages/QRAttendancePage.jsx — Enhanced with admin time windows
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Clock, CheckCircle, XCircle, Users, RefreshCw,
  AlertTriangle, Camera, X, ChevronDown,
  Download, Eye, Play, Square, Loader2, Check,
  Calendar, ScanLine, Timer, Printer,
  AlarmClock, Info, ArrowRight, Shield
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage } from '../components/common';
import DateInput from '../components/Dateinput';
import toast from 'react-hot-toast';

/* ─── API helpers ────────────────────────────────────────────────── */
const qrAPI = {
  createSession: (data) => api.post('/qr-attendance/sessions', data),
  getSessions:   (params) => api.get('/qr-attendance/sessions', { params }),
  getSession:    (id) => api.get(`/qr-attendance/sessions/${id}`),
  deactivate:    (id) => api.put(`/qr-attendance/sessions/${id}/deactivate`),
  scan:          (token) => api.post('/qr-attendance/scan', { token }),
  adminScan:     (data) => api.post('/qr-attendance/admin-scan', data),
  validate:      (token) => api.get(`/qr-attendance/validate/${token}`),
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const getTodayIST = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
}) : '—';

const fmtDateLong = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}) : '—';

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
}) : '—';

/** Get current IST time as HH:MM */
const getCurrentISTTime = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
};

/* ─── Status Badge ───────────────────────────────────────────────── */
const ScanStatusBadge = ({ status, size = 'sm' }) => {
  if (!status) return null;
  const cfg = {
    present: { bg: '#dcfce7', color: '#15803d', icon: '✓', label: 'Present' },
    late:    { bg: '#fef9c3', color: '#a16207', icon: '⏰', label: 'Late' },
  };
  const s = cfg[status] || { bg: '#f1f5f9', color: '#475569', icon: '?', label: status };
  const pad = size === 'lg' ? '6px 14px' : '3px 10px';
  const fs = size === 'lg' ? '0.82rem' : '0.68rem';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: 99, background: s.bg, color: s.color,
      fontSize: fs, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {s.icon} {s.label}
    </span>
  );
};

/* ─── Live Countdown Timer Hook ──────────────────────────────────── */
function useCountdown(expiresAt, onTimeUntil) {
  const [state, setState] = useState({ remainSecs: 0, isExpired: false, isInLateWindow: false });

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const now = Date.now();
      const expMs = new Date(expiresAt).getTime();
      const onTimeMs = onTimeUntil ? new Date(onTimeUntil).getTime() : null;
      const remain = Math.max(0, Math.floor((expMs - now) / 1000));
      setState({
        remainSecs: remain,
        isExpired: now >= expMs,
        isInLateWindow: onTimeMs ? now > onTimeMs : false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onTimeUntil]);

  return state;
}

/* ─── QR Code Display ────────────────────────────────────────────── */
function QRCodeDisplay({ value, size = 280, label, expiresAt, onTimeUntil, sessionData }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const { remainSecs, isExpired, isInLateWindow } = useCountdown(expiresAt, onTimeUntil);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1a2f5e&margin=2&format=png`;
  useEffect(() => { setQrDataUrl(qrUrl); }, [value, size]);

  const mins = Math.floor(remainSecs / 60);
  const secs = remainSecs % 60;

  // Color progression: green → amber → red
  const urgency = remainSecs > 300 ? 'ok' : remainSecs > 60 ? 'warn' : 'crit';
  const timerColors = { ok: '#16a34a', warn: '#d97706', crit: '#dc2626' };
  const timerColor = timerColors[urgency];

  const handlePrint = () => {
    if (!qrDataUrl) { toast.error('QR not loaded yet'); return; }
    const dateStr = fmtDateLong(sessionData?.date || new Date());
    const labelText = sessionData?.label || label || 'Attendance';
    const vbsYear = sessionData?.vbsYear || '';
    const expiryStr = sessionData?.expiresAt ? fmtTime(sessionData.expiresAt) : '';
    const windowInfo = sessionData?.windowStartTime && sessionData?.onTimeUntilTimeStr
      ? `On-time window: ${sessionData.windowStartTime} — ${sessionData.onTimeUntilTimeStr} | Late after: ${sessionData.onTimeUntilTimeStr}`
      : sessionData?.onTimeUntilTimeStr
      ? `On-time until: ${sessionData.onTimeUntilTimeStr} IST`
      : '';

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>QR Attendance — ${labelText}</title>
<style>
  @page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:white;color:#111}
  .page{width:210mm;min-height:297mm;display:flex;flex-direction:column}
  .header{background:#1a2f5e;color:white;padding:20px 32px 18px;display:flex;align-items:center;gap:16px}
  .logo{width:52px;height:52px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,0.15);padding:4px}
  .church-name{font-size:16pt;font-weight:800;line-height:1.2}
  .church-sub{font-size:8.5pt;opacity:0.7;margin-top:2px}
  .vbs-tag{font-size:9pt;font-weight:700;color:#c8922a;margin-top:3px}
  .accent-bar{height:5px;background:linear-gradient(90deg,#c8922a,#e8b840,#c8922a)}
  .session-info{padding:18px 32px 14px;border-bottom:1px solid #e8edf2;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .session-label{font-size:15pt;font-weight:800;color:#1a2f5e}
  .session-date{font-size:10pt;color:#4b5563;margin-top:3px}
  .active-pill{display:inline-block;padding:3px 12px;border-radius:99px;font-size:8pt;font-weight:700;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
  .expiry{font-size:8.5pt;color:#6b7280;margin-top:4px}
  /* TIME WINDOW BOX */
  .time-window{margin:0 32px 16px;padding:12px 16px;background:#fef3c7;border:1.5px solid #fbbf24;border-radius:10px;display:flex;align-items:center;gap:12px}
  .tw-icon{font-size:20pt}
  .tw-title{font-size:9.5pt;font-weight:800;color:#92400e;margin-bottom:2px}
  .tw-detail{font-size:8.5pt;color:#a16207}
  .qr-section{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .scan-label{font-size:9pt;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px}
  .qr-frame{position:relative;padding:18px;background:white;border:3px solid #1a2f5e;border-radius:18px;box-shadow:0 8px 40px rgba(26,47,94,.15)}
  .qr-frame img{display:block;border-radius:8px}
  .corner{position:absolute;width:24px;height:24px}
  .tl{top:-3px;left:-3px;border-top:4px solid #c8922a;border-left:4px solid #c8922a;border-radius:6px 0 0 0}
  .tr{top:-3px;right:-3px;border-top:4px solid #c8922a;border-right:4px solid #c8922a;border-radius:0 6px 0 0}
  .bl{bottom:-3px;left:-3px;border-bottom:4px solid #c8922a;border-left:4px solid #c8922a;border-radius:0 0 0 6px}
  .br{bottom:-3px;right:-3px;border-bottom:4px solid #c8922a;border-right:4px solid #c8922a;border-radius:0 0 6px 0}
  .inst{margin-top:16px;text-align:center}
  .inst-main{font-size:11pt;font-weight:600;color:#1a2f5e;margin-bottom:3px}
  .inst-sub{font-size:8.5pt;color:#6b7280}
  .steps{display:flex;gap:0;margin-top:18px;background:#f4f6fb;border-radius:10px;padding:12px 20px;width:100%;max-width:440px}
  .step{flex:1;text-align:center;position:relative}
  .step:not(:last-child)::after{content:'→';position:absolute;right:-6px;top:10px;color:#9ca3af;font-size:11pt}
  .step-n{width:26px;height:26px;background:#1a2f5e;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:800;margin:0 auto 4px}
  .step-t{font-size:7.5pt;color:#4b5563;line-height:1.4;font-weight:600}
  .footer{background:#f4f6fb;border-top:1px solid #e8edf2;padding:10px 32px;display:flex;justify-content:space-between;align-items:center}
  .footer span{font-size:7.5pt;color:#9ca3af}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="page">
  <div class="header">
    <img class="logo" src="/poj-logo.png" alt="" onerror="this.style.display='none'" />
    <div style="flex:1">
      <div class="church-name">Presence of Jesus Ministry</div>
      <div class="church-sub">Tuticorin, Tamil Nadu, India</div>
      ${vbsYear ? `<div class="vbs-tag">Vacation Bible School ${vbsYear}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:8pt;opacity:.6;margin-bottom:3px">Attendance System</div>
      <div style="font-size:11pt;font-weight:700;color:#c8922a">QR Check-In</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="session-info">
    <div>
      <div class="session-label">${labelText}</div>
      <div class="session-date">📅 ${dateStr}</div>
    </div>
    <div style="text-align:right">
      <span class="active-pill">● Active Session</span>
      ${expiryStr ? `<div class="expiry">Expires at ${expiryStr} IST</div>` : ''}
    </div>
  </div>
  ${windowInfo ? `
  <div class="time-window">
    <div class="tw-icon">⏱️</div>
    <div>
      <div class="tw-title">Attendance Time Window</div>
      <div class="tw-detail">${windowInfo}</div>
      <div class="tw-detail" style="margin-top:3px;font-size:8pt;color:#92400e">Scans after the on-time cutoff will be recorded as <strong>Late</strong></div>
    </div>
  </div>` : ''}
  <div class="qr-section">
    <div class="scan-label">Scan to Mark Your Attendance</div>
    <div class="qr-frame">
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <img src="${qrDataUrl}" width="320" height="320" alt="QR Code" />
    </div>
    <div class="inst">
      <div class="inst-main">Point your phone camera at the QR code</div>
      <div class="inst-sub">The VBS app will open and mark your attendance automatically</div>
    </div>
    <div class="steps">
      ${[['1','Open VBS App'],['2','Tap QR Scan'],['3','Point Camera'],['4','Marked!']].map(([n,t])=>`<div class="step"><div class="step-n">${n}</div><div class="step-t">${t}</div></div>`).join('')}
    </div>
  </div>
  <div class="footer">
    <span>VBS Management System — Presence of Jesus Ministry</span>
    <span>Printed: ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</span>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* Time window status strip */}
      {onTimeUntil && !isExpired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 18px', borderRadius: 12,
            background: isInLateWindow ? '#fef9c3' : '#dcfce7',
            border: `1.5px solid ${isInLateWindow ? '#fbbf24' : '#86efac'}`,
            width: '100%', maxWidth: size + 40,
          }}>
          <AlarmClock size={16} color={isInLateWindow ? '#d97706' : '#16a34a'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isInLateWindow ? '#a16207' : '#15803d' }}>
              {isInLateWindow ? '⚠️ Late Window Active' : '✓ On-Time Window Active'}
            </div>
            <div style={{ fontSize: '0.68rem', color: isInLateWindow ? '#a16207' : '#15803d', opacity: 0.85 }}>
              {isInLateWindow
                ? `Scans now will be marked as LATE`
                : `On-time until ${sessionData?.onTimeUntilTimeStr || ''} IST`}
            </div>
          </div>
          <ScanStatusBadge status={isInLateWindow ? 'late' : 'present'} size="sm" />
        </motion.div>
      )}

      {/* QR Frame */}
      <div style={{
        position: 'relative', padding: 16,
        background: isExpired ? '#fee2e2' : 'white',
        borderRadius: 20,
        boxShadow: isExpired
          ? '0 0 0 4px #dc2626, 0 8px 32px rgba(220,38,38,.2)'
          : isInLateWindow
          ? '0 0 0 4px #d97706, 0 8px 32px rgba(217,119,6,.25)'
          : '0 0 0 4px #1a2f5e, 0 8px 32px rgba(26,47,94,.2)',
        transition: 'all 0.4s',
        filter: isExpired ? 'grayscale(.8) opacity(.6)' : 'none',
      }}>
        {/* Animated corner accents */}
        {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
          <motion.div key={pos}
            animate={!isExpired ? { opacity: [1, 0.4, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, delay: pos.includes('right') ? 1 : 0 }}
            style={{
              position: 'absolute', width: 24, height: 24,
              [pos.includes('top') ? 'top' : 'bottom']: -2,
              [pos.includes('left') ? 'left' : 'right']: -2,
              borderTop: pos.includes('top') ? `3px solid ${isInLateWindow ? '#d97706' : '#c8922a'}` : 'none',
              borderBottom: pos.includes('bottom') ? `3px solid ${isInLateWindow ? '#d97706' : '#c8922a'}` : 'none',
              borderLeft: pos.includes('left') ? `3px solid ${isInLateWindow ? '#d97706' : '#c8922a'}` : 'none',
              borderRight: pos.includes('right') ? `3px solid ${isInLateWindow ? '#d97706' : '#c8922a'}` : 'none',
              borderRadius: pos === 'top-left' ? '6px 0 0 0' : pos === 'top-right' ? '0 6px 0 0' : pos === 'bottom-left' ? '0 0 0 6px' : '0 0 6px 0',
            }}
          />
        ))}

        {qrDataUrl
          ? <img src={qrDataUrl} alt="QR Code" width={size} height={size} style={{ display: 'block', borderRadius: 8 }} />
          : <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafd', borderRadius: 8 }}>
              <Loader2 size={40} color="#1a2f5e" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        }

        {isExpired && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(220,38,38,.15)', borderRadius: 12, flexDirection: 'column', gap: 8 }}>
            <XCircle size={48} color="#dc2626" />
            <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.1rem' }}>EXPIRED</span>
          </div>
        )}
      </div>

      {/* Countdown Timer */}
      {!isExpired && expiresAt && (
        <motion.div
          animate={urgency === 'crit' ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 22px', borderRadius: 99,
            background: `${timerColor}15`, border: `2px solid ${timerColor}40`,
          }}>
          <Timer size={16} color={timerColor} />
          <span style={{ fontWeight: 800, fontSize: '1.35rem', color: timerColor, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.73rem', color: timerColor, fontWeight: 600 }}>
            {isInLateWindow ? 'late window' : 'remaining'}
          </span>
        </motion.div>
      )}

      {/* Action Buttons */}
      {!isExpired && qrDataUrl && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => { const a = document.createElement('a'); a.href = qrDataUrl; a.download = `qr-${sessionData?.vbsYear || 'vbs'}.png`; a.click(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1.5px solid var(--color-border)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            <Download size={13} /> Download
          </button>
          <button
            onClick={() => handlePrint(sessionData)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, border: '1.5px solid #1a2f5e', background: '#1a2f5e', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
            <Printer size={13} /> Print PDF
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─── Time Window Config Component ──────────────────────────────── */
function TimeWindowConfig({ windowStartTime, onTimeUntilTime, onExpiryMinutes, expiryMinutes, onChange }) {
  const [enabled, setEnabled] = useState(!!onTimeUntilTime);

  const handleToggle = (val) => {
    setEnabled(val);
    if (!val) {
      onChange({ windowStartTime: '', onTimeUntilTime: '' });
    } else {
      // Default: window opens now, on-time until 30 mins from now
      const now = getCurrentISTTime();
      const [h, m] = now.split(':').map(Number);
      const lateH = String(h + Math.floor((m + 30) / 60)).padStart(2, '0');
      const lateM = String((m + 30) % 60).padStart(2, '0');
      onChange({
        windowStartTime: now,
        onTimeUntilTime: `${lateH}:${lateM}`,
      });
    }
  };

  return (
    <div style={{
      border: `1.5px solid ${enabled ? '#1a2f5e' : 'var(--color-border)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header toggle */}
      <div
        style={{
          padding: '12px 16px',
          background: enabled ? 'rgba(26,47,94,0.06)' : 'var(--color-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => handleToggle(!enabled)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlarmClock size={16} color={enabled ? '#1a2f5e' : 'var(--color-text-muted)'} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.845rem', color: enabled ? '#1a2f5e' : 'var(--color-text)' }}>
              Attendance Time Window
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>
              Define on-time vs. late threshold for this session
            </div>
          </div>
        </div>
        {/* Toggle switch */}
        <div
          style={{
            width: 44, height: 24, borderRadius: 99,
            background: enabled ? '#1a2f5e' : '#e2e8f0',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%', background: 'white',
            position: 'absolute', top: 3,
            left: enabled ? 23 : 3,
            transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </div>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
              {/* Info callout */}
              <div style={{
                display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8,
                background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 14,
                fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.5,
              }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  Scans <strong>at or before</strong> the on-time cutoff → <strong style={{ color: '#15803d' }}>Present</strong>.
                  Scans <strong>after</strong> the cutoff (but before expiry) → <strong style={{ color: '#a16207' }}>Late</strong>.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Session opens */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Session Opens (IST)
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={windowStartTime}
                    onChange={e => onChange({ windowStartTime: e.target.value })}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                    Informational — when attendance opens
                  </div>
                </div>

                {/* On-time until */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    <AlarmClock size={12} style={{ marginRight: 4, verticalAlign: 'middle', color: '#d97706' }} />
                    On-Time Until (IST) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={onTimeUntilTime}
                    onChange={e => onChange({ onTimeUntilTime: e.target.value })}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                      borderColor: '#fbbf24', background: '#fffbeb',
                    }}
                  />
                  <div style={{ fontSize: '0.67rem', color: '#a16207', marginTop: 3, fontWeight: 600 }}>
                    After this → marked Late
                  </div>
                </div>
              </div>

              {/* Visual timeline */}
              {windowStartTime && onTimeUntilTime && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fafd', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Timeline Preview
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <div style={{ padding: '4px 10px', borderRadius: '6px 0 0 6px', background: '#dcfce7', border: '1.5px solid #86efac', fontSize: '0.72rem', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                      ✓ Present<br />
                      <span style={{ fontWeight: 400, fontSize: '0.65rem' }}>{windowStartTime} – {onTimeUntilTime}</span>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: '0 6px 6px 0', background: '#fef9c3', border: '1.5px solid #fbbf24', borderLeft: 'none', fontSize: '0.72rem', fontWeight: 700, color: '#a16207', whiteSpace: 'nowrap' }}>
                      ⏰ Late<br />
                      <span style={{ fontWeight: 400, fontSize: '0.65rem' }}>{onTimeUntilTime} – expiry</span>
                    </div>
                    <div style={{ padding: '4px 10px', background: '#fee2e2', border: '1.5px solid #fca5a5', borderLeft: 'none', borderRadius: '0 6px 6px 0', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', whiteSpace: 'nowrap' }}>
                      ✕ Expired
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Live Scans Feed ────────────────────────────────────────────── */
function LiveScansFeed({ sessionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['qr-session-live', sessionId],
    queryFn: () => qrAPI.getSession(sessionId).then(r => r.data?.data),
    refetchInterval: 4000,
    enabled: !!sessionId,
  });

  if (isLoading) return <div className="loading-center" style={{ padding: 20 }}><div className="spinner" /></div>;
  if (!data) return null;

  const scans = data.scans || [];
  const presentCount = scans.filter(s => s.status === 'present').length;
  const lateCount = scans.filter(s => s.status === 'late').length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Scans', value: scans.length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Present', value: presentCount, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Late', value: lateCount, color: '#d97706', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 80, padding: '10px 12px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Time window info */}
      {data.onTimeUntilTimeStr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 12, fontSize: '0.75rem', color: '#92400e' }}>
          <AlarmClock size={13} />
          <span>On-time cutoff: <strong>{data.onTimeUntilTimeStr} IST</strong></span>
          <ArrowRight size={11} style={{ opacity: 0.5 }} />
          <span>After this → <strong>Late</strong></span>
        </div>
      )}

      {/* Scan list */}
      {scans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: '0.82rem' }}>
          <ScanLine size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.35 }} />
          Waiting for teachers to scan…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto' }}>
          <AnimatePresence initial={false}>
            {[...scans].reverse().map((scan, i) => (
              <motion.div
                key={scan._id || i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 10,
                  background: scan.status === 'present' ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${scan.status === 'present' ? '#bbf7d0' : '#fde68a'}`,
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: scan.status === 'present' ? '#16a34a' : '#d97706',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {scan.status === 'present'
                    ? <Check size={15} color="white" />
                    : <Clock size={15} color="white" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.845rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scan.teacherName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 1 }}>
                    {scan.scannedAtTimeStr || scan.arrivalTime} · {fmtTime(scan.scannedAt)}
                  </div>
                </div>
                <ScanStatusBadge status={scan.status} size="sm" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─── QR Scanner Camera ──────────────────────────────────────────── */
function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const [error, setError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [mode, setMode] = useState('camera');
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !window.jsQR) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const v = videoRef.current;
    if (v.readyState !== v.HAVE_ENOUGH_DATA) { animRef.current = requestAnimationFrame(scanFrame); return; }
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    ctx.drawImage(v, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) { stopCamera(); onScan(code.data); }
    else animRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setScanning(true); }
    } catch { setError('Camera access denied. Use manual entry.'); setMode('manual'); }
  }, []);

  useEffect(() => {
    if (!window.jsQR) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = () => { if (mode === 'camera') startCamera(); };
      document.head.appendChild(s);
    } else if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (scanning) animRef.current = requestAnimationFrame(scanFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [scanning, scanFrame]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 420 }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanLine size={20} color="#fbbf24" /> Scan QR Code
        </div>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 3, gap: 2 }}>
        {[['camera','📷 Camera'],['manual','⌨️ Manual']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); m === 'camera' ? startCamera() : stopCamera(); }}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.77rem', fontWeight: 600, background: mode === m ? 'white' : 'transparent', color: mode === m ? '#1a2f5e' : 'rgba(255,255,255,0.7)', transition: 'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'camera' ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 18, overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '62%', aspectRatio: '1' }}>
              {['tl','tr','bl','br'].map(c => (
                <div key={c} style={{ position: 'absolute', width: 26, height: 26, top: c.includes('t') ? 0 : 'auto', bottom: c.includes('b') ? 0 : 'auto', left: c.includes('l') ? 0 : 'auto', right: c.includes('r') ? 0 : 'auto', borderTop: c.includes('t') ? '3px solid #fbbf24' : 'none', borderBottom: c.includes('b') ? '3px solid #fbbf24' : 'none', borderLeft: c.includes('l') ? '3px solid #fbbf24' : 'none', borderRight: c.includes('r') ? '3px solid #fbbf24' : 'none', borderRadius: c === 'tl' ? '6px 0 0 0' : c === 'tr' ? '0 6px 0 0' : c === 'bl' ? '0 0 0 6px' : '0 0 6px 0' }} />
              ))}
            </div>
          </div>
          {error && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', flexDirection: 'column', gap: 8, padding: 20 }}><AlertTriangle size={32} color="#fbbf24" /><p style={{ color: 'white', textAlign: 'center', fontSize: '.82rem' }}>{error}</p></div>}
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,.05)', borderRadius: 16, padding: 24 }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,.7)', fontSize: '.75rem', fontWeight: 600, marginBottom: 8 }}>Paste QR Token</label>
          <textarea value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="QR_ATTENDANCE:..." rows={3}
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.1)', border: '1.5px solid rgba(255,255,255,.2)', borderRadius: 10, color: 'white', fontFamily: 'var(--font-mono)', fontSize: '.75rem', resize: 'none', outline: 'none' }} />
          <button onClick={() => { if (manualToken.trim()) { stopCamera(); onScan(manualToken.trim()); } }} disabled={!manualToken.trim()}
            style={{ width: '100%', marginTop: 10, padding: 11, borderRadius: 10, border: 'none', background: manualToken.trim() ? '#fbbf24' : 'rgba(255,255,255,.1)', color: manualToken.trim() ? '#1a1a1a' : 'rgba(255,255,255,.4)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '.875rem', cursor: manualToken.trim() ? 'pointer' : 'not-allowed' }}>
            Submit Token
          </button>
        </div>
      )}
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '.75rem' }}>Point camera at QR code to scan</p>
    </div>
  );
}

/* ─── Scan Result Modal ──────────────────────────────────────────── */
function ScanResultModal({ result, onClose }) {
  if (!result) return null;
  const isSuccess = result.success;
  const status = result.data?.status;
  const isLate = status === 'late';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div initial={{ scale: .85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .85 }} onClick={e => e.stopPropagation()}
          style={{ background: 'white', borderRadius: 24, padding: 36, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

          {/* Icon */}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            style={{
              width: 76, height: 76, borderRadius: '50%',
              background: isSuccess ? (isLate ? '#fef9c3' : '#dcfce7') : '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
            {isSuccess
              ? (isLate ? <Clock size={36} color="#d97706" /> : <CheckCircle size={36} color="#16a34a" />)
              : <XCircle size={36} color="#dc2626" />}
          </motion.div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: isSuccess ? (isLate ? '#a16207' : '#15803d') : '#991b1b' }}>
            {isSuccess ? (isLate ? '⏰ Marked as Late' : '✓ Attendance Marked!') : 'Scan Failed'}
          </h2>

          {isSuccess && result.data && (
            <div style={{ margin: '14px 0' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                {result.data.teacherName}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <ScanStatusBadge status={status} size="lg" />
                <span style={{ padding: '5px 12px', borderRadius: 99, background: '#dbeafe', color: '#1e40af', fontSize: '0.82rem', fontWeight: 700 }}>
                  🕐 {result.data.arrivalTimeFull || result.data.arrivalTime}
                </span>
              </div>

              {/* Time window context */}
              {result.data.onTimeUntilTimeStr && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: isLate ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${isLate ? '#fde68a' : '#bbf7d0'}`,
                  fontSize: '0.75rem', color: isLate ? '#a16207' : '#15803d',
                  marginBottom: 8,
                }}>
                  <AlarmClock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {isLate
                    ? `On-time cutoff was ${result.data.onTimeUntilTimeStr} IST`
                    : `Arrived within on-time window (before ${result.data.onTimeUntilTimeStr})`}
                </div>
              )}

              {result.data.sessionLabel && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{result.data.sessionLabel}</div>
              )}
            </div>
          )}

          {!isSuccess && <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 16 }}>{result.message}</p>}

          <button onClick={onClose}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: isSuccess ? (isLate ? '#d97706' : '#16a34a') : '#dc2626', color: 'white', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
            {isSuccess ? 'Done!' : 'Try Again'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Admin: Generate QR Panel ───────────────────────────────────── */
function AdminQRGenerator({ vbsYear, activeSettings }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(getTodayIST());
  const [label, setLabel] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(60);
  // Time window state
  const [timeWindowConfig, setTimeWindowConfig] = useState({
    windowStartTime: '',
    onTimeUntilTime: '',
  });
  const [activeSession, setActiveSession] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const { data: sessions } = useQuery({
    queryKey: ['qr-sessions', date, vbsYear],
    queryFn: () => qrAPI.getSessions({ date, vbsYear }).then(r => r.data?.data || []),
    refetchInterval: activeSession ? 6000 : false,
  });

  const createMut = useMutation({
    mutationFn: () => qrAPI.createSession({
      date, label, expiryMinutes,
      windowStartTime: timeWindowConfig.windowStartTime || undefined,
      onTimeUntilTime: timeWindowConfig.onTimeUntilTime || undefined,
    }),
    onSuccess: (res) => {
      const session = res.data?.data;
      setActiveSession(session);
      qc.invalidateQueries(['qr-sessions']);
      toast.success('QR session created!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create QR'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => qrAPI.deactivate(id),
    onSuccess: () => { setActiveSession(null); qc.invalidateQueries(['qr-sessions']); toast.success('Session deactivated'); },
  });

  const handleScan = useCallback(async (token) => {
    setShowScanner(false);
    try { const res = await qrAPI.scan(token); setScanResult(res.data); }
    catch (err) { setScanResult({ success: false, message: err.response?.data?.message || 'Scan failed' }); }
  }, []);

  const handleTimeWindowChange = (updates) => {
    setTimeWindowConfig(prev => ({ ...prev, ...updates }));
  };

  return (
    <div>
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {scanResult && <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: activeSession ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* Generator Form */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode size={17} color="#1a2f5e" /> New QR Session
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowScanner(true)} title="Test scan">
              <Camera size={14} /> Test
            </button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Date */}
            <DateInput
              label="Attendance Date"
              value={date}
              onChange={setDate}
              vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
              vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)}
              showVBSDays
            />

            {/* Label */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Session Label <span className="optional">(optional)</span></label>
              <input className="form-input" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g., Morning Roll Call — Day 3" />
            </div>

            {/* Expiry */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">QR Code Expires After</label>
              <select className="form-select" value={expiryMinutes} onChange={e => setExpiryMinutes(Number(e.target.value))}>
                {[10, 15, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>
                ))}
              </select>
            </div>

            {/* ── Time Window Config ── */}
            <TimeWindowConfig
              windowStartTime={timeWindowConfig.windowStartTime}
              onTimeUntilTime={timeWindowConfig.onTimeUntilTime}
              expiryMinutes={expiryMinutes}
              onChange={handleTimeWindowChange}
            />

            <button
              className="btn btn-primary"
              style={{ justifyContent: 'center', height: 44 }}
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !date}
            >
              {createMut.isPending
                ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</>
                : <><QrCode size={16} /> Generate QR Code</>}
            </button>
          </div>
        </div>

        {/* Active Session QR */}
        {activeSession && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e' }}
                />
                Active Session
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => deactivateMut.mutate(activeSession._id)}
                disabled={deactivateMut.isPending} style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                <Square size={12} /> Stop
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280' }}>{activeSession.label}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a2f5e' }}>{fmtDate(activeSession.date)}</div>
              <QRCodeDisplay
                value={activeSession.qrPayload}
                size={220}
                label={activeSession.label}
                expiresAt={activeSession.expiresAt}
                onTimeUntil={activeSession.onTimeUntil}
                sessionData={activeSession}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Live Feed */}
      {activeSession && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              Live Attendance Feed
            </span>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Refreshes every 4s</span>
          </div>
          <div className="card-body">
            <LiveScansFeed sessionId={activeSession._id} />
          </div>
        </div>
      )}

      {/* Session History */}
      {(sessions || []).length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">Session History — {fmtDate(date)}</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>On-Time Until</th>
                  <th>Expires</th>
                  <th>✓ Present</th>
                  <th>⏰ Late</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const isExpired = new Date() > new Date(s.expiresAt);
                  const isActive = s.isActive && !isExpired;
                  const presentScans = (s.scans || []).filter(sc => sc.status === 'present').length;
                  const lateScans = (s.scans || []).filter(sc => sc.status === 'late').length;
                  return (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600, fontSize: '0.845rem' }}>{s.label}</td>
                      <td>
                        {s.onTimeUntilTimeStr
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: '#fef9c3', color: '#a16207', fontSize: '0.72rem', fontWeight: 700 }}>
                              <AlarmClock size={10} /> {s.onTimeUntilTimeStr}
                            </span>
                          : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>— legacy 30min</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.78rem', color: isExpired ? '#dc2626' : '#16a34a' }}>{fmtTime(s.expiresAt)}</td>
                      <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{presentScans}</span></td>
                      <td><span style={{ color: '#d97706', fontWeight: 700 }}>{lateScans}</span></td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-green' : isExpired ? 'badge-red' : 'badge-gray'}`}>
                          {isActive ? '● Active' : isExpired ? 'Expired' : 'Stopped'}
                        </span>
                      </td>
                      <td>
                        {isActive && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm"
                              onClick={() => setActiveSession({ ...s, qrPayload: `QR_ATTENDANCE:${s.token}` })}>
                              <Eye size={12} /> View
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }}
                              onClick={() => deactivateMut.mutate(s._id)}>
                              <Square size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Teacher: QR Scan Page ──────────────────────────────────────── */
function TeacherQRScanner() {
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [previewSession, setPreviewSession] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const scanMut = useMutation({
    mutationFn: (token) => qrAPI.scan(token),
    onSuccess: (res) => { setScanResult(res.data); setShowScanner(false); },
    onError: (err) => { setScanResult({ success: false, message: err.response?.data?.message || 'Scan failed' }); setShowScanner(false); },
  });

  const handleScan = useCallback(async (token) => {
    setShowScanner(false);
    // Preview the session first before submitting
    setPreviewLoading(true);
    try {
      const clean = token.startsWith('QR_ATTENDANCE:') ? token.slice(14) : token;
      const res = await qrAPI.validate(clean);
      setPreviewSession({ ...res.data?.data, rawToken: token });
    } catch (err) {
      // If validation fails, just try to scan directly
      scanMut.mutate(token);
    } finally {
      setPreviewLoading(false);
    }
  }, [scanMut]);

  const confirmScan = () => {
    if (previewSession?.rawToken) {
      scanMut.mutate(previewSession.rawToken);
      setPreviewSession(null);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {scanResult && <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} />}

      {/* Preview Modal — shows what status scan will get */}
      <AnimatePresence>
        {previewSession && !scanMut.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ scale: .9 }} animate={{ scale: 1 }} exit={{ scale: .9 }}
              style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1a2f5e', marginBottom: 16 }}>
                Confirm Attendance
              </div>

              <div style={{ padding: '14px 16px', background: '#f8fafd', borderRadius: 12, marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a2f5e', marginBottom: 6 }}>
                  {previewSession.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fmtDate(previewSession.date)}</div>
              </div>

              {/* Projected status */}
              <div style={{
                padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                background: previewSession.projectedStatus === 'present' ? '#f0fdf4' : '#fffbeb',
                border: `1.5px solid ${previewSession.projectedStatus === 'present' ? '#86efac' : '#fbbf24'}`,
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                  Your attendance will be recorded as:
                </div>
                <ScanStatusBadge status={previewSession.projectedStatus || 'present'} size="lg" />
                {previewSession.hasTimeWindow && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#9ca3af' }}>
                    {previewSession.projectedStatus === 'late'
                      ? `On-time cutoff was ${previewSession.onTimeUntilTimeStr} IST`
                      : `On-time window: until ${previewSession.onTimeUntilTimeStr} IST`}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setPreviewSession(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={confirmScan} disabled={scanMut.isPending}>
                  {scanMut.isPending
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Marking…</>
                    : <><Check size={14} /> Confirm</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a2f5e 0%, #2a4a8e 50%, #1a2f5e 100%)',
          padding: '36px 28px', textAlign: 'center', position: 'relative',
        }}>
          {[120, 180, 240].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: '1px solid rgba(255,255,255,.06)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 1 }}>
            <QrCode size={40} color="#fbbf24" />
          </motion.div>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', marginBottom: 6, position: 'relative', zIndex: 1 }}>Mark Your Attendance</h2>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.845rem', position: 'relative', zIndex: 1 }}>
            Scan the QR code displayed by your admin
          </p>
        </div>

        <div className="card-body" style={{ padding: 28 }}>
          {/* Steps */}
          <div style={{ marginBottom: 24 }}>
            {[
              { step: 1, text: 'Admin generates a QR code for today' },
              { step: 2, text: 'Tap "Scan QR Code" and point camera' },
              { step: 3, text: 'Preview your status before confirming' },
              { step: 4, text: 'Attendance recorded — Present or Late!' },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#1a2f5e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>{step}</div>
                <span style={{ fontSize: '0.845rem', color: '#374151' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Info box for time windows */}
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 20, fontSize: '0.78rem', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlarmClock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>On-Time Window:</strong> Scan within the admin-set window for Present.
              Late arrivals are still recorded — just marked as Late.
            </div>
          </div>

          <button className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: 52, fontSize: '1rem', fontWeight: 800, borderRadius: 14, boxShadow: '0 4px 20px rgba(26,47,94,.3)' }}
            onClick={() => setShowScanner(true)}
            disabled={scanMut.isPending || previewLoading}>
            {(scanMut.isPending || previewLoading)
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> {previewLoading ? 'Checking…' : 'Processing…'}</>
              : <><Camera size={20} /> Scan QR Code</>}
          </button>

          <button onClick={() => setShowManual(!showManual)}
            style={{ width: '100%', marginTop: 10, padding: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ChevronDown size={13} style={{ transform: showManual ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            Can't scan? Enter token manually
          </button>

          <AnimatePresence>
            {showManual && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ paddingTop: 12 }}>
                  <input className="form-input" value={manualToken} onChange={e => setManualToken(e.target.value)}
                    placeholder="Paste QR_ATTENDANCE:... token"
                    style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} />
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => { if (manualToken.trim()) handleScan(manualToken.trim()); }}
                    disabled={!manualToken.trim() || scanMut.isPending}>
                    Submit Token
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Session History Tab ────────────────────────────────────────── */
function QRSessionHistory({ vbsYear, activeSettings }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [expandedSession, setExpandedSession] = useState(null);

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['qr-sessions-all', selectedDate, vbsYear],
    queryFn: () => qrAPI.getSessions({ date: selectedDate || undefined, vbsYear }).then(r => r.data?.data || []),
  });

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <DateInput label="Filter by Date (optional)" value={selectedDate} onChange={setSelectedDate}
            vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
            vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)} showVBSDays />
        </div>
        {selectedDate && <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate('')} style={{ marginBottom: 1 }}>✕ Clear</button>}
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()} style={{ marginBottom: 1 }}><RefreshCw size={13} /></button>
      </div>

      {!sessions?.length ? (
        <div className="empty-state"><QrCode size={36} style={{ color: 'var(--color-text-muted)' }} /><h3>No QR sessions found</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => {
            const isExpired = new Date() > new Date(s.expiresAt);
            const isActive = s.isActive && !isExpired;
            const isExpanded = expandedSession === s._id;
            const presentScans = (s.scans || []).filter(sc => sc.status === 'present').length;
            const lateScans = (s.scans || []).filter(sc => sc.status === 'late').length;

            return (
              <div key={s._id} className="card">
                <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpandedSession(isExpanded ? null : s._id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: isActive ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={18} color={isActive ? '#16a34a' : '#9ca3af'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 1 }}>
                        {fmtDate(s.date)} · Created {fmtTime(s.createdAt)}
                        {s.onTimeUntilTimeStr && (
                          <span style={{ marginLeft: 6, color: '#a16207', fontWeight: 600 }}>
                            · ⏱ On-time until {s.onTimeUntilTimeStr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>{presentScans} ✓</span>
                    <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.82rem' }}>{lateScans} ⏰</span>
                    <span className={`badge ${isActive ? 'badge-green' : isExpired ? 'badge-red' : 'badge-gray'}`}>
                      {isActive ? '● Active' : isExpired ? 'Expired' : 'Stopped'}
                    </span>
                    <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: '#9ca3af' }} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                        {/* Session meta */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                          {[
                            { label: 'Total Scans', value: s.scans?.length || 0, color: '#3b82f6' },
                            { label: 'Present', value: presentScans, color: '#16a34a' },
                            { label: 'Late', value: lateScans, color: '#d97706' },
                            { label: 'Expired', value: fmtTime(s.expiresAt), color: '#9ca3af' },
                          ].map(stat => (
                            <div key={stat.label} style={{ flex: 1, minWidth: 70, padding: '8px 10px', background: '#f8fafd', borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontWeight: 800, color: stat.color, fontSize: typeof stat.value === 'number' ? '1.2rem' : '0.75rem' }}>{stat.value}</div>
                              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginTop: 1 }}>{stat.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Time window badge */}
                        {s.onTimeUntilTimeStr && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 12, fontSize: '0.75rem', color: '#92400e' }}>
                            <AlarmClock size={13} />
                            <span>On-time cutoff: <strong>{s.onTimeUntilTimeStr} IST</strong></span>
                            {s.windowStartTime && <span style={{ opacity: 0.7 }}>· Opens: {s.windowStartTime}</span>}
                          </div>
                        )}

                        {/* Scans table */}
                        {s.scans?.length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr>
                                {['Teacher', 'Status', 'Arrival Time', 'Scanned At'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', background: '#f8fafd', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {s.scans.map((scan, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{scan.teacherName}</td>
                                  <td style={{ padding: '8px 10px' }}><ScanStatusBadge status={scan.status} /></td>
                                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#6b7280' }}>{scan.arrivalTime || '—'}</td>
                                  <td style={{ padding: '8px 10px', fontSize: '0.75rem', color: '#9ca3af' }}>{fmtTime(scan.scannedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: '0.82rem' }}>No scans recorded</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────── */
export default function QRAttendancePage() {
  const { user } = useAuth();
  const { vbsYear, activeYear } = useActiveYear();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const { data: activeSettings } = useQuery({
    queryKey: ['active-settings'],
    queryFn: () => api.get('/settings/active').then(r => r.data?.data),
  });

  const [tab, setTab] = useState(isAdmin ? 'generate' : 'scan');

  if (!vbsYear && isAdmin) {
    return (
      <div className="empty-state">
        <QrCode size={36} style={{ color: 'var(--color-text-muted)' }} />
        <h3>No VBS Year Selected</h3>
        <p>Select a VBS year to generate QR codes for attendance.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <QrCode size={26} color="#1a2f5e" /> QR Attendance
          </h1>
          <p className="page-subtitle">
            {isAdmin
              ? `Generate QR codes with on-time/late windows · VBS ${vbsYear}`
              : 'Scan QR code to mark your attendance'}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
            <Shield size={14} /> {activeYear?.vbsTitle || `VBS ${vbsYear}`}
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[
            { id: 'generate', icon: QrCode,   label: '🖨️ Generate QR', desc: 'Create & configure' },
            { id: 'history',  icon: Calendar, label: '📋 History',     desc: 'Past sessions' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', padding: '10px 18px',
                borderRadius: 12,
                border: `1.5px solid ${tab === t.id ? '#1a2f5e' : '#e2e8f0'}`,
                background: tab === t.id ? '#1a2f5e' : 'white',
                color: tab === t.id ? 'white' : '#4b5563',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .15s', textAlign: 'left',
              }}>
              <span style={{ fontWeight: 700, fontSize: '0.845rem' }}>{t.label}</span>
              <span style={{ fontSize: '0.68rem', opacity: .7, marginTop: 1 }}>{t.desc}</span>
            </button>
          ))}
        </div>
      )}

      {isTeacher && <TeacherQRScanner />}
      {isAdmin && tab === 'generate' && <AdminQRGenerator vbsYear={vbsYear} activeSettings={activeSettings} />}
      {isAdmin && tab === 'history'  && <QRSessionHistory vbsYear={vbsYear} activeSettings={activeSettings} />}
    </div>
  );
}
