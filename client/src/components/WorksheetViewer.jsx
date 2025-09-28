import React, { useEffect, useMemo, useState } from 'react';
import StandaloneChrome from './StandaloneChrome';
import PinnedTableView from './PinnedTableView';
import savedViewIcon from '../icons/worksheet_viewer.svg';

export default function WorksheetViewer() {
  const searchParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return null;
    }
  }, []);

  const initialPinnedId = useMemo(() => searchParams?.get('pinnedId') || '', [searchParams]);
  const [pinnedIdInput, setPinnedIdInput] = useState(initialPinnedId);
  const pinnedId = (initialPinnedId || '').trim();
  const [savedViews, setSavedViews] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsError, setViewsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadSavedViews = async () => {
      try {
        setViewsLoading(true);
        setViewsError('');
        const res = await fetch('/api/table/saved_views');
        const ct = res.headers.get('content-type') || '';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) {
          const message = (payload && payload.error)
            || (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
          throw new Error(message);
        }
        const candidate = Array.isArray(payload?.views) ? payload.views : [];
        if (!cancelled) {
          setSavedViews(candidate);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Saved views fetch failed', err);
          setViewsError(err?.message || 'Failed to load saved views');
          setSavedViews([]);
        }
      } finally {
        if (!cancelled) {
          setViewsLoading(false);
        }
      }
    };

    loadSavedViews();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectSavedView = (view) => {
    if (!view) return;
    const pinned = String(
      view.pinId
        || view.pin_id
        || view.pinnedId
        || view.pinned_id
        || '',
    ).trim();
    const nextValue = pinned || view.viewName || view.name || '';
    if (!nextValue) return;
    setPinnedIdInput(nextValue);
    if (!pinned) return;
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('pinnedId', pinned);
      params.set('page', 'worksheet-viewer');
      window.location.search = params.toString();
    } catch {}
  };

  return (
    <StandaloneChrome title="Worksheet Viewer">
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside style={{ width: 280, maxWidth: 320, background: '#0d1017', borderRight: '1px solid #1c2433', color: '#d6def5', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 18px', borderBottom: '1px solid #1c2433', fontSize: '1rem', fontWeight: 600 }}>Saved Views</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {viewsLoading ? (
              <div style={{ color: '#8a9cc0', fontSize: '0.9rem' }}>Loading saved views…</div>
            ) : viewsError ? (
              <div style={{ color: '#ff8686', fontSize: '0.85rem' }}>{viewsError}</div>
            ) : savedViews.length ? (
              savedViews.map((view, idx) => {
                const viewName = view?.viewName || view?.name || 'Untitled view';
                const dataset = view?.datasetSig || view?.dataset_sig || '';
                const pinnedCandidate = String(
                  view?.pinId
                    || view?.pin_id
                    || view?.pinnedId
                    || view?.pinned_id
                    || '',
                ).trim();
                const isActive = pinnedCandidate && pinnedCandidate === pinnedId;
                const key = `${viewName}|${dataset}|${pinnedCandidate}|${idx}`;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleSelectSavedView(view)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: isActive ? '1px solid #0e639c' : '1px solid #1e2736',
                      background: isActive ? 'rgba(14, 99, 156, 0.18)' : 'transparent',
                      color: '#f6f8fc',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, border 0.15s ease',
                    }}
                  >
                    <img src={savedViewIcon} alt="" aria-hidden="true" style={{ width: 24, height: 24, opacity: 0.9 }} />
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{viewName}</span>
                      {dataset ? (
                        <span style={{ color: '#8a9cc0', fontSize: '0.75rem', marginTop: 2 }}>{dataset}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <div style={{ color: '#8a9cc0', fontSize: '0.85rem' }}>No saved views available.</div>
            )}
          </div>
        </aside>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: 24, background: '#11131a', color: '#f6f8fc' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>Worksheet Viewer</h1>
            <p style={{ marginTop: 6, color: '#b5c4de', maxWidth: 560 }}>
              Paste a shared worksheet ID below to load the saved table view, or browse directly if the link already includes an ID.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={pinnedIdInput}
              onChange={(e) => setPinnedIdInput(e.target.value)}
              placeholder="Worksheet ID"
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #2f3542',
                background: '#181c24',
                color: '#f6f8fc',
                minWidth: 220,
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (!pinnedIdInput.trim()) return;
                const params = new URLSearchParams(window.location.search);
                params.set('pinnedId', pinnedIdInput.trim());
                params.set('page', 'worksheet-viewer');
                window.location.search = params.toString();
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid #1e5b86',
                background: '#0e639c',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Open Worksheet
            </button>
          </div>

          {pinnedId ? (
            <div style={{ flex: 1, minHeight: 0, border: '1px solid #233043', borderRadius: 10, overflow: 'hidden' }}>
              <PinnedTableView pinnedId={pinnedId} />
            </div>
          ) : (
            <div style={{ padding: 28, border: '1px dashed #2b3646', borderRadius: 10, color: '#9aaac7' }}>
              Provide a worksheet ID to display saved results shared by teammates.
            </div>
          )}
        </div>
      </div>
    </StandaloneChrome>
  );
}
