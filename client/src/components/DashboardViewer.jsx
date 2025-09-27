import React, { useEffect, useState, useMemo } from 'react';
import StandaloneChrome from './StandaloneChrome';

export default function DashboardViewer() {
  const [layout, setLayout] = useState(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [choices, setChoices] = useState([]);
  const [pick, setPick] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = (params.get('dashboardView') || '').trim();
    setName(n);
    const load = async (nm) => {
      try {
        if (!nm) return false;
        const qs = new URLSearchParams({ name: nm });
        const res = await fetch(`/api/dashboard/get?${qs.toString()}`);
        const ct = res.headers.get('content-type') || '';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) throw new Error((payload && payload.error) || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
        setLayout(payload.layout || {});
        setMessage('');
        return true;
      } catch (e) {
        setMessage('Failed to load dashboard');
        return false;
      }
    };
    const loadList = async () => {
      try {
        const res = await fetch('/api/dashboard/list');
        const ct = res.headers.get('content-type') || '';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        const arr = (payload && payload.dashboards) || [];
        setChoices(Array.isArray(arr) ? arr : []);
      } catch {}
    };
    (async () => {
      const ok = await load(n);
      if (!ok) await loadList();
    })();
  }, []);

  const widgets = useMemo(() => {
    return (layout && layout.widgets) ? layout.widgets : [];
  }, [layout]);

  return (
    <StandaloneChrome title="Dashboard Viewer">
      <div style={{ flex: 1, padding: 24, background: '#101216', color: '#f7f9fc' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.35rem', marginBottom: 12 }}>{name || 'Dashboard Viewer'}</div>
        {message && (
          <div style={{ color: '#9cdcfe', marginBottom: 14 }}>
            {message}
            {choices && choices.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}>Open:</label>
                <select
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#1e1e1e', color: '#ddd' }}
                >
                  <option value="">Select…</option>
                  {choices.map((d) => (
                    <option key={`${d.name}|${d.createdAt}`} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (pick) window.location.search = `?page=dashboard-viewer&dashboardView=${encodeURIComponent(pick)}`;
                  }}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}
                >
                  Open
                </button>
              </div>
            )}
          </div>
        )}
        {(!widgets || widgets.length === 0) ? (
          <div style={{ color: '#aaa' }}>No widgets.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
            {widgets.map((w, idx) => (
              <div
                key={w.id || idx}
                style={{
                  gridColumn: `span ${Math.max(1, Math.min(12, w.w || 6))}`,
                  background: '#1b1f27',
                  border: '1px solid #2c323d',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>{w.type === 'view' ? `View: ${w.viewName}` : (w.type || 'Widget')}</div>
                <div style={{ color: '#b8c3d6', fontSize: '0.9rem' }}>
                  This widget will render data for saved view "{w.viewName}" (dataset: {w.datasetSig}).
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StandaloneChrome>
  );
}
