// HeaderBar.jsx
import React, { useState, useRef, useEffect } from 'react';
import vedaIcon from '../icons/aimesh.svg';
import menuIcon from '../icons/hamburger.png';

const HeaderBar = ({
  isPanelOpen,
  onTogglePanel,
  tableButtonPermissions,
  setTableButtonPermissions,
  sendSqlToLlm,
  setSendSqlToLlm,
  perfMaxClientRows,
  setPerfMaxClientRows,
  perfMaxScan,
  setPerfMaxScan,
  perfMaxDistinct,
  setPerfMaxDistinct,
  maxVisibleMessages,
  setMaxVisibleMessages,
  clobPreview,
  setClobPreview,
  blobPreview,
  setBlobPreview,
  updateIntervalMs,
  setUpdateIntervalMs,
  minRowsPerUpdate,
  setMinRowsPerUpdate,
  virtualizeOnMaximize,
  setVirtualizeOnMaximize,
  virtMaxClientRows,
  setVirtMaxClientRows,
  virtRowHeight,
  setVirtRowHeight,
  // Server mode toggle
  serverMode,
  setServerMode,
  tableOpsMode,
  setTableOpsMode,
  pushDownDb,
  setPushDownDb,
  logEnabled,
  setLogEnabled,
  trainingUrl,
  setTrainingUrl,
  settingsMenuOpen,
  onSettingsMenuChange,
  title = 'InsightFlow',
  logoUrl = vedaIcon,

  // ✅ NEW: overridable icon URLs (use your own relative paths)
  toggleIconUrl = menuIcon,
}) => {
  const [showSettingsInternal, setShowSettingsInternal] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ right: 0, top: 0 });
  const [settingsTab, setSettingsTab] = useState('permissions'); // 'permissions' | 'narration' | 'training' | 'performance' | 'logging'

  const isSettingsControlled = typeof settingsMenuOpen === 'boolean';
  const showSettings = isSettingsControlled ? settingsMenuOpen : showSettingsInternal;
  const updateShowSettings = (next) => {
    const value = typeof next === 'function' ? next(showSettings) : next;
    if (!isSettingsControlled) {
      setShowSettingsInternal(value);
    }
    onSettingsMenuChange?.(value);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('veda.sendSqlToLlm');
      if (stored != null) setSendSqlToLlm?.(stored === 'true');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { if (typeof sendSqlToLlm === 'boolean') localStorage.setItem('veda.sendSqlToLlm', String(sendSqlToLlm)); } catch {}
  }, [sendSqlToLlm]);

  const baseFs = '0.85rem';
  // ✅ NEW: consistent icon image styling
  const iconImgLg = { width: 18, height: 18, display: 'block' };

  useEffect(() => {
    if (!showSettings) return;
    try {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPos({ right: window.innerWidth - rect.right, top: rect.bottom + 6 });
      }
    } catch {}
  }, [showSettings]);

  useEffect(() => {
    if (!showSettings) return;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      updateShowSettings(false);
    };
    const onScroll = () => updateShowSettings(false);
    const onResize = () => updateShowSettings(false);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize, true);
    };
  }, [showSettings, updateShowSettings]);

  const perm = tableButtonPermissions || {};
  const togglePerm = (key) => setTableButtonPermissions?.((prev) => ({ ...prev, [key]: !prev?.[key] }));

  const brandText = String(title || 'InsightFlow');
  const isInsightFlow = /insight\s*flow/i.test(brandText);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '6px 10px',
        background: '#0e639c',
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes vedaShine { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
        @keyframes ringSpin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* ✅ CHANGED: icon-based toggle button */}
        <button
          onClick={onTogglePanel}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
            borderRadius: 8,
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          aria-label="Toggle settings panel"
          title={isPanelOpen ? 'Close panel' : 'Open panel'}
        >
          <img src={toggleIconUrl} alt="" aria-hidden="true" style={iconImgLg} />
        </button>

        <div
          title="Veda"
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            borderRadius: '50%',
            padding: 1,
            background: 'conic-gradient(from 0deg, #00c6ff 0%, #0072ff 30%, #00e5ff 60%, #00c6ff 100%)',
            boxShadow: '0 0 6px rgba(0, 0, 0, 0.25), 0 0 10px rgba(14,99,156,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {/* subtle rotating ring */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'conic-gradient(from 0deg, rgba(255,255,255,0.15), rgba(255,255,255,0) 30%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0) 100%)',
            animation: 'ringSpin 22s linear infinite' }} />
          <img
            src={logoUrl}
            alt="Earth"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'block',
              objectFit: 'cover',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 0 6px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)',
              filter: 'saturate(1.12) contrast(1.05)',
              transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.06) rotate(-2deg)';
              e.currentTarget.style.boxShadow = 'inset 0 0 8px rgba(0,0,0,0.45), 0 4px 14px rgba(14,99,156,0.45)';
              e.currentTarget.style.filter = 'saturate(1.22) contrast(1.08)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.boxShadow = 'inset 0 0 6px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)';
              e.currentTarget.style.filter = 'saturate(1.12) contrast(1.05)';
            }}
          />
        </div>

        {/* Branded logotype */}
        <div aria-label={brandText} style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {isInsightFlow ? (
              <>
                <span style={{
                  fontSize: '1.55rem',
                  fontWeight: 900,
                  letterSpacing: '0.6px',
                  color: 'transparent',
                  background: 'linear-gradient(180deg, #b3ecff 0%, #6fe3ff 45%, #2dd4f7 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  textShadow: '0 1px 0 rgba(0,0,0,0.25)'
                }}>Insight</span>
                <span style={{
                  fontSize: '1.7rem',
                  fontWeight: 1000,
                  letterSpacing: '0.4px',
                  color: 'transparent',
                  background: 'linear-gradient(180deg, #e1d1ff 0%, #b39cff 45%, #7a7cff 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  textShadow: '0 1px 0 rgba(0,0,0,0.25)'
                }}>Flow</span>
              </>
            ) : (
              <span style={{
                fontSize: '1.7rem',
                fontWeight: 1000,
                letterSpacing: '0.6px',
                color: 'transparent',
                background: 'linear-gradient(180deg, #b3ecff 0%, #6fe3ff 45%, #2dd4f7 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                textShadow: '0 1px 0 rgba(0,0,0,0.25)'
              }}>{brandText}</span>
            )}
          </div>
          {/* Accent bar */}
          <div style={{ height: 3, marginTop: 4, borderRadius: 6, width: '100%', maxWidth: 160, background: 'linear-gradient(90deg, rgba(255,255,255,0.75) 0%, #7ad3ff 35%, #6aa8ff 70%, rgba(255,255,255,0.75) 100%)', boxShadow: '0 2px 8px rgba(0,0,0,0.25), 0 0 10px rgba(122,211,255,0.35)' }} />
        </div>
      </div>

      <div ref={btnRef} style={{ position: 'relative', minHeight: 1, minWidth: 1 }}>
        {showSettings && (
          <div
            id="hb-settings-menu"
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top, right: menuPos.right,
              background: '#1f1f1f', border: '1px solid #444',
              borderRadius: 8, padding: 10, zIndex: 100000,
              display: 'flex', flexDirection: 'column', gap: 8,
              width: 520, maxHeight: '70vh', overflow: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
            }}
          >
              {/* settings tabs unchanged */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {[
                  ['permissions', 'Table Permissions'],
                  ['narration', 'Result Narration'],
                  ['training', 'Training Manager'],
                  ['performance', 'Performance'],
                  ['logging', 'Logging'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettingsTab(key)}
                    style={{
                      padding: '6px 8px', borderRadius: 6,
                      border: settingsTab === key ? '1px solid #1e5b86' : '1px solid #444',
                      background: settingsTab === key ? '#0e639c' : '#2b2b2b',
                      color: '#eee', cursor: 'pointer', fontSize: '0.9rem'
                    }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #333' }} />

              {/* sub-menus unchanged */}
              {settingsTab === 'permissions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['searchAndSorting', 'Search & Sorting'],
                    ['columns', 'Column Picker'],
                    ['pivot', 'Pivot Options'],
                    ['derived', 'Derived Columns'],
                    ['formatting', 'Conditional Formatting'],
                    ['filters', 'Filters'],
                    ['advanced', 'Advanced Filters'],
                    ['headerMenu', 'Header Menus'],
                    ['chart', 'Chart Panel'],
                    ['pagination', 'Pagination'],
                    ['export', 'Export Actions'],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                      <span>{label}</span>
                      <input type="checkbox" checked={perm[key] !== false} onChange={() => togglePerm(key)} />
                    </label>
                  ))}
                </div>
              )}

              {settingsTab === 'narration' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: '#ddd', fontWeight: 600 }}>Result Narration</div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>Pass SQL results to LLM for narration</span>
                    <input type="checkbox" checked={!!sendSqlToLlm} onChange={(e) => setSendSqlToLlm?.(e.target.checked)} />
                  </label>
                  <div style={{ color: '#999', fontSize: '0.85rem' }}>Narration appears below streamed tables when enabled.</div>
                </div>
              )}

              {settingsTab === 'training' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: '#ddd', fontWeight: 600 }}>Training Manager</div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>Hyperlink (opens in new tab):</span>
                    <input
                      type="text"
                      value={trainingUrl}
                      onChange={(e) => setTrainingUrl(e.target.value)}
                      placeholder="https://host:8501"
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#252526', color: '#d4d4d4' }}
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => { try { window.open(trainingUrl, '_blank', 'noopener'); } catch {} }}
                      style={{ padding: '4px 8px' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {/* Keeping text-only here; main toolbar button has icon */}
                        Open Training Manager ↗
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'performance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: '#ddd', fontWeight: 600 }}>Performance</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                    <label style={{ color: '#ccc', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={!!serverMode} onChange={(e) => setServerMode?.(e.target.checked)} />
                      Server Mode (paginate/filter on server)
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Table ops backend</span>
                    <select value={tableOpsMode || 'flask'} onChange={(e) => setTableOpsMode?.(e.target.value)} style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6 }}>
                      <option value="flask">Flask (smart_cache.py)</option>
                      <option value="node">Node</option>
                    </select>
                    <label style={{ color: '#ccc', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={!!pushDownDb} onChange={(e) => setPushDownDb?.(e.target.checked)} /> Push to database
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxClientRows (1–{virtualizeOnMaximize ? (virtMaxClientRows ?? 50000) : 5000})</span>
                    <input
                      type="number"
                      min={1}
                      max={virtualizeOnMaximize ? (virtMaxClientRows ?? 50000) : 5000}
                      value={(perfMaxClientRows ?? 5000) < 0 ? (virtualizeOnMaximize ? (virtMaxClientRows ?? 50000) : 5000) : (perfMaxClientRows ?? 5000)}
                      disabled={(perfMaxClientRows ?? 0) < 0}
                      onChange={(e) => {
                        const cap = virtualizeOnMaximize ? (virtMaxClientRows ?? 50000) : 5000;
                        setPerfMaxClientRows?.(Math.max(1, Math.min(cap, Number(e.target.value) || 1)));
                      }}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={(perfMaxClientRows ?? 0) < 0} onChange={(e) => setPerfMaxClientRows?.(e.target.checked ? -1 : 5000)} /> Full
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8 }}>
                    <label style={{ color: '#ccc', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={!!virtualizeOnMaximize} onChange={(e) => setVirtualizeOnMaximize?.(e.target.checked)} />
                      Virtualize on Maximize (react-window)
                    </label>
                  </div>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>virtMaxClientRows (5000–200000)</span>
                    <input
                      type="number"
                      min={5000}
                      max={200000}
                      value={virtMaxClientRows ?? 50000}
                      onChange={(e) => setVirtMaxClientRows?.(Math.max(5000, Math.min(200000, Number(e.target.value) || 50000)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 120 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>virtRowHeight (18–80 px)</span>
                    <input
                      type="number"
                      min={18}
                      max={80}
                      value={virtRowHeight ?? 28}
                      onChange={(e) => setVirtRowHeight?.(Math.max(18, Math.min(80, Number(e.target.value) || 28)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxScan (1–5000)</span>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={(perfMaxScan ?? 5000) < 0 ? 5000 : (perfMaxScan ?? 5000)}
                      disabled={(perfMaxScan ?? 0) < 0}
                      onChange={(e) => setPerfMaxScan?.(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={(perfMaxScan ?? 0) < 0} onChange={(e) => setPerfMaxScan?.(e.target.checked ? -1 : 5000)} /> Full
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxDistinct (1–50)</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={(perfMaxDistinct ?? 50) < 0 ? 50 : (perfMaxDistinct ?? 50)}
                      disabled={(perfMaxDistinct ?? 0) < 0}
                      onChange={(e) => setPerfMaxDistinct?.(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={(perfMaxDistinct ?? 0) < 0} onChange={(e) => setPerfMaxDistinct?.(e.target.checked ? -1 : 50)} /> Full
                    </label>
                  </div>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxVisibleMessages (1–10)</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxVisibleMessages ?? 5}
                      onChange={(e) => setMaxVisibleMessages?.(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxClobPreview (0–100000)</span>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={clobPreview ?? 8192}
                      onChange={(e) => setClobPreview?.(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 120 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>maxBlobPreview (0–65536)</span>
                    <input
                      type="number"
                      min={0}
                      max={65536}
                      value={blobPreview ?? 2048}
                      onChange={(e) => setBlobPreview?.(Math.max(0, Math.min(65536, Number(e.target.value) || 0)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 120 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>updateIntervalMs (50–5000)</span>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      value={updateIntervalMs ?? 200}
                      onChange={(e) => setUpdateIntervalMs?.(Math.max(50, Math.min(5000, Number(e.target.value) || 200)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                  </label>
                  <label style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>minRowsPerUpdate (10–500)</span>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={minRowsPerUpdate ?? 100}
                      onChange={(e) => setMinRowsPerUpdate?.(Math.max(10, Math.min(500, Number(e.target.value) || 100)))}
                      style={{ padding: '4px 6px', background: '#1e1e1e', color: '#ddd', border: '1px solid #444', borderRadius: 6, width: 100 }}
                    />
                  </label>
                  <div style={{ color: '#999', fontSize: '0.85rem' }}>These caps keep the UI responsive for very large datasets.</div>
                  {/* unchanged performance controls */}
                  {/* ... */}
                </div>
              )}

              {settingsTab === 'logging' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: '#ddd', fontWeight: 600 }}>Logging</div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#ccc', fontSize: '0.9rem' }}>
                    <span>Enable server-side query logging</span>
                    <input type="checkbox" checked={!!logEnabled} onChange={(e) => setLogEnabled?.(e.target.checked)} />
                  </label>
                  <div style={{ color: '#999', fontSize: '0.85rem' }}>
                    When enabled, the database agent logs intent, SQL, and request metadata to query_log.txt.
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </header>
  );
};

export default HeaderBar;
