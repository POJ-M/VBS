// ─── Central Brand Configuration ─────────────────────────────────
// Single source of truth for branding assets used across the app

// POJ Logo as a React component (uses the public path)
// Place poj-logo.png in frontend/public/poj-logo.png
export const POJ_LOGO_SRC = '/poj-logo.png';

/**
 * BrandLogo component — replaces all Shield/Cross icons
 * @param {number} size - height in px (width auto-scales, aspect ~1:1)
 * @param {string} className
 * @param {object} style - additional inline styles
 */
export function BrandLogo({ size = 36, className = '', style = {} }) {
  return (
    <img
      src={POJ_LOGO_SRC}
      alt="Presence of Jesus Ministry"
      height={size}
      width={size}
      className={className}
      style={{
        objectFit: 'contain',
        objectPosition: 'center',
        flexShrink: 0,
        display: 'block',
        ...style,
      }}
    />
  );
}

/**
 * Returns inline <img> HTML string for use in print/PDF templates
 * @param {number} size - px size
 * @param {string} extraStyle - additional inline CSS string
 */
export function brandLogoHTML(size = 32, extraStyle = '') {
  // For PDF/print we embed as absolute URL or data URI fallback
  // Using window.location.origin for dynamic base URL
  return `<img src="/poj-logo.png" alt="POJ Ministry" width="${size}" height="${size}" style="object-fit:contain;vertical-align:middle;flex-shrink:0;${extraStyle}" />`;
}