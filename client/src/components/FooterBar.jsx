import React from 'react';
import ramIcon from '../icons/ram.svg';
import rowsIcon from '../icons/rows.svg';
import avgIcon from '../icons/avg.svg';
import chatIcon from '../icons/chat.svg';

const Metric = ({ icon, label, value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#d9e6f5', fontSize: '0.76rem', letterSpacing: '0.02em' }}>
    <img src={icon} alt="" aria-hidden="true" style={{ width: 14, height: 14, display: 'block' }} />
    <span style={{ fontWeight: 500 }}>{label}:</span>
    <span>{value}</span>
  </div>
);

const linkStyles = {
  background: 'transparent',
  border: 'none',
  color: '#8cc9ff',
  fontSize: '0.78rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 4px',
  borderRadius: 4,
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'color 120ms ease, background 120ms ease',
};

const FooterBar = ({
  heapUsedMB,
  rowsFetchedTotal,
  avgResponseTime,
  onFreeContent,
  onToggleToolset,
  toolsetActive = false,
  ramIconUrl = ramIcon,
  rowsIconUrl = rowsIcon,
  avgIconUrl = avgIcon,
  toolsetIconUrl = chatIcon,
}) => {
  const formattedAvg = Number.isFinite(avgResponseTime) ? `${avgResponseTime.toFixed(2)}s` : '—';
  const rowsValue = typeof rowsFetchedTotal === 'number' ? rowsFetchedTotal.toLocaleString() : '—';
  const memoryValue = typeof heapUsedMB === 'number' ? `${heapUsedMB} MB` : '—';

  const applyStateStyle = (el, active) => {
    el.style.color = active ? '#bde3ff' : '#8cc9ff';
    el.style.background = active ? 'rgba(140, 201, 255, 0.22)' : 'transparent';
  };

  const handleHover = (e, entering, active) => {
    if (entering) {
      e.currentTarget.style.color = '#bde3ff';
      e.currentTarget.style.background = 'rgba(140, 201, 255, 0.12)';
      return;
    }
    applyStateStyle(e.currentTarget, active);
  };

  const toolsetStyle = {
    ...linkStyles,
    ...(toolsetActive ? { color: '#bde3ff', background: 'rgba(140, 201, 255, 0.22)' } : null),
  };

  return (
    <footer style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      background: 'linear-gradient(180deg, rgba(28,31,37,0.96) 0%, rgba(18,20,23,0.98) 100%)',
      borderTop: '1px solid rgba(44,54,66,0.75)',
      color: '#d9e6f5',
      minHeight: 30,
      fontSize: '0.78rem',
      gap: 16,
      width: '100%',
      flexShrink: 0,
      zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Metric icon={ramIconUrl} label="RAM" value={memoryValue} />
        <Metric icon={rowsIconUrl} label="Rows" value={rowsValue} />
        <Metric icon={avgIconUrl} label="Avg" value={formattedAvg} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={onFreeContent}
          style={linkStyles}
          onMouseEnter={(e) => handleHover(e, true, false)}
          onMouseLeave={(e) => handleHover(e, false, false)}
        >
          Free
        </button>
        <button
          type="button"
          onClick={() => onToggleToolset?.()}
          style={toolsetStyle}
          aria-expanded={toolsetActive}
          onMouseEnter={(e) => handleHover(e, true, true)}
          onMouseLeave={(e) => handleHover(e, false, toolsetActive)}
        >
          <img src={toolsetIconUrl} alt="" aria-hidden="true" style={{ width: 14, height: 14, display: 'block' }} />
          Toolset
        </button>
      </div>
    </footer>
  );
};

export default FooterBar;
