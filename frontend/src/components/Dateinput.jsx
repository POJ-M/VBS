import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function isoToLocal(isoStr) {
  if (!isoStr) return null;
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// Check if a date falls within a range (inclusive)
function isInVBSRange(date, startDate, endDate) {
  if (!startDate || !endDate) return false;
  const d = date.getTime();
  const s = isoToLocal(startDate)?.getTime();
  const e = isoToLocal(endDate)?.getTime();
  if (!s || !e) return false;
  return d >= s && d <= e;
}

// Calculate VBS day number (1-based)
function getVBSDayNumber(date, startDate) {
  if (!startDate) return null;
  const start = isoToLocal(startDate);
  if (!start) return null;
  const diff = Math.round((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

export default function DateInput({
  value,
  onChange,
  label,
  required,
  optional,
  placeholder = 'Select date',
  min,
  max,
  error,
  style,
  disabled,
  // VBS-specific props for day highlighting
  vbsStartDate,  // ISO string e.g. "2026-06-10"
  vbsEndDate,    // ISO string e.g. "2026-06-15"
  showVBSDays = false, // whether to show VBS day badges
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoToLocal(value) : null;
  const today = new Date();
  const [viewYear, setViewYear] = useState((selected || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth());
  const containerRef = useRef(null);

  const minDate = min ? isoToLocal(min) : null;
  const maxDate = max ? isoToLocal(max) : null;

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
  }, [value]);

  // When opening, navigate to VBS start month if showVBSDays and no value selected
  useEffect(() => {
    if (open && showVBSDays && vbsStartDate && !selected) {
      const s = isoToLocal(vbsStartDate);
      if (s) { setViewYear(s.getFullYear()); setViewMonth(s.getMonth()); }
    }
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const isDisabled = useCallback((date) => {
    if (minDate) {
      const minMidnight = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (dateMidnight < minMidnight) return true;
    }
    if (maxDate) {
      const maxMidnight = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (dateMidnight > maxMidnight) return true;
    }
    return false;
  }, [minDate, maxDate]);

  const selectDate = (date) => {
    if (isDisabled(date)) return;
    onChange(toISO(date));
    setOpen(false);
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewYear, viewMonth, d));

  const displayValue = selected
    ? selected.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  // Determine if current view has VBS days
  const hasVBSDaysInView = showVBSDays && vbsStartDate && vbsEndDate &&
    cells.some(d => d && isInVBSRange(d, vbsStartDate, vbsEndDate));

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 5 }}>
          {label}
          {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
          {optional && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 4, fontSize: '0.75rem' }}>(optional)</span>}
        </label>
      )}

      <button type="button" onClick={() => !disabled && setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', padding: '8px 12px',
          border: `1.5px solid ${error ? 'var(--color-danger)' : open ? 'var(--color-primary-light)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)', background: disabled ? 'var(--color-bg)' : 'var(--color-surface)',
          cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
          fontSize: '0.85rem', textAlign: 'left',
          boxShadow: open ? '0 0 0 3px rgba(42,74,142,0.1)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.6 : 1,
        }}>
        <Calendar size={15} color={selected ? 'var(--color-primary)' : 'var(--color-text-muted)'} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, color: selected ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: selected ? 500 : 400 }}>
          {displayValue || placeholder}
        </span>
        {selected && !disabled && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', display: 'flex', borderRadius: 4, fontSize: '1rem', lineHeight: 1 }}>
            ×
          </button>
        )}
      </button>

      {error && <div style={{ fontSize: '0.73rem', color: 'var(--color-danger)', marginTop: 4 }}>{error}</div>}

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 500,
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 14, boxShadow: 'var(--shadow-xl)', width: 300, overflow: 'hidden',
        }}>
          {/* VBS Legend */}
          {showVBSDays && hasVBSDaysInView && (
            <div style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #1a2f5e, #2a4a8e)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>VBS Days</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24' }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)' }}>VBS Day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)' }}>Selected</span>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: showVBSDays && hasVBSDaysInView ? '#1e3a8a' : 'var(--color-primary)', color: 'white' }}>
            <button type="button" onClick={prevMonth}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <ChevronLeft size={15} />
            </button>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', textAlign: 'center' }}>
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button type="button" onClick={nextMonth}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 8px 0', gap: 2 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', padding: '4px 0', letterSpacing: '0.04em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '4px 8px 10px', gap: 2 }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              const isDisabledDay = isDisabled(date);
              const isVBSDay = showVBSDays && isInVBSRange(date, vbsStartDate, vbsEndDate);
              const dayNum = isVBSDay ? getVBSDayNumber(date, vbsStartDate) : null;
              const isVBSStart = showVBSDays && vbsStartDate && sameDay(date, isoToLocal(vbsStartDate));
              const isVBSEnd = showVBSDays && vbsEndDate && sameDay(date, isoToLocal(vbsEndDate));

              let bgColor = 'transparent';
              let textColor = isDisabledDay ? 'var(--color-text-muted)' : 'var(--color-text)';
              let outlineColor = 'none';
              let extraStyle = {};

              if (isSelected) {
                bgColor = 'var(--color-primary)';
                textColor = 'white';
              } else if (isToday) {
                bgColor = 'var(--color-accent-bg)';
                textColor = 'var(--color-accent-dark)';
                outlineColor = 'var(--color-accent)';
              } else if (isVBSDay) {
                bgColor = isVBSStart || isVBSEnd ? '#fbbf24' : '#fef3c7';
                textColor = '#92400e';
              }

              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => selectDate(date)}
                  disabled={isDisabledDay}
                  title={isVBSDay && dayNum ? `VBS Day ${dayNum}` : undefined}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: 'none',
                    cursor: isDisabledDay ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: isSelected || isToday || isVBSStart || isVBSEnd ? 800 : isVBSDay ? 700 : 400,
                    background: bgColor,
                    color: textColor,
                    outline: isToday && !isSelected ? `1.5px solid ${outlineColor}` : 'none',
                    opacity: isDisabledDay ? 0.35 : 1,
                    transition: 'background 0.12s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0,
                    position: 'relative',
                    ...extraStyle,
                  }}
                  onMouseEnter={e => { if (!isSelected && !isDisabledDay) e.currentTarget.style.background = isVBSDay ? '#fde68a' : 'var(--color-bg)'; }}
                  onMouseLeave={e => { if (!isSelected && !isDisabledDay) e.currentTarget.style.background = bgColor; }}
                >
                  <span style={{ lineHeight: 1, fontSize: '0.78rem' }}>{date.getDate()}</span>
                  {isVBSDay && dayNum && (
                    <span style={{
                      fontSize: '0.5rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      marginTop: 1,
                      color: isSelected ? 'rgba(255,255,255,0.85)' : '#c2410c',
                      letterSpacing: '0.02em',
                    }}>
                      D{dayNum}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* VBS range info */}
          {showVBSDays && vbsStartDate && vbsEndDate && (
            <div style={{ padding: '6px 12px 8px', background: '#fef9f0', borderTop: '1px solid #fde68a', fontSize: '0.68rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📅</span>
              <span>
                VBS: {isoToLocal(vbsStartDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                {isoToLocal(vbsEndDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Quick actions */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {showVBSDays && vbsStartDate && (
              <button type="button"
                onClick={() => selectDate(isoToLocal(vbsStartDate))}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #fbbf24', background: '#fef3c7', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: '#92400e' }}>
                Day 1
              </button>
            )}
            <button type="button" onClick={() => selectDate(today)}
              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'white', fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
