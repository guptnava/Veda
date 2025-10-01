import React, { useMemo, useState, useRef } from 'react';
import IconClear from '../icons/delete.png';
import IconDownload from '../icons/download.svg';
import IconUpload from '../icons/upload.svg';
import IconHistory from '../icons/history.svg';
import dashboardTheme from '../theme/dashboardTheme';


// Icon placeholders (replace with your own paths or pass via props)
const ICON_CLEAR = IconClear;
const ICON_DOWNLOAD = IconDownload;
const ICON_UPLOAD = IconUpload;
const ICON_HISTORY = IconHistory;

const theme = dashboardTheme;

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
  model,
  onModelChange,
  interactionMode,
  onInteractionModeChange,
  loading,
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

  const selectStyle = {
    width: '100%',
    height: 32,
    padding: '0 10px',
    fontSize: '0.85rem',
    borderRadius: 8,
    background: theme.panelMuted,
    color: theme.textSecondary,
    border: `1px solid ${theme.border}`,
  };

  const sectionStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
    padding: '14px 12px',
    background: theme.surface,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const sectionHeaderStyle = {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: theme.textSecondary,
    letterSpacing: '0.015em',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: isPanelOpen ? '16px' : '0',
        backgroundColor: theme.panel,
        color: theme.textPrimary,
        transition: 'width 0.3s ease-in-out',
        width: isPanelOpen ? '288px' : '0',
        overflowX: 'hidden',
        overflowY: 'auto',
        scrollbarGutter: 'stable both-edges',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0,
        borderRight: isPanelOpen ? `1px solid ${theme.border}` : 'none',
        height: '100%',
        boxShadow: isPanelOpen ? '6px 0 24px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1', overflow: 'visible', minHeight: 0 }}>
        <div style={{ ...sectionStyle, marginBottom: 18 }}>
          <h3 style={sectionHeaderStyle}>Model &amp; Agent</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="leftpanel-model-select" style={{ fontSize: '0.85rem', color: theme.textMuted }}>Model</label>
            <select
              id="leftpanel-model-select"
              value={model}
              onChange={(e) => onModelChange?.(e.target.value)}
              disabled={loading}
              style={selectStyle}
            >
              <option value="None">None</option>
              <option value="dbLLM">Deutsche Bank - dbLLM</option>
              <option value="llama3.2:1b">LLaMA3.2:1b</option>
              <option value="codellama:7b-instruct">CodeLLaMA:7b-instruct</option>
              <option value="sqlcoder">SQLCoder:7b</option>
              <option value="gemma">Gemma</option>
              <option value="llama3">LLaMA3</option>
              <option value="mistral">Mistral</option>
              <option value="phi3">Phi-3</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="leftpanel-agent-select" style={{ fontSize: '0.85rem', color: theme.textMuted }}>Agent</label>
            <select
              id="leftpanel-agent-select"
              value={interactionMode}
              onChange={(e) => onInteractionModeChange?.(e.target.value)}
              disabled={loading}
              style={selectStyle}
            >
              <option value="direct">Developer Assistant</option>
              <option value="database">Database - Direct Intent Routes</option>
              <option value="database1">Database - Direct Intent embeded nomodel Routes</option>
              <option value="restful">API Assistant (Trained)</option>
              <option value="langchain">Database Assistant (Un-Trained)</option>
              <option value="langchainprompt">Database Assistant (Partially Trained)</option>
              <option value="embedded">Database Assistant (Fully Trained)</option>
              <option value="webscrape">Documentation Assistant</option>
              <option value="riskdata">Data Analysis Assistant</option>
              <option value="embedded_narrated">Database Assistant with Narration</option>
              <option value="generic_rag">Database Assistant - Generic RAG</option>
            </select>
          </div>
        </div>

        <div style={{ ...sectionStyle, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={sectionHeaderStyle}>Generation Controls</h3>
              <button
                onClick={resetSliders}
                title="Reset sliders"
                aria-label="Reset sliders to defaults"
                style={{
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.buttonBg,
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.buttonBgHover;
                  e.currentTarget.style.borderColor = theme.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme.buttonBg;
                  e.currentTarget.style.borderColor = theme.border;
                }}
              >↺</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px', paddingTop: 4, flexShrink: 0, flex: 1 }}>
            <VerticalSlider label="Temp" id="temperature" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} />
            <VerticalSlider label="Top K" id="topK" min="1" max="100" step="1" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} />
            <VerticalSlider label="Top P" id="topP" min="0" max="1" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
            <VerticalSlider label="Cosine" id="cosine-similarity" min="0" max="1" step="0.01" value={cosineSimilarityThreshold} onChange={(e) => setCosineSimilarityThreshold(parseFloat(e.target.value))} />
          </div>
        </div>

        {commandHistory && (
          <div style={{ ...sectionStyle, flex: 1.4, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={sectionHeaderStyle}>History</h3>
              <HistoryActions
                history={commandHistory}
                onUpdateHistory={onUpdateHistory}
                clearIconUrl={clearIconUrl}
                downloadIconUrl={downloadIconUrl}
                uploadIconUrl={uploadIconUrl}
              />
            </div>
            <HistorySection history={commandHistory} onHistoryClick={onHistoryClick} historyIconUrl={ICON_HISTORY} />
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

const HistorySection = ({ history, onHistoryClick, historyIconUrl = ICON_HISTORY }) => {
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
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          background: theme.panelMuted,
          color: theme.textPrimary,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: theme.textMuted }}>
        <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div
        tabIndex={0}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'auto',
          scrollbarGutter: 'stable both-edges',
          WebkitOverflowScrolling: 'touch',
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: theme.panelMuted,
        }}
      >
        {filtered.length === 0 ? (
          <span style={{ fontStyle: 'italic', color: theme.textMuted }}>No matches.</span>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onHistoryClick?.(item)}
              title={item.command}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid transparent`,
                background: 'transparent',
                color: theme.textSecondary,
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.accentSoft;
                e.currentTarget.style.borderColor = theme.accent;
                e.currentTarget.style.color = theme.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = theme.textSecondary;
              }}
            >
              <img src={historyIconUrl} alt="" aria-hidden="true" style={{ width: 14, height: 14, display: 'block', opacity: 0.85 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.command}</span>
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
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    borderRadius: 6,
    cursor: 'pointer',
    color: theme.textSecondary,
  };

  return (
    <div
      role="toolbar"
      aria-label="History actions"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: theme.panelMuted,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: 4,
      }}
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
