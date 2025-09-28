import React, { useEffect, useMemo, useState } from 'react';
import TableComponent from './TableComponent';

const containerStyle = {
  minHeight: '100vh',
  background: '#0b0b0b',
  padding: '12px',
  boxSizing: 'border-box',
  color: '#d4d4d4',
  display: 'flex',
  flexDirection: 'column',
};

const messageStyle = {
  ...containerStyle,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: '12px',
};

const PinnedTableView = ({ pinnedId, onMetrics = () => {} }) => {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pinnedId) {
      setError('Pinned view ID is missing.');
      setPayload(null);
      try { onMetrics({ rowsFetchedTotal: 0, avgResponseTime: NaN }); } catch {}
      return;
    }
    setError('');
    const controller = new AbortController();
    const startedAt = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/table/pinned_view?pinId=${encodeURIComponent(pinnedId)}`, { signal: controller.signal });
        const ct = res.headers.get('content-type') || '';
        let data = null;
        try {
          data = ct.includes('application/json') ? await res.json() : await res.text();
        } catch (e) {
          data = null;
        }
        if (!res.ok) {
          const msg = data && data.error ? data.error : (typeof data === 'string' ? data : `HTTP ${res.status}`);
          throw new Error(msg);
        }
        if (!data || !data.state) {
          throw new Error('Pinned view payload is invalid.');
        }
        const nextPayload = {
          options: data.options || {},
          state: data.state || {},
          schema: data.schema || {},
          query: data.query || {},
          meta: {
            expiresAt: data.expiresAt,
            createdAt: data.createdAt,
          },
        };
        setPayload(nextPayload);
        try {
          const nowStamp = (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : Date.now();
          const elapsed = nowStamp - startedAt;
          const seconds = elapsed / 1000;
          const options = nextPayload.options || {};
          const state = nextPayload.state || {};
          const rowsEstimate = options.totalRows ?? state.totalRows ?? (Array.isArray(state.rows) ? state.rows.length : 0);
          onMetrics({
            rowsFetchedTotal: typeof rowsEstimate === 'number' && Number.isFinite(rowsEstimate) ? rowsEstimate : 0,
            avgResponseTime: Number.isFinite(seconds) ? seconds : NaN,
          });
        } catch (metricErr) {
          console.warn('Pinned view metrics update failed', metricErr);
        }
        try { document.title = 'Pinned Table View'; } catch {}
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Pinned view load failed', err);
        setPayload(null);
        setError(err.message || 'Failed to load the pinned view. See console for details.');
        try { onMetrics({ rowsFetchedTotal: 0, avgResponseTime: NaN }); } catch {}
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [pinnedId]);

  const tableProps = useMemo(() => {
    if (!payload) return null;
    const { options = {}, state = {}, schema = {}, query = {} } = payload;
    const totalEstimate = options.totalRows ?? state.totalRows ?? 0;
    const exportCtx = state.exportContext || options.exportContext || query.exportContext || null;
    const resolvedServerMode = state.serverMode !== undefined ? state.serverMode : (typeof options.serverMode === 'boolean' ? options.serverMode : true);
    const effectiveServerMode = exportCtx ? true : resolvedServerMode;
    return {
      data: [],
      initialPageSize: options.initialPageSize ?? 100,
      initialFontSize: options.initialFontSize ?? 11,
      buttonPermissions: options.buttonPermissions,
      perfOptions: options.perfOptions,
      previewOptions: options.previewOptions,
      exportContext: exportCtx,
      totalRows: totalEstimate,
      serverMode: effectiveServerMode,
      tableOpsMode: options.tableOpsMode ?? state.tableOpsMode ?? 'flask',
      pushDownDb: options.pushDownDb ?? state.pushDownDb ?? false,
      virtualizeOnMaximize: options.virtualizeOnMaximize ?? true,
      virtualRowHeight: options.virtualRowHeight ?? 28,
      initialMaximized: true,
      showMaximizeControl: true,
      initialViewState: state,
      initialSchema: options.initialSchema || schema,
    };
  }, [payload]);

  if (error) {
    return (
      <div style={messageStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Pinned View Unavailable</div>
        <div>{error}</div>
      </div>
    );
  }

  if (loading || !tableProps) {
    return (
      <div style={messageStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Loading pinned view…</div>
        <div>Please wait while we set up your table.</div>
      </div>
    );
  }

  if (tableProps.serverMode && (!tableProps.exportContext || !tableProps.exportContext.prompt || !tableProps.exportContext.mode || !tableProps.exportContext.model)) {
    return (
      <div style={messageStyle}>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Pinned View Unavailable</div>
        <div>Cannot rehydrate this view because the query context is missing.</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <TableComponent {...tableProps} buttonsDisabled={false} />
    </div>
  );
};

export default PinnedTableView;
