import React from 'react';
import { useActiveYear } from '../../contexts/ActiveYearContext';

export default function AppFooter() {
  const { activeYear } = useActiveYear();
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: '#ffffff',
      borderTop: '1px solid var(--color-border)',
      padding: '0 24px',
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end', // ✅ RIGHT ALIGN
      gap: 12,
      flexShrink: 0,
      zIndex: 50,
    }}>
      <div style={{
        fontSize: '0.72rem',
        color: 'var(--color-text-muted)',
        whiteSpace: 'nowrap',
      }}>
        © {year} POJM - VBS Management System
      </div>
    </footer>
  );
}
