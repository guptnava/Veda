import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StandaloneChrome from './StandaloneChrome';
import PinnedTableView from './PinnedTableView';
import savedViewIcon from '../icons/worksheet_viewer.svg';

const getFieldValue = (source, candidates) => {
  if (!source) return undefined;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
};

const getPinnedIdFromView = (view) => {
  const direct = getFieldValue(view, ['pinId', 'pin_id', 'pinnedId', 'pinned_id', 'PIN_ID', 'PINID']);
  if (direct) return String(direct).trim();
  const rawContent = getFieldValue(view, ['content', 'CONTENT', 'viewState', 'view_state']);
  if (rawContent && typeof rawContent === 'object') {
    const inner = getFieldValue(rawContent, ['pinId', 'pin_id', 'pinnedId', 'pinned_id', 'PIN_ID', 'PINID']);
    if (inner) return String(inner).trim();
  }
  return '';
};

const computeViewKey = (view) => {
  if (!view) return '';
  const viewName = getFieldValue(view, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || '';
  const datasetSig = getFieldValue(view, ['datasetSig', 'dataset_sig', 'DATASET_SIG', 'dataset', 'DATASET']) || '';
  const ownerName = getFieldValue(view, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER']) || '';
  const createdAt = getFieldValue(view, ['createdAt', 'created_at', 'CREATED_AT']) || '';
  const pinned = getPinnedIdFromView(view) || '';
  return [viewName, datasetSig, ownerName, createdAt, pinned].join('||');
};

const parseSavedViewContent = (view) => {
  const rawContent = getFieldValue(view, ['content', 'CONTENT', 'viewState', 'view_state']);
  if (rawContent === undefined || rawContent === null) return null;

  const parseMaybeJson = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    return null;
  };

  const topLevel = parseMaybeJson(rawContent);
  if (!topLevel || typeof topLevel !== 'object') {
    return null;
  }

  const nestedState = parseMaybeJson(getFieldValue(topLevel, ['viewState', 'view_state', 'state', 'STATE']));
  if (nestedState && typeof nestedState === 'object') {
    return { state: nestedState, root: topLevel };
  }

  return { state: topLevel, root: topLevel };
};

const buildPinPayloadFromView = (view) => {
  if (!view) return null;
  const parsed = parseSavedViewContent(view);
  const rawState = parsed?.state;
  const topLevel = parsed?.root;
  if (!rawState || typeof rawState !== 'object') return null;

  const state = { ...rawState };

  const normalizeStateProp = (targetKey, candidates) => {
    if (state[targetKey] !== undefined && state[targetKey] !== null) return;
    const value = getFieldValue(rawState, candidates);
    if (value !== undefined && value !== null) {
      state[targetKey] = value;
    }
  };

  normalizeStateProp('exportContext', ['exportContext', 'export_context', 'EXPORT_CONTEXT']);
  normalizeStateProp('query', ['query', 'QUERY']);
  normalizeStateProp('schema', ['schema', 'SCHEMA']);
  normalizeStateProp('options', ['options', 'OPTIONS']);
  normalizeStateProp('tableOpsMode', ['tableOpsMode', 'table_ops_mode', 'TABLE_OPS_MODE']);
  normalizeStateProp('pushDownDb', ['pushDownDb', 'push_down_db', 'PUSH_DOWN_DB']);
  normalizeStateProp('pageSize', ['pageSize', 'initialPageSize', 'PAGE_SIZE', 'INITIAL_PAGE_SIZE']);
  normalizeStateProp('fontSize', ['fontSize', 'initialFontSize', 'FONT_SIZE', 'INITIAL_FONT_SIZE']);
  normalizeStateProp('buttonPermissions', ['buttonPermissions', 'button_permissions', 'BUTTON_PERMISSIONS']);
  normalizeStateProp('totalRows', ['totalRows', 'rowsTotal', 'rowCount', 'totalRowCount', 'TOTAL_ROWS', 'ROWS_TOTAL', 'ROW_COUNT']);
  normalizeStateProp('serverMode', ['serverMode', 'server_mode', 'SERVER_MODE']);
  normalizeStateProp('virtualRowHeight', ['virtualRowHeight', 'virtual_row_height', 'VIRTUAL_ROW_HEIGHT']);
  normalizeStateProp('virtualizeOnMaximize', ['virtualizeOnMaximize', 'virtualize_on_maximize', 'VIRTUALIZE_ON_MAXIMIZE']);

  if (topLevel && typeof topLevel === 'object') {
    if (!state.exportContext && topLevel.exportContext) {
      state.exportContext = topLevel.exportContext;
    }
    if (!state.exportContext && topLevel.content && typeof topLevel.content === 'object') {
      const contentExport = getFieldValue(topLevel.content, ['exportContext', 'export_context', 'EXPORT_CONTEXT']);
      if (contentExport) {
        state.exportContext = contentExport;
      }
    }
    if (!state.exportContext && topLevel.viewState && typeof topLevel.viewState === 'object') {
      const nestedExport = getFieldValue(topLevel.viewState, ['exportContext', 'export_context', 'EXPORT_CONTEXT']);
      if (nestedExport) {
        state.exportContext = nestedExport;
      }
    }
    if (state.tableOpsMode === undefined && topLevel.tableOpsMode !== undefined) {
      state.tableOpsMode = topLevel.tableOpsMode;
    }
    if (state.pushDownDb === undefined && topLevel.pushDownDb !== undefined) {
      state.pushDownDb = topLevel.pushDownDb;
    }
    if (state.pageSize === undefined && topLevel.pageSize !== undefined) {
      state.pageSize = topLevel.pageSize;
    }
    if (state.fontSize === undefined && topLevel.fontSize !== undefined) {
      state.fontSize = topLevel.fontSize;
    }
    if (!state.buttonPermissions && topLevel.buttonPermissions) {
      state.buttonPermissions = topLevel.buttonPermissions;
    }
    if (state.totalRows === undefined && topLevel.totalRows !== undefined) {
      state.totalRows = topLevel.totalRows;
    }
    if (state.serverMode === undefined && topLevel.serverMode !== undefined) {
      state.serverMode = topLevel.serverMode;
    }
    if (state.virtualRowHeight === undefined && topLevel.virtualRowHeight !== undefined) {
      state.virtualRowHeight = topLevel.virtualRowHeight;
    }
    if (state.virtualizeOnMaximize === undefined && topLevel.virtualizeOnMaximize !== undefined) {
      state.virtualizeOnMaximize = topLevel.virtualizeOnMaximize;
    }
  }

  const datasetSig = getFieldValue(view, ['datasetSig', 'dataset_sig', 'DATASET_SIG', 'dataset', 'DATASET'])
    || getFieldValue(state, ['datasetSig', 'dataset_sig', 'DATASET_SIG'])
    || '';
  const owner = getFieldValue(view, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER'])
    || getFieldValue(state, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER'])
    || '';

  const options = {
    ...((topLevel && typeof topLevel === 'object' && topLevel.options) || {}),
    ...(state.options && typeof state.options === 'object' ? state.options : {}),
  };
  const schemaCandidate =
    (topLevel && typeof topLevel === 'object' && topLevel.schema)
    || (state.schema && typeof state.schema === 'object' ? state.schema : null)
    || state.initialSchema
    || {};
  const schema = { ...(schemaCandidate || {}) };
  const headersFromState = getFieldValue(state, ['headers', 'HEADERS']);
  if (headersFromState && !schema.headers) {
    schema.headers = headersFromState;
  }
  if (!schema.columnTypes) {
    const columnTypesFromState = getFieldValue(state, ['columnTypes', 'column_types', 'COLUMN_TYPES']);
    if (columnTypesFromState) {
      schema.columnTypes = columnTypesFromState;
    } else if (state.exportContext && state.exportContext.columnTypes) {
      schema.columnTypes = state.exportContext.columnTypes;
    }
  }
  const query = {
    ...((topLevel && typeof topLevel === 'object' && topLevel.query) || {}),
    ...(state.query && typeof state.query === 'object' ? state.query : {}),
  };

  if (state.exportContext) {
    options.exportContext = state.exportContext;
    query.exportContext = state.exportContext;
  }
  if (state.tableOpsMode !== undefined) {
    options.tableOpsMode = state.tableOpsMode;
    query.tableOpsMode = state.tableOpsMode;
  }
  if (state.pushDownDb !== undefined) {
    options.pushDownDb = state.pushDownDb;
    query.pushDownDb = state.pushDownDb;
  }
  if (state.perfOptions) {
    options.perfOptions = state.perfOptions;
  }
  if (state.previewOptions) {
    options.previewOptions = state.previewOptions;
  }
  if (typeof state.pageSize === 'number') {
    options.initialPageSize = state.pageSize;
  } else if (typeof state.initialPageSize === 'number') {
    options.initialPageSize = state.initialPageSize;
  }
  if (typeof state.fontSize === 'number') {
    options.initialFontSize = state.fontSize;
  } else if (typeof state.initialFontSize === 'number') {
    options.initialFontSize = state.initialFontSize;
  }
  if (state.buttonPermissions) {
    options.buttonPermissions = state.buttonPermissions;
  }
  if (state.totalRows !== undefined) {
    options.totalRows = state.totalRows;
  }
  if (state.serverMode !== undefined) {
    options.serverMode = state.serverMode;
  }
  if (state.virtualRowHeight !== undefined) {
    options.virtualRowHeight = state.virtualRowHeight;
  }
  if (state.virtualizeOnMaximize !== undefined) {
    options.virtualizeOnMaximize = state.virtualizeOnMaximize;
  }
  if (schema && Object.keys(schema).length && !options.initialSchema) {
    options.initialSchema = schema;
  }
  if (options.virtualizeOnMaximize === undefined) {
    options.virtualizeOnMaximize = true;
  }
  if (options.virtualRowHeight === undefined && state.virtualRowHeight !== undefined) {
    options.virtualRowHeight = state.virtualRowHeight;
  }
  if (options.totalRows === undefined && state.totalRows !== undefined) {
    options.totalRows = state.totalRows;
  }

  const normalizeJsonField = (container, key) => {
    if (!container) return;
    const value = container[key];
    if (typeof value === 'string') {
      try {
        container[key] = JSON.parse(value);
      } catch {}
    }
  };

  normalizeJsonField(state, 'exportContext');
  normalizeJsonField(options, 'exportContext');
  normalizeJsonField(query, 'exportContext');

  return {
    datasetSig: datasetSig ? String(datasetSig) : '',
    owner: owner ? String(owner) : undefined,
    state,
    options,
    schema,
    query,
  };
};

const bevelSectionStyle = {
  border: '2px solid #1f2a3b',
  borderRadius: 10,
  background: '#111722',
  boxShadow: 'inset 1px 1px 0 rgba(255, 255, 255, 0.05), inset -1px -1px 0 rgba(0, 0, 0, 0.65)',
  padding: '12px 10px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

export default function WorksheetViewer({ onFooterMetricsChange = () => {}, refreshHeapUsage = () => {} }) {
  const searchParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return null;
    }
  }, []);

  const initialPinnedId = useMemo(() => searchParams?.get('pinnedId') || '', [searchParams]);
  const [activePinnedId, setActivePinnedId] = useState(() => (initialPinnedId || '').trim());
  const [savedViews, setSavedViews] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsError, setViewsError] = useState('');
  const [selectedViewKey, setSelectedViewKey] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [dropError, setDropError] = useState('');
  const [isPinningView, setIsPinningView] = useState(false);
  const [pinningTargetName, setPinningTargetName] = useState('');
  const [lastPinnedViewName, setLastPinnedViewName] = useState('');
  const [expandedDetailKey, setExpandedDetailKey] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [leftViewStateExpanded, setLeftViewStateExpanded] = useState(false);
  const [hoveredViewKey, setHoveredViewKey] = useState('');

  // Legacy placeholders for compatibility with older drop-zone preview logic.
  const previewConfig = null;
  const previewViewName = '';

  const selectedView = useMemo(() => {
    if (!selectedViewKey) return null;
    return savedViews.find(view => computeViewKey(view) === selectedViewKey) || null;
  }, [savedViews, selectedViewKey]);

  useEffect(() => {
    if (!activePinnedId) {
      setLastPinnedViewName('');
    }
  }, [activePinnedId]);

  const selectedViewDetails = useMemo(() => {
    if (!selectedView) return null;
    const viewName = getFieldValue(selectedView, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || '';
    const datasetSig = getFieldValue(selectedView, ['datasetSig', 'dataset_sig', 'DATASET_SIG', 'dataset', 'DATASET']) || '';
    const ownerName = getFieldValue(selectedView, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER']) || '';
    const rawCreated = getFieldValue(selectedView, ['createdAt', 'created_at', 'CREATED_AT']) || '';
    const rawContent = getFieldValue(selectedView, ['content', 'CONTENT', 'viewState', 'view_state']);

    let createdDisplay = rawCreated ? String(rawCreated) : '';
    if (rawCreated) {
      const parsed = new Date(rawCreated);
      if (!Number.isNaN(parsed.getTime())) {
        try {
          createdDisplay = parsed.toISOString().replace('T', ' ').replace('Z', ' UTC');
        } catch {
          createdDisplay = parsed.toLocaleString();
        }
      }
    }

    let formattedContent = '';
    if (rawContent !== undefined && rawContent !== null) {
      if (typeof rawContent === 'string') {
        try {
          const parsed = JSON.parse(rawContent);
          formattedContent = JSON.stringify(parsed, null, 2);
        } catch {
          formattedContent = rawContent;
        }
      } else {
        try {
          formattedContent = JSON.stringify(rawContent, null, 2);
        } catch {
          formattedContent = String(rawContent);
        }
      }
    }

    return {
      viewName,
      datasetSig,
      ownerName,
      createdDisplay,
      formattedContent,
    };
  }, [selectedView]);

  const detailEntries = useMemo(() => {
    if (!selectedViewDetails) return [];
    return [
      { key: 'viewName', label: 'View Name', value: selectedViewDetails.viewName },
      { key: 'datasetSig', label: 'Dataset Signature', value: selectedViewDetails.datasetSig },
      { key: 'ownerName', label: 'Owner', value: selectedViewDetails.ownerName },
      { key: 'createdDisplay', label: 'Created At', value: selectedViewDetails.createdDisplay },
      { key: 'formattedContent', label: 'View State', value: selectedViewDetails.formattedContent, isMultiline: true },
    ];
  }, [selectedViewDetails]);

  const summaryDetailEntries = useMemo(
    () => detailEntries.filter(({ key }) => key !== 'formattedContent'),
    [detailEntries],
  );

  const leftPanelViewState = selectedViewDetails?.formattedContent || '';

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

  useEffect(() => {
    setExpandedDetailKey('');
    setLeftViewStateExpanded(false);
  }, [selectedViewKey]);

  useEffect(() => {
    refreshHeapUsage();
    onFooterMetricsChange({ rowsFetchedTotal: 0, avgResponseTime: NaN });
  }, [refreshHeapUsage, onFooterMetricsChange]);

  const pinSavedView = useCallback(async (view, options = {}) => {
    if (!view) {
      throw new Error('No saved view provided.');
    }
    const payload = buildPinPayloadFromView(view);
    if (!payload || !payload.state) {
      throw new Error('Selected view does not include the state needed to pin it.');
    }
    const { updateUrl = true } = options;
    const requestPayload = { ...payload };
    if (!requestPayload.owner) {
      delete requestPayload.owner;
    }
    if (!requestPayload.options || !Object.keys(requestPayload.options).length) {
      delete requestPayload.options;
    }
    if (!requestPayload.schema || !Object.keys(requestPayload.schema).length) {
      delete requestPayload.schema;
    }
    if (!requestPayload.query || !Object.keys(requestPayload.query).length) {
      delete requestPayload.query;
    }

    const res = await fetch('/api/table/pin_view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const ct = res.headers.get('content-type') || '';
    let resp = null;
    try {
      resp = ct.includes('application/json') ? await res.json() : await res.text();
    } catch {
      resp = null;
    }

    if (!res.ok || !resp || !resp.pinId) {
      const message = resp && resp.error
        ? resp.error
        : (typeof resp === 'string' ? resp : `HTTP ${res.status}`);
      throw new Error(message || 'Failed to pin saved view.');
    }

    const pinId = String(resp.pinId);
    setActivePinnedId(pinId);

    if (updateUrl && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('pinnedId', pinId);
        url.searchParams.set('page', 'worksheet-viewer');
        const nextSearch = url.searchParams.toString();
        window.history.replaceState({}, '', `${url.pathname}?${nextSearch}`);
      } catch {}
    }

    return { pinId, ttlMinutes: resp.ttlMinutes };
  }, [setActivePinnedId]);

  const handleSelectSavedView = useCallback(async (view, options = {}) => {
    if (!view) return;
    const { updateUrl = true } = options;
    const key = computeViewKey(view);
    if (key) {
      setSelectedViewKey(key);
    } else {
      setSelectedViewKey('');
    }

    const rawViewName = getFieldValue(view, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || '';
    const viewName = rawViewName && typeof rawViewName === 'string' ? rawViewName.trim() : '';
    const effectiveViewName = viewName || 'Saved View';
    setPinningTargetName(effectiveViewName);
    setDropError('');
    setIsPinningView(true);
    onFooterMetricsChange({ rowsFetchedTotal: 0, avgResponseTime: NaN });

    try {
      const result = await pinSavedView(view, { updateUrl });
      setLastPinnedViewName(effectiveViewName);
      return result;
    } catch (err) {
      console.error('Saved view pin failed', err);
      setLastPinnedViewName('');
      setDropError(err?.message || 'Failed to pin saved view');
      throw err;
    } finally {
      setIsPinningView(false);
      setPinningTargetName('');
    }
  }, [pinSavedView, onFooterMetricsChange]);

  const handleDragStart = useCallback((event, view) => {
    if (!event?.dataTransfer || !view) return;
    try {
      const payload = JSON.stringify({ kind: 'saved-view', view });
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', payload);
      event.dataTransfer.setData('text/plain', payload);
    } catch (err) {
      console.warn('Saved view drag start failed', err);
    }
  }, []);

  const handleDropArea = useCallback(async (event) => {
    event.preventDefault();
    setDropActive(false);
    setDropError('');
    try {
      const txt = event?.dataTransfer?.getData('application/json')
        || event?.dataTransfer?.getData('text/plain');
      if (!txt) throw new Error('Missing saved view payload');
      let parsed = null;
      try {
        parsed = JSON.parse(txt);
      } catch (parseErr) {
        throw new Error('Could not parse saved view payload');
      }
      const viewMeta = parsed && parsed.kind === 'saved-view' && parsed.view
        ? parsed.view
        : (parsed && typeof parsed === 'object' ? parsed : null);
      if (!viewMeta || typeof viewMeta !== 'object') {
        throw new Error('Invalid saved view metadata');
      }

      await handleSelectSavedView(viewMeta, { updateUrl: false });
    } catch (err) {
      setDropError(err?.message || 'Failed to handle dropped view');
    }
  }, [handleSelectSavedView]);

  useEffect(() => {
    if (!savedViews.length) {
      if (selectedViewKey) {
        setSelectedViewKey('');
      }
      return;
    }

    if (selectedViewKey) {
      const stillExists = savedViews.some(view => computeViewKey(view) === selectedViewKey);
      if (!stillExists) {
        setSelectedViewKey('');
      }
      return;
    }

    if (activePinnedId) {
      const match = savedViews.find(view => getPinnedIdFromView(view) === activePinnedId);
      if (match) {
        const matchKey = computeViewKey(match);
        if (matchKey) {
          setSelectedViewKey(matchKey);
        }
      }
    }
  }, [savedViews, selectedViewKey, activePinnedId]);

  return (
    <StandaloneChrome title="Worksheet Viewer">
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div
          style={{
            width: leftPanelOpen ? 280 : 52,
            transition: 'width 0.2s ease',
            background: '#0d1017',
            borderRight: '1px solid #1c2433',
            color: '#d6def5',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            paddingBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setLeftPanelOpen(prev => !prev)}
            style={{
              padding: leftPanelOpen ? '10px 12px' : '12px 10px',
              border: 'none',
              borderBottom: '1px solid #1c2433',
              background: 'transparent',
              color: '#87b4e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: leftPanelOpen ? 'space-between' : 'center',
              gap: 8,
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            {leftPanelOpen ? (
              <>
                <span style={{ fontSize: '0.85rem', letterSpacing: 0.4 }}>Saved Views</span>
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>«</span>
              </>
            ) : (
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>»</span>
            )}
          </button>
          {leftPanelOpen ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: '12px 10px',
                minHeight: 0,
              }}
            >
              <div style={{ ...bevelSectionStyle, flex: 1.5 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#9ab5e9',
                  }}
                >
                  Saved Views
                </div>
                <div
                  style={{
                    flex: 1,
                    marginTop: 8,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    paddingRight: 2,
                  }}
                >
                  {viewsLoading ? (
                    <div style={{ color: '#8a9cc0', fontSize: '0.82rem' }}>Loading saved views…</div>
                  ) : viewsError ? (
                    <div style={{ color: '#ff8686', fontSize: '0.8rem' }}>{viewsError}</div>
                  ) : savedViews.length ? (
                    savedViews.map((view, idx) => {
                      const viewName = getFieldValue(view, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || 'Untitled view';
                      const pinnedCandidate = getPinnedIdFromView(view);
                      const viewKey = computeViewKey(view) || `${idx}`;
                      const isActive = selectedViewKey
                        ? viewKey === selectedViewKey
                        : Boolean(pinnedCandidate && pinnedCandidate === activePinnedId);
                      const isHover = hoveredViewKey === viewKey;
                      const key = `${viewKey}|${idx}`;
                      return (
                        <button
                          type="button"
                          key={key}
                          draggable
                          onDragStart={(event) => handleDragStart(event, view)}
                          onClick={() => {
                            handleSelectSavedView(view).catch(() => {});
                          }}
                          onMouseEnter={() => setHoveredViewKey(viewKey)}
                          onMouseLeave={() => setHoveredViewKey('')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: isActive ? 'rgba(14, 99, 156, 0.24)' : (isHover ? 'rgba(23, 34, 49, 0.72)' : 'transparent'),
                            color: '#e7ecf8',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease, border 0.15s ease',
                          }}
                        >
                          <img src={savedViewIcon} alt="" aria-hidden="true" style={{ width: 18, height: 18, opacity: 0.82 }} />
                          <span style={{ flex: 1, fontSize: '0.76rem', fontWeight: 600, letterSpacing: 0.2 }}>{viewName}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ color: '#8a9cc0', fontSize: '0.8rem' }}>No saved views available.</div>
                  )}
                </div>
              </div>
              <div style={{ ...bevelSectionStyle, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#9ab5e9',
                  }}
                >
                  Saved View Details
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    overflowY: 'auto',
                    paddingRight: 2,
                  }}
                >
                  {selectedView ? (
                    (() => {
                      const hasSummary = summaryDetailEntries.length > 0;
                      const hasViewState = Boolean(leftPanelViewState && leftPanelViewState.trim());
                      if (!hasSummary && !hasViewState) {
                        return <div style={{ fontSize: '0.78rem', color: '#8a9cc0' }}>No metadata available for this view.</div>;
                      }
                      return (
                        <>
                          {hasSummary
                            ? summaryDetailEntries.map(({ key, label, value }) => {
                                const readableValue = value === undefined || value === null || value === '' ? '—' : String(value);
                                return (
                                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: '0.7rem', color: '#6f87b8', fontWeight: 600, letterSpacing: 0.4 }}>
                                      {label}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: '#e3e9f7', lineHeight: 1.4 }}>
                                      {readableValue}
                                    </span>
                                  </div>
                                );
                              })
                            : null}
                          {hasViewState ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ fontSize: '0.7rem', color: '#6f87b8', fontWeight: 600, letterSpacing: 0.4 }}>
                                View State
                              </span>
                              <div
                                style={{
                                  border: '1px solid #1f2a3b',
                                  borderRadius: 8,
                                  background: '#10131b',
                                  padding: '8px 10px',
                                  maxHeight: leftViewStateExpanded ? 260 : 96,
                                  overflow: leftViewStateExpanded ? 'auto' : 'hidden',
                                }}
                              >
                                <pre
                                  style={{
                                    margin: 0,
                                    fontSize: '0.72rem',
                                    lineHeight: 1.5,
                                    color: '#c7d5f2',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {leftPanelViewState}
                                </pre>
                              </div>
                              <button
                                type="button"
                                onClick={() => setLeftViewStateExpanded(prev => !prev)}
                                style={{
                                  alignSelf: 'flex-start',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #1e5b86',
                                  background: leftViewStateExpanded ? 'rgba(14, 99, 156, 0.2)' : 'transparent',
                                  color: '#8cc9ff',
                                  cursor: 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              >
                                {leftViewStateExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            </div>
                          ) : null}
                        </>
                      );
                    })()
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#8a9cc0' }}>
                      Select a saved view to display its details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, display: 'flex', minHeight: 0, background: '#11131a', color: '#f6f8fc', paddingBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: 24, paddingBottom: 0, minWidth: 0, minHeight: 0 }}>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!dropActive) setDropActive(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDropActive(false);
              }
            }}
            onDrop={handleDropArea}
            style={{
              border: dropActive ? '2px dashed #0e639c' : '2px dashed #2b3646',
              background: dropActive ? 'rgba(14, 99, 156, 0.12)' : 'transparent',
              borderRadius: 12,
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              color: '#c7d5f2',
              minHeight: 0,
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Drop Zone</div>
            <div style={{ fontSize: '0.9rem', color: '#9aaac7' }}>
              Select or drop a saved view to pin it and load the pinned worksheet right here.
              {previewConfig ? '' : ''}
            </div>
            {dropError ? (
              <div style={{ fontSize: '0.85rem', color: '#ff8686' }}>{dropError}</div>
            ) : null}
            {isPinningView ? (
              <div style={{ fontSize: '0.85rem', color: '#8a9cc0' }}>
                Pinning {pinningTargetName || 'saved view'}…
              </div>
            ) : null}
            {activePinnedId ? (
              <>
                <div style={{ fontSize: '0.82rem', color: '#9aaac7' }}>
                  Showing pinned view
                  {(lastPinnedViewName || previewViewName) ? (
                    <> for <span style={{ color: '#b9cef5', fontWeight: 600 }}>{lastPinnedViewName || previewViewName}</span></>
                  ) : null}
                  {` (ID ${activePinnedId}).`}
                </div>
                <div style={{ flex: 1, minHeight: 320, border: '1px solid #233043', borderRadius: 10, overflow: 'hidden', background: '#10131b' }}>
                  <PinnedTableView
                    pinnedId={activePinnedId}
                    onMetrics={(metrics) => {
                      try {
                        onFooterMetricsChange({
                          rowsFetchedTotal: metrics?.rowsFetchedTotal ?? 0,
                          avgResponseTime: metrics?.avgResponseTime ?? NaN,
                        });
                        refreshHeapUsage();
                      } catch (err) {
                        console.warn('Footer metrics apply failed', err);
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#8a9cc0' }}>
                Once pinned, the worksheet will appear here with full interactivity.
              </div>
            )}
          </div>
          </div>

          <div style={{ width: detailsOpen ? 380 : 48, transition: 'width 0.2s ease', borderLeft: '1px solid #1c2433', background: '#161b27', display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                setExpandedDetailKey('');
                setDetailsOpen((prev) => !prev);
              }}
              style={{
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid #1c2433',
                background: 'transparent',
                color: '#8cc9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: detailsOpen ? 'space-between' : 'center',
                gap: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {detailsOpen ? (
                <>
                  <span style={{ fontSize: '0.9rem' }}>Saved View Details</span>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>»</span>
                </>
              ) : (
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>«</span>
              )}
            </button>
            {detailsOpen ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>Saved View Details</div>
                {selectedViewDetails ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        paddingBottom: 4,
                      }}
                    >
                      {detailEntries.map(({ key, label, value, isMultiline }) => {
                        const strValue = value === undefined || value === null || value === '' ? '—' : String(value);
                        const isExpanded = key === expandedDetailKey;
                        const truncated = strValue.length > 140 ? `${strValue.slice(0, 140)}…` : strValue;
                        const allowExpand = key === 'datasetSig' || ((isMultiline && strValue !== '—') || strValue.length > 140);
                        return (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ color: '#8ea2c7', fontSize: '0.74rem', letterSpacing: 0.4, textTransform: 'uppercase', marginLeft: 2 }}>{label}</div>
                            <div
                              style={{
                                border: '1px solid #233043',
                                borderRadius: 8,
                                background: '#10131b',
                                padding: '7px 9px',
                                display: 'flex',
                                alignItems: 'center',
                                minHeight: 32,
                                fontSize: '0.88rem',
                                color: '#f6f8fc',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {truncated}
                            </div>
                            {allowExpand ? (
                              <button
                                type="button"
                                onClick={() => setExpandedDetailKey(isExpanded ? '' : key)}
                                style={{
                                  alignSelf: 'flex-start',
                                  marginTop: 2,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #1e5b86',
                                  background: isExpanded ? 'rgba(14, 99, 156, 0.2)' : 'transparent',
                                  color: '#8cc9ff',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                }}
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {expandedDetailKey ? (
                      (() => {
                        const expanded = detailEntries.find(({ key }) => key === expandedDetailKey);
                        if (!expanded) return null;
                        const readableValue = expanded.isMultiline && expanded.value
                          ? expanded.value
                          : (expanded.value === undefined || expanded.value === null || expanded.value === '' ? '—' : String(expanded.value));
                        const isCode = expanded.key === 'formattedContent';
                        return (
                          <div
                            style={{
                              border: '1px solid #233043',
                              borderRadius: 12,
                              background: '#10131b',
                              padding: 16,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                              maxHeight: 320,
                              overflow: 'auto',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{expanded.label}</div>
                              <button
                                type="button"
                                onClick={() => setExpandedDetailKey('')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #1e5b86',
                                  background: 'transparent',
                                  color: '#8cc9ff',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                Close
                              </button>
                            </div>
                            {isCode ? (
                              <pre style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.6, color: '#c7d5f2', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {readableValue || '—'}
                              </pre>
                            ) : (
                              <div style={{ fontSize: '0.88rem', color: '#f6f8fc', lineHeight: 1.5, wordBreak: 'break-word' }}>
                                {readableValue}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : null}
                  </>
                ) : (
                  <div style={{ color: '#9aaac7', fontSize: '0.9rem' }}>
                    Select a saved view from the left panel to inspect its stored metadata and state.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </StandaloneChrome>
  );
}
