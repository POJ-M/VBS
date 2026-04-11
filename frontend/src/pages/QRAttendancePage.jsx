import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Clock, CheckCircle, XCircle, Users, RefreshCw,
  Zap, Shield, AlertTriangle, Camera, X, ChevronDown,
  Download, Eye, EyeOff, Play, Square, Loader2, Check,
  Calendar, ScanLine, UserCheck, Timer, Printer
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { LoadingPage } from '../components/common';
import DateInput from '../components/Dateinput';
import toast from 'react-hot-toast';

/* ─── API helpers ──────────────────────────────────────────────────── */
const qrAPI = {
  createSession: (data) => api.post('/qr-attendance/sessions', data),
  getSessions: (params) => api.get('/qr-attendance/sessions', { params }),
  getSession: (id) => api.get(`/qr-attendance/sessions/${id}`),
  deactivate: (id) => api.put(`/qr-attendance/sessions/${id}/deactivate`),
  scan: (token) => api.post('/qr-attendance/scan', { token }),
  adminScan: (data) => api.post('/qr-attendance/admin-scan', data),
  validate: (token) => api.get(`/qr-attendance/validate/${token}`),
};

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

/* ─── QR Code Display Component ───────────────────────────────────── */
function QRCodeDisplay({ value, size = 280, label, expiresAt }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(0);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1a2f5e&margin=2&format=png`;

  useEffect(() => { setQrDataUrl(qrUrl); }, [value, size]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setCountdown(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const isExpired = countdown === 0 && expiresAt;
  const urgency = countdown < 60 ? 'danger' : countdown < 180 ? 'warning' : 'ok';
  const countdownColor = { ok: '#16a34a', warning: '#d97706', danger: '#dc2626' }[urgency];

  /* ─── Branded PDF Export ─────────────────────────────────────────── */
  const handleExport = (sessionData) => {
    if (!qrDataUrl) { toast.error('QR not loaded yet, please wait'); return; }

    const dateStr = fmtDateLong(sessionData?.date || new Date());
    const labelText = sessionData?.label || label || 'Attendance QR';
    const expiryStr = sessionData?.expiresAt ? fmtTime(sessionData.expiresAt) : '';
    const vbsYear = sessionData?.vbsYear || '';

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>QR Attendance — ${labelText}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: white; color: #111; }

  .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; padding: 0; }

  /* Header */
  .header { background: #1a2f5e; color: white; padding: 20px 32px 18px; display: flex; align-items: center; gap: 16px; }
  .header img.logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px; }
  .header .org { flex: 1; }
  .header .church-name { font-size: 18pt; font-weight: 800; line-height: 1.2; }
  .header .church-sub { font-size: 9pt; opacity: 0.75; margin-top: 2px; }
  .header .vbs-tag { font-size: 10pt; font-weight: 700; color: #c8922a; margin-top: 4px; }

  /* Gold accent bar */
  .accent-bar { height: 6px; background: linear-gradient(90deg, #c8922a 0%, #e8b840 50%, #c8922a 100%); }

  /* Session info */
  .session-info { padding: 20px 32px 14px; border-bottom: 1px solid #e8edf2; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
  .session-label { font-size: 16pt; font-weight: 800; color: #1a2f5e; }
  .session-date { font-size: 11pt; color: #4b5563; margin-top: 3px; }
  .session-meta { text-align: right; }
  .meta-pill { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta-pill.active { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .expiry-text { font-size: 9pt; color: #6b7280; margin-top: 4px; }

  /* QR Section */
  .qr-section { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
  .qr-frame { position: relative; padding: 24px; background: white; border: 3px solid #1a2f5e; border-radius: 20px; box-shadow: 0 8px 40px rgba(26,47,94,0.15); }
  .qr-corner { position: absolute; width: 28px; height: 28px; }
  .qr-corner.tl { top: -3px; left: -3px; border-top: 4px solid #c8922a; border-left: 4px solid #c8922a; border-radius: 8px 0 0 0; }
  .qr-corner.tr { top: -3px; right: -3px; border-top: 4px solid #c8922a; border-right: 4px solid #c8922a; border-radius: 0 8px 0 0; }
  .qr-corner.bl { bottom: -3px; left: -3px; border-bottom: 4px solid #c8922a; border-left: 4px solid #c8922a; border-radius: 0 0 0 8px; }
  .qr-corner.br { bottom: -3px; right: -3px; border-bottom: 4px solid #c8922a; border-right: 4px solid #c8922a; border-radius: 0 0 8px 0; }
  .qr-frame img { display: block; border-radius: 8px; }

  .scan-instruction { margin-top: 20px; text-align: center; }
  .scan-instruction .step { font-size: 11pt; font-weight: 600; color: #1a2f5e; margin-bottom: 4px; }
  .scan-instruction .desc { font-size: 9pt; color: #6b7280; }

  /* Steps */
  .steps { display: flex; gap: 0; margin-top: 24px; background: #f4f6fb; border-radius: 12px; padding: 14px 20px; width: 100%; max-width: 480px; }
  .step-item { flex: 1; text-align: center; position: relative; }
  .step-item:not(:last-child)::after { content: '→'; position: absolute; right: -6px; top: 12px; color: #9ca3af; font-size: 12pt; }
  .step-num { width: 28px; height: 28px; background: #1a2f5e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 800; margin: 0 auto 5px; }
  .step-text { font-size: 7.5pt; color: #4b5563; line-height: 1.4; font-weight: 600; }

  /* Footer */
  .footer { background: #f4f6fb; border-top: 1px solid #e8edf2; padding: 12px 32px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 8pt; color: #9ca3af; }
  .footer-right { font-size: 8pt; color: #9ca3af; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head><body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <img class="logo" src="/poj-logo.png" alt="POJ Ministry" onerror="this.style.display='none'" />
    <div class="org">
      <div class="church-name">Presence of Jesus Ministry</div>
      <div class="church-sub">Tuticorin, Tamil Nadu, India</div>
      ${vbsYear ? `<div class="vbs-tag">Vacation Bible School ${vbsYear}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:9pt;opacity:0.6;margin-bottom:3px">Attendance System</div>
      <div style="font-size:11pt;font-weight:700;color:#c8922a">QR Check-In</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- Session Info -->
  <div class="session-info">
    <div>
      <div class="session-label">${labelText}</div>
      <div class="session-date">📅 ${dateStr}</div>
    </div>
    <div class="session-meta">
      <span class="meta-pill active">● Active Session</span>
      ${expiryStr ? `<div class="expiry-text">Expires at ${expiryStr}</div>` : ''}
    </div>
  </div>

  <!-- QR Code -->
  <div class="qr-section">
    <div style="font-size:9pt;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px">Scan to Mark Attendance</div>

    <div class="qr-frame">
      <div class="qr-corner tl"></div>
      <div class="qr-corner tr"></div>
      <div class="qr-corner bl"></div>
      <div class="qr-corner br"></div>
      <img src="${qrDataUrl}" width="320" height="320" alt="QR Code" />
    </div>

    <div class="scan-instruction">
      <div class="step">Point your phone camera at this QR code</div>
      <div class="desc">The QR attendance app will open automatically and mark your attendance</div>
    </div>

    <div class="steps">
      ${[['1', 'Open VBS App'], ['2', 'Tap QR Scan'], ['3', 'Point Camera'], ['4', 'Done!']].map(([n, t]) => `
        <div class="step-item">
          <div class="step-num">${n}</div>
          <div class="step-text">${t}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">VBS Management System — Presence of Jesus Ministry</div>
    <div class="footer-right">Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
  </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* QR Frame */}
      <div style={{
        position: 'relative', padding: 16,
        background: isExpired ? '#fee2e2' : 'white',
        borderRadius: 20,
        boxShadow: isExpired ? '0 0 0 4px #dc2626, 0 8px 32px rgba(220,38,38,0.2)' : '0 0 0 4px #1a2f5e, 0 8px 32px rgba(26,47,94,0.2)',
        transition: 'all 0.3s',
        filter: isExpired ? 'grayscale(0.8) opacity(0.6)' : 'none',
      }}>
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
          <div key={pos} style={{ position: 'absolute', width: 24, height: 24, [pos.includes('top') ? 'top' : 'bottom']: -2, [pos.includes('left') ? 'left' : 'right']: -2, borderTop: pos.includes('top') ? '3px solid #c8922a' : 'none', borderBottom: pos.includes('bottom') ? '3px solid #c8922a' : 'none', borderLeft: pos.includes('left') ? '3px solid #c8922a' : 'none', borderRight: pos.includes('right') ? '3px solid #c8922a' : 'none', borderRadius: pos === 'top-left' ? '6px 0 0 0' : pos === 'top-right' ? '0 6px 0 0' : pos === 'bottom-left' ? '0 0 0 6px' : '0 0 6px 0' }} />
        ))}
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" width={size} height={size} style={{ display: 'block', borderRadius: 8 }} onError={() => setQrDataUrl('')} />
        ) : (
          <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafd', borderRadius: 8 }}>
            <Loader2 size={40} color="#1a2f5e" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        {isExpired && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(220,38,38,0.15)', borderRadius: 12, flexDirection: 'column', gap: 8 }}>
            <XCircle size={48} color="#dc2626" />
            <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.1rem' }}>EXPIRED</span>
          </div>
        )}
      </div>

      {/* Countdown */}
      {!isExpired && expiresAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 99, background: `${countdownColor}15`, border: `2px solid ${countdownColor}40` }}>
          <Timer size={16} color={countdownColor} />
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: countdownColor, fontVariantNumeric: 'tabular-nums' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.75rem', color: countdownColor, fontWeight: 600 }}>remaining</span>
        </div>
      )}

      {/* Action buttons */}
      {!isExpired && qrDataUrl && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { const link = document.createElement('a'); link.href = qrDataUrl; link.download = `qr-${label || 'attendance'}.png`; link.click(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, color: '#4b5563', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafd'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <Download size={14} /> Download PNG
          </button>
          <button
            onClick={() => handleExport(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 10, border: '1.5px solid #1a2f5e', background: '#1a2f5e', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, color: 'white', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a4a8e'}
            onMouseLeave={e => e.currentTarget.style.background = '#1a2f5e'}
          >
            <Printer size={14} /> Print / Export PDF
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── We need an exportable version with session data ─────────────── */
function QRCodeDisplayWithExport({ value, size = 280, label, expiresAt, sessionData }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [countdown, setCountdown] = useState(0);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1a2f5e&margin=2&format=png`;

  useEffect(() => { setQrDataUrl(qrUrl); }, [value, size]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setCountdown(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const isExpired = countdown === 0 && expiresAt;
  const urgency = countdown < 60 ? 'danger' : countdown < 180 ? 'warning' : 'ok';
  const countdownColor = { ok: '#16a34a', warning: '#d97706', danger: '#dc2626' }[urgency];

  const handlePrintExport = () => {
    if (!qrDataUrl) { toast.error('QR image not loaded yet'); return; }
    const dateStr = fmtDateLong(sessionData?.date || new Date());
    const labelText = sessionData?.label || label || 'Attendance Session';
    const expiryStr = sessionData?.expiresAt ? fmtTime(sessionData.expiresAt) : '';
    const vbsYear = sessionData?.vbsYear || '';

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>QR Attendance — ${labelText}</title>
<style>
  @page{size:A4 portrait;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:white;color:#111}
  .page{width:210mm;min-height:297mm;display:flex;flex-direction:column}
  .header{background:#1a2f5e;color:white;padding:20px 32px 18px;display:flex;align-items:center;gap:16px}
  .logo{width:56px;height:56px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,0.15);padding:4px}
  .church-name{font-size:16pt;font-weight:800;line-height:1.2}
  .church-sub{font-size:9pt;opacity:0.75;margin-top:2px}
  .vbs-tag{font-size:9pt;font-weight:700;color:#c8922a;margin-top:3px}
  .accent-bar{height:6px;background:#c8922a}
  .session-info{padding:18px 32px 14px;border-bottom:1px solid #e8edf2;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .session-label{font-size:15pt;font-weight:800;color:#1a2f5e}
  .session-date{font-size:10pt;color:#4b5563;margin-top:3px}
  .active-pill{display:inline-block;padding:3px 12px;border-radius:99px;font-size:8pt;font-weight:700;text-transform:uppercase;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
  .qr-section{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px}
  .scan-label{font-size:9pt;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px}
  .qr-frame{position:relative;padding:20px;background:white;border:3px solid #1a2f5e;border-radius:20px;box-shadow:0 8px 40px rgba(26,47,94,0.15)}
  .qr-frame img{display:block;border-radius:8px}
  .corner{position:absolute;width:26px;height:26px}
  .tl{top:-3px;left:-3px;border-top:4px solid #c8922a;border-left:4px solid #c8922a;border-radius:6px 0 0 0}
  .tr{top:-3px;right:-3px;border-top:4px solid #c8922a;border-right:4px solid #c8922a;border-radius:0 6px 0 0}
  .bl{bottom:-3px;left:-3px;border-bottom:4px solid #c8922a;border-left:4px solid #c8922a;border-radius:0 0 0 6px}
  .br{bottom:-3px;right:-3px;border-bottom:4px solid #c8922a;border-right:4px solid #c8922a;border-radius:0 0 6px 0}
  .instructions{margin-top:18px;text-align:center}
  .inst-main{font-size:11pt;font-weight:600;color:#1a2f5e;margin-bottom:4px}
  .inst-sub{font-size:9pt;color:#6b7280}
  .steps{display:flex;gap:0;margin-top:22px;background:#f4f6fb;border-radius:12px;padding:12px 20px;width:100%;max-width:460px}
  .step{flex:1;text-align:center;position:relative}
  .step:not(:last-child)::after{content:'→';position:absolute;right:-6px;top:10px;color:#9ca3af;font-size:11pt}
  .step-n{width:26px;height:26px;background:#1a2f5e;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8.5pt;font-weight:800;margin:0 auto 4px}
  .step-t{font-size:7.5pt;color:#4b5563;line-height:1.4;font-weight:600}
  .footer{background:#f4f6fb;border-top:1px solid #e8edf2;padding:12px 32px;display:flex;justify-content:space-between;align-items:center}
  .footer span{font-size:8pt;color:#9ca3af}
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
      <div style="font-size:8pt;opacity:0.6;margin-bottom:3px">Attendance System</div>
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
      ${expiryStr ? `<div style="font-size:9pt;color:#6b7280;margin-top:4px">Expires at ${expiryStr}</div>` : ''}
    </div>
  </div>
  <div class="qr-section">
    <div class="scan-label">Scan to Mark Your Attendance</div>
    <div class="qr-frame">
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <img src="${qrDataUrl}" width="340" height="340" alt="QR Code" />
    </div>
    <div class="instructions">
      <div class="inst-main">Point your phone camera at this QR code</div>
      <div class="inst-sub">The VBS attendance app will open automatically</div>
    </div>
    <div class="steps">
      ${[['1','Open VBS App'],['2','Tap QR Scan'],['3','Point Camera'],['4','Marked!']].map(([n,t]) => `<div class="step"><div class="step-n">${n}</div><div class="step-t">${t}</div></div>`).join('')}
    </div>
  </div>
  <div class="footer">
    <span>VBS Management System — Presence of Jesus Ministry</span>
    <span>Printed: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* QR Frame */}
      <div style={{
        position: 'relative', padding: 16, background: isExpired ? '#fee2e2' : 'white', borderRadius: 20,
        boxShadow: isExpired ? '0 0 0 4px #dc2626, 0 8px 32px rgba(220,38,38,0.2)' : '0 0 0 4px #1a2f5e, 0 8px 32px rgba(26,47,94,0.2)',
        transition: 'all 0.3s', filter: isExpired ? 'grayscale(0.8) opacity(0.6)' : 'none',
      }}>
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
          <div key={pos} style={{ position: 'absolute', width: 24, height: 24, [pos.includes('top') ? 'top' : 'bottom']: -2, [pos.includes('left') ? 'left' : 'right']: -2, borderTop: pos.includes('top') ? '3px solid #c8922a' : 'none', borderBottom: pos.includes('bottom') ? '3px solid #c8922a' : 'none', borderLeft: pos.includes('left') ? '3px solid #c8922a' : 'none', borderRight: pos.includes('right') ? '3px solid #c8922a' : 'none', borderRadius: pos === 'top-left' ? '6px 0 0 0' : pos === 'top-right' ? '0 6px 0 0' : pos === 'bottom-left' ? '0 0 0 6px' : '0 0 6px 0' }} />
        ))}
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" width={size} height={size} style={{ display: 'block', borderRadius: 8 }} />
        ) : (
          <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafd', borderRadius: 8 }}>
            <Loader2 size={40} color="#1a2f5e" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}
        {isExpired && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(220,38,38,0.15)', borderRadius: 12, flexDirection: 'column', gap: 8 }}>
            <XCircle size={48} color="#dc2626" />
            <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.1rem' }}>EXPIRED</span>
          </div>
        )}
      </div>

      {/* Countdown */}
      {!isExpired && expiresAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 99, background: `${countdownColor}15`, border: `2px solid ${countdownColor}40` }}>
          <Timer size={16} color={countdownColor} />
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: countdownColor, fontVariantNumeric: 'tabular-nums' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.75rem', color: countdownColor, fontWeight: 600 }}>remaining</span>
        </div>
      )}

      {/* Export buttons */}
      {!isExpired && qrDataUrl && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => { const link = document.createElement('a'); link.href = qrDataUrl; link.download = `qr-attendance-${sessionData?.vbsYear || 'vbs'}.png`; link.click(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', transition: 'all 0.15s' }}>
            <Download size={14} /> Download QR
          </button>
          <button
            onClick={handlePrintExport}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, border: '1.5px solid #1a2f5e', background: '#1a2f5e', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 700, color: 'white', transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(26,47,94,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a4a8e'}
            onMouseLeave={e => e.currentTarget.style.background = '#1a2f5e'}
          >
            <Printer size={14} /> Print Branded PDF
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Live Scans Feed ──────────────────────────────────────────────── */
function LiveScansFeed({ sessionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['qr-session-live', sessionId],
    queryFn: () => qrAPI.getSession(sessionId).then(r => r.data?.data),
    refetchInterval: 4000,
    enabled: !!sessionId,
  });
  if (isLoading) return <div className="loading-center" style={{ padding: 24 }}><div className="spinner" /></div>;
  if (!data) return null;
  const scans = data.scans || [];
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Scanned', value: scans.length, color: '#16a34a' }, { label: 'Present', value: scans.filter(s => s.status === 'present').length, color: '#3b82f6' }, { label: 'Late', value: scans.filter(s => s.status === 'late').length, color: '#d97706' }].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 80, padding: '10px 14px', background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {scans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: '0.85rem' }}>
          <ScanLine size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
          Waiting for teachers to scan…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          <AnimatePresence>
            {[...scans].reverse().map((scan, i) => (
              <motion.div key={scan._id || i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: scan.status === 'present' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${scan.status === 'present' ? '#bbf7d0' : '#fde68a'}` }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: scan.status === 'present' ? '#16a34a' : '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {scan.status === 'present' ? <Check size={16} color="white" /> : <Clock size={16} color="white" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{scan.teacherName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 1 }}>{scan.arrivalTime} · {fmtTime(scan.scannedAt)}</div>
                </div>
                <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', background: scan.status === 'present' ? '#dcfce7' : '#fef9c3', color: scan.status === 'present' ? '#15803d' : '#a16207' }}>{scan.status}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─── QR Scanner ───────────────────────────────────────────────────── */
function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const [error, setError] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [mode, setMode] = useState('camera');
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    setScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !window.jsQR) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) { scanFrameRef.current = requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) { stopCamera(); onScan(code.data); }
    else scanFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setScanning(true); }
    } catch { setError('Camera access denied. Use manual entry below.'); setMode('manual'); }
  }, []);

  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => { if (mode === 'camera') startCamera(); };
      document.head.appendChild(script);
    } else if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (scanning) scanFrameRef.current = requestAnimationFrame(scanFrame);
    return () => { if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current); };
  }, [scanning, scanFrame]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 420 }}>
        <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}><ScanLine size={22} color="#fbbf24" /> Scan QR Code</div>
        <button onClick={() => { stopCamera(); onClose(); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
      </div>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
        {[['camera', '📷 Camera'], ['manual', '⌨️ Manual']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); if (m === 'camera') startCamera(); else stopCamera(); }}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, background: mode === m ? 'white' : 'transparent', color: mode === m ? '#1a2f5e' : 'rgba(255,255,255,0.7)', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>
      {mode === 'camera' ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#000', aspectRatio: '1' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '65%', aspectRatio: '1' }}>
                {['tl', 'tr', 'bl', 'br'].map(c => (
                  <div key={c} style={{ position: 'absolute', width: 28, height: 28, top: c.includes('t') ? 0 : 'auto', bottom: c.includes('b') ? 0 : 'auto', left: c.includes('l') ? 0 : 'auto', right: c.includes('r') ? 0 : 'auto', borderTop: c.includes('t') ? '3px solid #fbbf24' : 'none', borderBottom: c.includes('b') ? '3px solid #fbbf24' : 'none', borderLeft: c.includes('l') ? '3px solid #fbbf24' : 'none', borderRight: c.includes('r') ? '3px solid #fbbf24' : 'none', borderRadius: c === 'tl' ? '6px 0 0 0' : c === 'tr' ? '0 6px 0 0' : c === 'bl' ? '0 0 0 6px' : '0 0 6px 0' }} />
                ))}
              </div>
            </div>
            {error && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 20 }}><div style={{ textAlign: 'center', color: 'white' }}><AlertTriangle size={32} color="#fbbf24" style={{ marginBottom: 8 }} /><p style={{ fontSize: '0.85rem' }}>{error}</p></div></div>}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textAlign: 'center', marginTop: 12 }}>Point camera at QR code to scan automatically</p>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 24 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600, marginBottom: 8 }}>Enter QR Token</label>
            <textarea value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="Paste QR_ATTENDANCE:... or token here" rows={3}
              style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', resize: 'none', outline: 'none' }} />
            <button onClick={() => { if (manualToken.trim()) { stopCamera(); onScan(manualToken.trim()); } }} disabled={!manualToken.trim()}
              style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 10, border: 'none', background: manualToken.trim() ? '#fbbf24' : 'rgba(255,255,255,0.1)', color: manualToken.trim() ? '#1a1a1a' : 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.875rem', cursor: manualToken.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              Submit Token
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes scanLine{0%{top:0;opacity:1}50%{top:100%;opacity:0.5}100%{top:0;opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─── Scan Result Modal ────────────────────────────────────────────── */
function ScanResultModal({ result, onClose }) {
  if (!result) return null;
  const isSuccess = result.success;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} onClick={e => e.stopPropagation()}
          style={{ background: 'white', borderRadius: 24, padding: 36, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            style={{ width: 72, height: 72, borderRadius: '50%', background: isSuccess ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {isSuccess ? <CheckCircle size={36} color="#16a34a" /> : <XCircle size={36} color="#dc2626" />}
          </motion.div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, color: isSuccess ? '#15803d' : '#991b1b' }}>
            {isSuccess ? 'Attendance Marked!' : 'Scan Failed'}
          </h2>
          {isSuccess && result.data && (
            <div style={{ margin: '16px 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{result.data.teacherName}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ padding: '4px 14px', borderRadius: 99, background: result.data.status === 'present' ? '#dcfce7' : '#fef9c3', color: result.data.status === 'present' ? '#15803d' : '#a16207', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase' }}>{result.data.status}</span>
                <span style={{ padding: '4px 14px', borderRadius: 99, background: '#dbeafe', color: '#1e40af', fontSize: '0.82rem', fontWeight: 700 }}>{result.data.arrivalTime}</span>
              </div>
              {result.data.sessionLabel && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 8 }}>{result.data.sessionLabel}</div>}
            </div>
          )}
          {!isSuccess && <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 16 }}>{result.message}</p>}
          <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: isSuccess ? '#16a34a' : '#dc2626', color: 'white', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginTop: 4 }}>
            {isSuccess ? 'Great!' : 'Try Again'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Admin: Generate QR Panel ─────────────────────────────────────── */
function AdminQRGenerator({ vbsYear, activeSettings }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(getTodayIST());
  const [label, setLabel] = useState('');
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [activeSession, setActiveSession] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const { data: sessions } = useQuery({
    queryKey: ['qr-sessions', date, vbsYear],
    queryFn: () => qrAPI.getSessions({ date, vbsYear }).then(r => r.data?.data || []),
    refetchInterval: activeSession ? 5000 : false,
  });

  const createMut = useMutation({
    mutationFn: () => qrAPI.createSession({ date, label, expiryMinutes }),
    onSuccess: (res) => { const session = res.data?.data; setActiveSession(session); qc.invalidateQueries(['qr-sessions']); toast.success('QR code generated!'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create QR'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => qrAPI.deactivate(id),
    onSuccess: () => { setActiveSession(null); qc.invalidateQueries(['qr-sessions']); toast.success('QR session deactivated'); },
  });

  const handleScan = useCallback(async (token) => {
    setShowScanner(false);
    try { const res = await qrAPI.scan(token); setScanResult(res.data); }
    catch (err) { setScanResult({ success: false, message: err.response?.data?.message || 'Scan failed' }); }
  }, []);

  return (
    <div>
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {scanResult && <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: activeSession ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Generator Panel */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><QrCode size={18} color="#1a2f5e" /> Generate QR Code</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <DateInput label="Attendance Date" value={date} onChange={setDate}
                  vbsStartDate={activeSettings?.dates?.startDate?.slice(0, 10)}
                  vbsEndDate={activeSettings?.dates?.endDate?.slice(0, 10)} showVBSDays />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Session Label <span className="optional">(optional)</span></label>
                <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Morning Session Day 3" />
              </div>
              <div className="form-group">
                <label className="form-label">QR Expires After</label>
                <select className="form-select" value={expiryMinutes} onChange={e => setExpiryMinutes(Number(e.target.value))}>
                  {[5, 10, 15, 30, 60, 120].map(m => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m/60} hour${m > 60 ? 's' : ''}`}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => createMut.mutate()} disabled={createMut.isPending || !date}>
                {createMut.isPending ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Generating…</> : <><QrCode size={16} /> Generate QR</>}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowScanner(true)} title="Test scan"><Camera size={16} /> Test Scan</button>
            </div>
          </div>
        </div>

        {/* Active Session QR Display with Export */}
        {activeSession && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} />
                Active QR Session
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => deactivateMut.mutate(activeSession._id)} disabled={deactivateMut.isPending} style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                <Square size={12} /> Stop
              </button>
            </div>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 4 }}>{activeSession.label}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a2f5e', marginBottom: 16 }}>{fmtDate(activeSession.date)}</div>
              <QRCodeDisplayWithExport
                value={activeSession.qrPayload}
                size={240}
                label={activeSession.label}
                expiresAt={activeSession.expiresAt}
                sessionData={activeSession}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Active session live feed */}
      {activeSession && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} /> Live Attendance Feed
            </span>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Auto-refreshes every 4s</span>
          </div>
          <div className="card-body">
            <LiveScansFeed sessionId={activeSession._id} />
          </div>
        </div>
      )}

      {/* Session history */}
      {(sessions || []).length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><span className="card-title">Session History — {fmtDate(date)}</span></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Label</th><th>Created</th><th>Expires</th><th>Scans</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {(sessions || []).map(s => {
                  const isExpired = new Date() > new Date(s.expiresAt);
                  const isActive = s.isActive && !isExpired;
                  return (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600, fontSize: '0.845rem' }}>{s.label}</td>
                      <td style={{ fontSize: '0.78rem', color: '#6b7280' }}>{fmtTime(s.createdAt)}</td>
                      <td style={{ fontSize: '0.78rem', color: isExpired ? '#dc2626' : '#16a34a' }}>{fmtTime(s.expiresAt)}</td>
                      <td><span style={{ fontWeight: 700, color: '#1a2f5e' }}>{s.scans?.length || 0}</span></td>
                      <td><span className={`badge ${isActive ? 'badge-green' : isExpired ? 'badge-red' : 'badge-gray'}`}>{isActive ? '● Active' : isExpired ? 'Expired' : 'Stopped'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isActive && (
                            <button className="btn btn-primary btn-sm" onClick={() => setActiveSession({ ...s, qrPayload: `QR_ATTENDANCE:${s.token}` })}>
                              <Eye size={12} /> View & Export
                            </button>
                          )}
                          {isActive && (
                            <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => deactivateMut.mutate(s._id)}>
                              <Square size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ─── Teacher: QR Scan Page ────────────────────────────────────────── */
function TeacherQRScanner() {
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);

  const scanMut = useMutation({
    mutationFn: (token) => qrAPI.scan(token),
    onSuccess: (res) => { setScanResult(res.data); setShowScanner(false); },
    onError: (err) => { setScanResult({ success: false, message: err.response?.data?.message || 'Scan failed' }); setShowScanner(false); },
  });

  const handleScan = useCallback(async (token) => { setShowScanner(false); scanMut.mutate(token); }, [scanMut]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {scanResult && <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} />}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a2f5e 0%, #2a4a8e 50%, #1a2f5e 100%)', padding: '36px 28px', textAlign: 'center', position: 'relative' }}>
          {[120, 180, 240].map((s, i) => <div key={i} style={{ position: 'absolute', width: s, height: s, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />)}
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}
            style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 1 }}>
            <QrCode size={40} color="#fbbf24" />
          </motion.div>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', marginBottom: 6, position: 'relative', zIndex: 1 }}>Mark Your Attendance</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', position: 'relative', zIndex: 1 }}>Scan the QR code displayed by your admin</p>
        </div>
        <div className="card-body" style={{ padding: 28 }}>
          <div style={{ marginBottom: 24 }}>
            {[{ step: 1, text: 'Admin generates a QR code for today' }, { step: 2, text: 'Tap "Scan QR Code" below' }, { step: 3, text: 'Point camera at the QR code' }, { step: 4, text: 'Attendance marked instantly!' }].map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#1a2f5e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>{step}</div>
                <span style={{ fontSize: '0.845rem', color: '#374151' }}>{text}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: 52, fontSize: '1rem', fontWeight: 800, borderRadius: 14, boxShadow: '0 4px 20px rgba(26,47,94,0.3)' }} onClick={() => setShowScanner(true)} disabled={scanMut.isPending}>
            {scanMut.isPending ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing…</> : <><Camera size={20} /> Scan QR Code</>}
          </button>
          <button onClick={() => setShowManual(!showManual)} style={{ width: '100%', marginTop: 10, padding: '8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ChevronDown size={14} style={{ transform: showManual ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            Can't scan? Enter token manually
          </button>
          <AnimatePresence>
            {showManual && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 0 0' }}>
                  <input className="form-input" value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="Paste QR_ATTENDANCE:... token" style={{ marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }} />
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { if (manualToken.trim()) scanMut.mutate(manualToken.trim()); }} disabled={!manualToken.trim() || scanMut.isPending}>Submit Token</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin: Session History ─────────────────────────────────────────── */
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
        <div className="empty-state"><QrCode size={36} style={{ color: 'var(--color-text-muted)' }} /><h3>No QR sessions found</h3><p>Generate your first QR code from the "Generate QR" tab.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map(s => {
            const isExpired = new Date() > new Date(s.expiresAt);
            const isActive = s.isActive && !isExpired;
            const isExpanded = expandedSession === s._id;
            return (
              <div key={s._id} className="card">
                <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpandedSession(isExpanded ? null : s._id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: isActive ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={20} color={isActive ? '#16a34a' : '#9ca3af'} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.label}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>{fmtDate(s.date)} · {fmtTime(s.createdAt)} · by {s.createdBy?.name}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#1a2f5e', fontSize: '0.875rem' }}>{s.scans?.length || 0} scans</span>
                    <span className={`badge ${isActive ? 'badge-green' : isExpired ? 'badge-red' : 'badge-gray'}`}>{isActive ? '● Active' : isExpired ? 'Expired' : 'Stopped'}</span>
                    <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#9ca3af' }} />
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                          {[{ label: 'Total Scans', value: s.scans?.length || 0, color: '#3b82f6' }, { label: 'Present', value: s.scans?.filter(sc => sc.status === 'present').length || 0, color: '#16a34a' }, { label: 'Late', value: s.scans?.filter(sc => sc.status === 'late').length || 0, color: '#d97706' }, { label: 'Expired At', value: fmtTime(s.expiresAt), color: '#6b7280' }].map(stat => (
                            <div key={stat.label} style={{ flex: 1, minWidth: 80, padding: '8px 12px', background: '#f8fafd', borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontWeight: 800, color: stat.color, fontSize: typeof stat.value === 'number' ? '1.2rem' : '0.78rem' }}>{stat.value}</div>
                              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{stat.label}</div>
                            </div>
                          ))}
                        </div>
                        {s.scans?.length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead><tr>
                              {['Teacher', 'Status', 'Arrival', 'Scanned At'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', background: '#f8fafd', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {s.scans.map((scan, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f4f8' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{scan.teacherName}</td>
                                  <td style={{ padding: '8px 10px' }}><span style={{ padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 800, background: scan.status === 'present' ? '#dcfce7' : '#fef9c3', color: scan.status === 'present' ? '#15803d' : '#a16207' }}>{scan.status}</span></td>
                                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#6b7280' }}>{scan.arrivalTime || '—'}</td>
                                  <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: '#9ca3af' }}>{fmtTime(scan.scannedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: '0.82rem' }}>No scans recorded for this session</div>
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

/* ─── MAIN PAGE ─────────────────────────────────────────────────────── */
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
            <QrCode size={28} color="#1a2f5e" /> QR Attendance
          </h1>
          <p className="page-subtitle">
            {isAdmin ? `Generate QR codes for teacher check-in · VBS ${vbsYear}` : 'Scan QR code to mark your attendance'}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
            <Calendar size={14} /> {activeYear?.vbsTitle || `VBS ${vbsYear}`}
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[{ id: 'generate', label: '🖨️ Generate QR', desc: 'Create & display' }, { id: 'history', label: '📋 Session History', desc: 'Past sessions' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', flexDirection: 'column', padding: '10px 18px', borderRadius: 12, border: `1.5px solid ${tab === t.id ? '#1a2f5e' : '#e2e8f0'}`, background: tab === t.id ? '#1a2f5e' : 'white', color: tab === t.id ? 'white' : '#4b5563', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', textAlign: 'left' }}>
              <span style={{ fontWeight: 700, fontSize: '0.845rem' }}>{t.label}</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 1 }}>{t.desc}</span>
            </button>
          ))}
        </div>
      )}

      {isTeacher && <TeacherQRScanner />}
      {isAdmin && tab === 'generate' && <AdminQRGenerator vbsYear={vbsYear} activeSettings={activeSettings} />}
      {isAdmin && tab === 'history' && <QRSessionHistory vbsYear={vbsYear} activeSettings={activeSettings} />}
    </div>
  );
}
