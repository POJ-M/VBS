import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, CheckCircle, Calendar } from 'lucide-react';
import { useActiveYear } from '../../contexts/ActiveYearContext';

export default function YearSelector() {
  const { activeYear, allYears, setActiveYear } = useActiveYear();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!allYears.length) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'var(--color-accent-bg)', border: '1.5px solid var(--color-accent)',
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-accent-dark)',
          transition: 'all 0.15s',
        }}
      >
        <Calendar size={14} />
        VBS {activeYear?.year || '—'}
        {activeYear?.isActive && (
          <span style={{ fontSize: '0.62rem', background: 'var(--color-accent)', color: 'white', borderRadius: 99, padding: '1px 5px', fontWeight: 800 }}>
            LIVE
          </span>
        )}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 12, boxShadow: 'var(--shadow-xl)',
          minWidth: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
            Select VBS Year
          </div>
          {allYears.map(y => (
            <button key={y._id} onClick={() => { setActiveYear(y); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.845rem',
                fontWeight: activeYear?._id === y._id ? 700 : 500,
                color: 'var(--color-text)', transition: 'background 0.12s',
                borderBottom: '1px solid var(--color-border-light)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div>
                <div>{y.vbsTitle || `VBS ${y.year}`}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{y.year}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {y.isActive && <span style={{ fontSize: '0.62rem', background: '#dcfce7', color: '#15803d', borderRadius: 99, padding: '1px 6px', fontWeight: 800 }}>LIVE</span>}
                {activeYear?._id === y._id && <CheckCircle size={14} color="var(--color-primary)" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}