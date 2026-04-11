import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, Play } from 'lucide-react';
import { settingsAPI } from '../services/api';

// ─── Countdown hook ────────────────────────────────────────────────
function useCountdown(start, end) {
  const [state, setState] = useState({ status: 'loading', timeLeft: {} });
  useEffect(() => {
    if (!start || !end) { setState({ status: 'no-date', timeLeft: {} }); return; }
    const tick = () => {
      const now = Date.now();
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (now >= s && now <= e) { setState({ status: 'live' }); return; }
      if (now > e) { setState({ status: 'ended' }); return; }
      const diff = s - now;
      setState({
        status: 'upcoming',
        timeLeft: {
          days: Math.floor(diff / 86400000),
          hours: Math.floor((diff % 86400000) / 3600000),
          minutes: Math.floor((diff % 3600000) / 60000),
          seconds: Math.floor((diff % 60000) / 1000),
        }
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start, end]);
  return state;
}

// ─── Animated floating orbs (CSS-only, no lag) ────────────────────
function BackgroundOrbs({ color1, color2 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div className="orb orb-1" style={{ background: color1 }} />
      <div className="orb orb-2" style={{ background: color2 }} />
      <div className="orb orb-3" style={{ background: color1 }} />
      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          will-change: transform;
        }
        .orb-1 {
          width: 500px; height: 500px;
          top: -100px; left: -100px;
          animation: orbFloat1 18s ease-in-out infinite;
        }
        .orb-2 {
          width: 400px; height: 400px;
          bottom: -80px; right: -80px;
          animation: orbFloat2 22s ease-in-out infinite;
        }
        .orb-3 {
          width: 300px; height: 300px;
          top: 40%; left: 50%;
          animation: orbFloat3 26s ease-in-out infinite;
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(60px, 40px); }
          66% { transform: translate(-30px, 60px); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-50px, -30px); }
          66% { transform: translate(40px, -60px); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ─── Twinkling stars (pure CSS, performant) ────────────────────────
function Stars() {
  const stars = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 85}%`,
    left: `${Math.random() * 100}%`,
    size: 1.5 + Math.random() * 2.5,
    delay: Math.random() * 6,
    duration: 2 + Math.random() * 3,
  }));
  return (
    <>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: s.size, height: s.size,
          borderRadius: '50%', background: 'white',
          animation: `starTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
      `}</style>
    </>
  );
}

// ─── Countdown unit ────────────────────────────────────────────────
function CountUnit({ value, label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
      borderRadius: 16, padding: '14px 18px', minWidth: 76,
      border: '1px solid rgba(255,255,255,0.22)',
    }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{ fontSize: '2.2rem', fontWeight: 900, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {String(value ?? 0).padStart(2, '0')}
        </motion.span>
      </AnimatePresence>
      <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.65)', marginTop: 5 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Verse display (animated) ──────────────────────────────────────
function VerseDisplay({ verseRef, verseText, accentColor }) {
  if (!verseRef && !verseText) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      style={{
        margin: '18px auto 0',
        maxWidth: 640,
        padding: '16px 22px',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderLeft: `3px solid ${accentColor || '#fbbf24'}`,
        borderRadius: 12,
        textAlign: 'left',
      }}
    >
      {verseText && (
        <p style={{
          fontSize: 'clamp(0.82rem, 1.8vw, 0.95rem)',
          color: 'rgba(255,255,255,0.88)',
          fontStyle: 'italic',
          lineHeight: 1.7,
          margin: 0,
        }}>
          "{verseText}"
        </p>
      )}
      {verseRef && (
        <p style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: accentColor || '#fbbf24',
          marginTop: verseText ? 8 : 0,
          marginBottom: 0,
          letterSpacing: '0.04em',
        }}>
          — {verseRef}
        </p>
      )}
    </motion.div>
  );
}

// ─── Photo Lightbox ────────────────────────────────────────────────
function PhotoGallery({ photos }) {
  const [lightbox, setLightbox] = useState(null);
  if (!photos.length) return null;
  return (
    <>
      <div style={{ columns: '200px 3', gap: 12 }}>
        {photos.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04, duration: 0.4 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setLightbox(p)}
            style={{ breakInside: 'avoid', marginBottom: 12, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', display: 'block', position: 'relative' }}
          >
            <img src={p.url} alt={p.caption || 'VBS'} style={{ width: '100%', display: 'block' }}
              onError={e => { e.target.parentNode.style.display = 'none'; }} />
            {(p.caption || p.year) && (
              <div style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white', padding: '20px 12px 10px', fontSize: '0.78rem', fontWeight: 600, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                {p.caption} {p.year && <span style={{ opacity: 0.7 }}>· {p.year}</span>}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'white', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
            <motion.img src={lightbox.url} initial={{ scale: 0.88 }} animate={{ scale: 1 }}
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 20px 80px rgba(0,0,0,0.5)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── YouTube Video Card ────────────────────────────────────────────
function VideoCard({ video }) {
  const [playing, setPlaying] = useState(false);
  const videoId = video.url?.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
  if (!videoId) return null;
  const thumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', background: '#000', cursor: 'pointer' }}
    >
      {playing ? (
        <iframe width="100%" height="220"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={video.title || 'VBS Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen style={{ display: 'block', border: 'none' }} />
      ) : (
        <div style={{ position: 'relative', paddingTop: '56.25%', cursor: 'pointer' }} onClick={() => setPlaying(true)}>
          <img src={thumb} alt={video.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.22)' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <Play size={26} color="white" fill="white" style={{ marginLeft: 4 }} />
            </div>
          </div>
          {video.year && (
            <div style={{ position: 'absolute', top: 12, left: 12, background: '#dc2626', color: 'white', borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800 }}>
              VBS {video.year}
            </div>
          )}
        </div>
      )}
      {video.title && (
        <div style={{ padding: '12px 14px', background: '#111', color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>
          {video.title}
        </div>
      )}
    </motion.div>
  );
}

// ─── Daily Theme Card ──────────────────────────────────────────────
const THEME_PALETTES = [
  { bg: '#fff0f5', border: '#f9a8d4', text: '#831843', accent: '#db2777', num: '#fce7f3' },
  { bg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', accent: '#2563eb', num: '#dbeafe' },
  { bg: '#f0fdf4', border: '#86efac', text: '#14532d', accent: '#16a34a', num: '#dcfce7' },
  { bg: '#fefce8', border: '#fde047', text: '#713f12', accent: '#ca8a04', num: '#fef9c3' },
  { bg: '#faf5ff', border: '#d8b4fe', text: '#4c1d95', accent: '#7c3aed', num: '#ede9fe' },
  { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', accent: '#ea580c', num: '#ffedd5' },
];

function ThemeCard({ theme, index }) {
  const p = THEME_PALETTES[index % THEME_PALETTES.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
      style={{ background: p.bg, borderRadius: 24, padding: 22, border: `2px solid ${p.border}`, transition: 'box-shadow 0.3s' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.1rem', boxShadow: `0 4px 12px ${p.accent}60`, flexShrink: 0 }}>
          {theme.day}
        </div>
        <div>
          <div style={{ fontSize: '0.6rem', color: p.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Day {theme.day}</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', lineHeight: 1.2 }}>{theme.title}</div>
        </div>
      </div>
      {theme.verse && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: p.accent, color: 'white', borderRadius: 99, padding: '3px 11px', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10 }}>
          📖 {theme.verse}
        </div>
      )}
      {theme.verseText && (
        <div style={{ fontSize: '0.82rem', color: '#374151', fontStyle: 'italic', lineHeight: 1.7, borderLeft: `3px solid ${p.border}`, paddingLeft: 12, marginBottom: theme.description ? 10 : 0 }}>
          "{theme.verseText}"
        </div>
      )}
      {theme.description && (
        <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${p.border}` }}>
          {theme.description}
        </div>
      )}
    </motion.div>
  );
}

