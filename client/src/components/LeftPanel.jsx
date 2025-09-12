import React, { useMemo, useState, useRef } from 'react';
import IconClear from '../icons/clear.svg';
import IconDownload from '../icons/download.svg';
import IconUpload from '../icons/upload.svg';


// Icon placeholders (replace with your own paths or pass via props)
const ICON_CLEAR = IconClear;
const ICON_DOWNLOAD = IconDownload;
const ICON_UPLOAD = IconUpload;

const VerticalSlider = ({ label, value, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
    <label htmlFor={props.id} style={{ whiteSpace: 'nowrap' }}>{label}</label>
    <input type="range" {...props} value={value} style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr', width: '8px', height: '50px', padding: '0 5px', cursor: 'pointer' }} />
    <span>{value}</span>
  </div>
);

const LeftPanel = ({
  isPanelOpen,
  temperature,
  setTemperature,
  topK,
  setTopK,
  topP,
  setTopP,
  cosineSimilarityThreshold,
  setCosineSimilarityThreshold,
  tableButtonPermissions,
  setTableButtonPermissions,
  commandHistory,
  onHistoryClick,
  onUpdateHistory,
  // Optional: override icon URLs
  clearIconUrl = ICON_CLEAR,
  downloadIconUrl = ICON_DOWNLOAD,
  uploadIconUrl = ICON_UPLOAD,
}) => {
  // Settings moved to HeaderBar
  const resetSliders = () => {
    setTemperature(0.7);
    setTopK(10);
    setTopP(0.9);
    setCosineSimilarityThreshold(0.58);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: isPanelOpen ? '16px' : '0', backgroundColor: '#252526', color: '#d4d4d4', transition: 'width 0.3s ease-in-out', width: isPanelOpen ? '288px' : '0', overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable both-edges', WebkitOverflowScrolling: 'touch', flexShrink: 0, borderRight: isPanelOpen ? '1px solid #444' : 'none', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1', overflow: 'visible', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Settings</h2>
        </div>

        <hr style={{ borderTop: '1px solid #444', margin: '0 0 16px 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px', padding: '10px 0', flexShrink: 0, flex: 1 }}>
            <VerticalSlider label="Temp" id="temperature" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} />
            <VerticalSlider label="Top K" id="topK" min="1" max="100" step="1" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} />
            <VerticalSlider label="Top P" id="topP" min="0" max="1" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
            <VerticalSlider label="Cosine" id="cosine-similarity" min="0" max="1" step="0.01" value={cosineSimilarityThreshold} onChange={(e) => setCosineSimilarityThreshold(parseFloat(e.target.value))} />
          </div>
          <button
            onClick={resetSliders}
            title="Reset sliders"
            aria-label="Reset sliders to defaults"
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #444', background: '#2d2d2d', color: '#ddd', cursor: 'pointer' }}
          >↺</button>
        </div>

        {/* Settings control moved to header menu; no extra buttons here */}

        {commandHistory && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '4px' }}>History</h3>
              <HistoryActions
                history={commandHistory}
                onUpdateHistory={onUpdateHistory}
                clearIconUrl={clearIconUrl}
                downloadIconUrl={downloadIconUrl}
                uploadIconUrl={uploadIconUrl}
              />
            </div>
            <HistorySection history={commandHistory} onHistoryClick={onHistoryClick} />
          </div>
        )}
      </div>
    </div>
  );
};

// Position and outside-click handling for the settings menu
// Placed after component definition to keep the file simple
// (no settings helpers here)

// Settings helpers removed (menu moved to HeaderBar)

const HistorySection = ({ history, onHistoryClick }) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!Array.isArray(history)) return [];
    const q = query.trim().toLowerCase();
    if (!q) return history.slice().reverse(); // latest first
    return history
      .filter(h => String(h.command || '').toLowerCase().includes(q))
      .reverse();
  }, [history, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <input
        type="text"
        placeholder={`Search ${Array.isArray(history) ? history.length : 0} commands...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%', padding: '6px', borderRadius: 4,
          border: '1px solid #444', background: '#1e1e1e', color: '#d4d4d4'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
        <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div tabIndex={0} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', scrollbarGutter: 'stable both-edges', WebkitOverflowScrolling: 'touch', border: '1px solid #333', borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 ? (
          <span style={{ fontStyle: 'italic', color: '#777' }}>No matches.</span>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={idx}
              className="button-primary"
              onClick={() => onHistoryClick?.(item)}
              title={item.command}
              style={{
                background: '#3d3d3d', border: '1px solid #555', color: '#d4d4d4', fontFamily: 'monospace',
                textAlign: 'left', whiteSpace: 'nowrap'
              }}
            >
              {item.command}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const HistoryActions = ({ history, onUpdateHistory, clearIconUrl, downloadIconUrl, uploadIconUrl }) => {
  const fileInputId = 'history-upload-input';
  const fileInputRef = useRef(null);

  const exportJson = () => {
    try {
      const blob = new Blob([JSON.stringify(history || [], null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veda-history-${new Date().toISOString().slice(0,19)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export history', e);
    }
  };

  const onUpload = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid history file');
      // Ask whether to replace
      const replace = confirm('Replace existing command history? Click Cancel to merge.');
      onUpdateHistory?.((prev = []) => {
        if (replace) return data;
        // Merge by timestamp and command uniqueness
        const combined = [...prev];
        const seen = new Set(prev.map(h => (h.ts || '') + '|' + (h.command || '')));
        for (const h of data) {
          const key = (h.ts || '') + '|' + (h.command || '');
          if (!seen.has(key)) combined.push(h);
        }
        return combined;
      });
    } catch (e) {
      alert('Failed to import history: ' + e.message);
    }
  };

  const iconStyle = { width: 16, height: 16, display: 'block' };
  const btnStyle = {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #444',
    background: '#2b2b2b',
    borderRadius: 6,
    cursor: 'pointer'
  };

  return (
    <div
      role="toolbar"
      aria-label="History actions"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1f1f1f', border: '1px solid #444', borderRadius: 8, padding: 4 }}
    >
      <button
        className="button-icon"
        onClick={() => {
          if (confirm('Clear all command history?')) onUpdateHistory?.([]);
        }}
        title="Clear all history"
        aria-label="Clear all history"
        style={btnStyle}
      >
        <img src={clearIconUrl} alt="" aria-hidden="true" style={iconStyle} />
      </button>
      <button
        className="button-icon"
        onClick={exportJson}
        title="Download history JSON"
        aria-label="Download history JSON"
        style={btnStyle}
      >
        <img src={downloadIconUrl} alt="" aria-hidden="true" style={iconStyle} />
      </button>
      <button
        className="button-icon"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        title="Upload history JSON"
        aria-label="Upload history JSON"
        style={btnStyle}
      >
        <img src={uploadIconUrl} alt="" aria-hidden="true" style={iconStyle} />
      </button>
      <input
        id={fileInputId}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={(e) => onUpload(e.target.files && e.target.files[0])}
      />
    </div>
  );
};

export default LeftPanel;
