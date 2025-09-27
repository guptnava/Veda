import React, { useMemo, useState } from 'react';
import StandaloneChrome from './StandaloneChrome';
import PinnedTableView from './PinnedTableView';

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

  return (
    <StandaloneChrome title="Worksheet Viewer">
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
    </StandaloneChrome>
  );
}