// ─── Section Header ────────────────────────────────────────────────
function SectionHeader({ emoji, title, subtitle, accent = '#2563eb' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{ textAlign: 'center', marginBottom: 48 }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${accent}18`, border: `1.5px solid ${accent}40`, borderRadius: 99, padding: '6px 18px', marginBottom: 14, fontSize: '0.85rem', fontWeight: 800, color: accent }}>
        {emoji}
      </div>
      <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>{title}</h2>
      {subtitle && <p style={{ color: '#6b7280', marginTop: 10, fontSize: '1rem', maxWidth: 520, margin: '10px auto 0' }}>{subtitle}</p>}
    </motion.div>
  );
}

// ─── MAIN HOME PAGE ────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => settingsAPI.getActive(),
    select: d => d.data?.data,
    staleTime: 60000,
  });

  const countdown = useCountdown(settings?.dates?.startDate, settings?.dates?.endDate);
  const photos = settings?.previousYearPhotos || [];
  const themes = settings?.dailyThemes || [];
  const videos = settings?.youtubeVideos || [];
  const mainColor = settings?.theme?.mainColor || '#1a2f5e';
  const accentColor = settings?.theme?.accentColor || '#c8922a';

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fffbf5', overflowX: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Background gradient */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${mainColor} 0%, #1a3090 35%, #5b1a8f 70%, #9c1a5e 100%)` }} />

        {/* Animated orbs */}
        <BackgroundOrbs color1={accentColor} color2="#7c3aed" />

        {/* Stars */}
        <Stars />

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '60px 24px 80px', maxWidth: 860, width: '100%' }}>

          {/* Ministry badge with logo */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', borderRadius: 100, padding: '7px 16px 7px 8px', marginBottom: 22, border: '1px solid rgba(255,255,255,0.22)' }}
          >
            {/* POJ Logo */}
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/poj-logo.png" alt="POJ" width={32} height={32} style={{ objectFit: 'cover', borderRadius: '50%' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '✝️'; }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem', fontWeight: 700 }}>
              Presence of Jesus Ministry
            </span>
          </motion.div>

          {/* VBS badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4, type: 'spring', stiffness: 180 }}
            style={{ display: 'inline-block', background: `linear-gradient(135deg, ${accentColor}, #f59e0b)`, color: '#1a1a1a', borderRadius: 99, padding: '7px 24px', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18, boxShadow: `0 4px 20px ${accentColor}60` }}
          >
            🎉 Vacation Bible School {settings?.year || new Date().getFullYear()}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{ fontSize: 'clamp(2.2rem, 6.5vw, 4.2rem)', fontWeight: 900, color: 'white', lineHeight: 1.1, marginBottom: 0, letterSpacing: '-0.02em', textShadow: '0 4px 30px rgba(0,0,0,0.2)' }}
          >
            {settings?.vbsTitle || 'Walking With Jesus'}
          </motion.h1>

          {/* VBS Main Verse — shown right after title */}
          <VerseDisplay
            verseRef={settings?.vbsVerseRef}
            verseText={settings?.vbsVerse}
            accentColor={accentColor}
          />

          {/* Tagline */}
          {settings?.tagline && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              style={{ fontSize: 'clamp(0.95rem, 2.2vw, 1.15rem)', color: 'rgba(255,255,255,0.75)', marginTop: 14, marginBottom: 0, fontStyle: 'italic', lineHeight: 1.5 }}
            >
              "{settings.tagline}"
            </motion.p>
          )}

          {/* Date pill */}
          {settings?.dates && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.5 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 100, padding: '9px 22px', marginTop: 20, marginBottom: 0, fontSize: '0.88rem', fontWeight: 700, color: 'white' }}
            >
              📅 {fmtDate(settings.dates.startDate)} — {fmtDate(settings.dates.endDate)}
            </motion.div>
          )}

          {/* Countdown */}
          {settings?.dates?.startDate && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              style={{ marginTop: 36, marginBottom: 0 }}
            >
              {countdown.status === 'live' && (
                <motion.div
                  animate={{ scale: [1, 1.015, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  style={{ display: 'inline-block', background: `linear-gradient(135deg, ${accentColor}, #f59e0b)`, borderRadius: 20, padding: '18px 44px', textAlign: 'center', boxShadow: `0 0 50px ${accentColor}45` }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 4 }}>🎉</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1a1a1a' }}>VBS IS HAPPENING NOW!</div>
                  <div style={{ color: 'rgba(0,0,0,0.6)', marginTop: 4, fontWeight: 600 }}>Come join us today!</div>
                </motion.div>
              )}
              {countdown.status === 'ended' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>🙏</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>VBS Has Concluded — Thank You!</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>What a wonderful time of learning and worship!</div>
                </div>
              )}
              {countdown.status === 'upcoming' && countdown.timeLeft && (
                <>
                  <div style={{ marginBottom: 14, color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    The Adventure Begins In…
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Minutes'], ['seconds', 'Seconds']].map(([k, label]) => (
                      <CountUnit key={k} value={countdown.timeLeft[k]} label={label} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 44 }}
          >
            <motion.button
              onClick={() => navigate('/login')}
              whileHover={{ scale: 1.04, boxShadow: '0 12px 36px rgba(255,255,255,0.18)' }}
              whileTap={{ scale: 0.97 }}
              style={{ background: 'white', color: mainColor, padding: '14px 36px', borderRadius: 100, border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Staff Login →
            </motion.button>
            {themes.length > 0 && (
              <motion.button
                onClick={() => document.getElementById('themes-section')?.scrollIntoView({ behavior: 'smooth' })}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{ background: 'rgba(255,255,255,0.13)', color: 'white', padding: '14px 36px', borderRadius: 100, border: '1.5px solid rgba(255,255,255,0.32)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                See Themes ↓
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'scrollBounce 2s ease-in-out infinite' }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Scroll</span>
          <div style={{ width: 1, height: 32, background: 'linear-gradient(transparent, rgba(255,255,255,0.35))' }} />
        </div>
      </section>

      {/* ── DAILY THEMES ────────────────────────────────────────── */}
      {themes.length > 0 && (
        <section id="themes-section" style={{ padding: '80px 24px', background: '#fffbf5' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <SectionHeader
              emoji="✨ Each Day A New Adventure"
              title="Daily Themes"
              subtitle="Each day is filled with a special Bible theme, verse, and exciting activities!"
              accent="#7c3aed"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
              {themes.map((t, i) => <ThemeCard key={i} theme={t} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── PHOTOS ──────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section style={{ padding: '80px 24px', background: 'linear-gradient(180deg, #f0f7ff 0%, #fff5f0 100%)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <SectionHeader
              emoji="📸 Memories"
              title="Previous Year Highlights"
              subtitle="Relive the joy, laughter, and love from past VBS programs"
              accent="#2563eb"
            />
            <PhotoGallery photos={photos} />
          </div>
        </section>
      )}

      {/* ── YOUTUBE VIDEOS ──────────────────────────────────────── */}
      {videos.length > 0 && (
        <section style={{ padding: '80px 24px', background: '#111' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <SectionHeader
              emoji="🎬 Watch & Remember"
              title="VBS Videos"
              subtitle="Watch highlights and memories from our previous programs"
              accent="#dc2626"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {videos.map((v, i) => <VideoCard key={i} video={v} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ background: '#070d1f', color: 'rgba(255,255,255,0.45)', padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>
          <div style={{ fontWeight: 800, color: 'rgba(255,255,255,0.82)', fontSize: '0.95rem', marginBottom: 4 }}>
            Presence of Jesus Ministry
          </div>
          <div style={{ fontSize: '0.82rem', marginBottom: 14 }}>Carmel Mount, Peikulam</div>
          <div style={{ fontSize: '0.82rem', marginBottom: 14 }}>Tuticorin, Tamil Nadu, India</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />
          <div style={{ fontSize: '0.72rem', opacity: 0.4 }}>
            VBS Management System ·{' '}
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' }}>
              Staff Login
            </button>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes scrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.6; }
          50% { transform: translateX(-50%) translateY(6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
