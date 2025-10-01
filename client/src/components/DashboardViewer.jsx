import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StandaloneChrome from './StandaloneChrome';
import TableComponent from './TableComponent';
import savedDashboardGlyph from '../icons/dashboard_viewer.svg';
import widgetGlyph from '../icons/align_widget.svg';
import { buildTablePropsForSavedView, getPinnedIdFromSavedView } from '../utils/savedViewTable';

const deriveWidgetKey = (widget, index) => {
  if (!widget || typeof widget !== 'object') return String(index);
  if (widget.id != null && String(widget.id).length > 0) return String(widget.id);
  if (widget.key != null && String(widget.key).length > 0) return String(widget.key);
  if (widget.viewName) return `${widget.viewName}-${index}`;
  if (widget.type) return `${widget.type}-${index}`;
  return String(index);
};

const humanizeKey = (key = '') => {
  return (key || '')
    .toString()
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const pickObject = (...values) => {
  for (const value of values) {
    if (!isPlainObject(value)) continue;
    if (Object.keys(value).length === 0) continue;
    return value;
  }
  return null;
};

const pickDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
};

const widgetSnapshotKey = (widget = {}) => {
  if (!widget || typeof widget !== 'object' || widget.type !== 'view') return null;
  const name = (widget.viewName || widget.name || '').trim();
  if (!name) return null;
  const datasetSig = (widget.datasetSig || widget.dataset || '').trim();
  const owner = (widget.ownerName || widget.owner || '').trim();
  return `${name.toLowerCase()}|${datasetSig.toLowerCase()}|${owner.toLowerCase()}`;
};

const buildSnapshotEntryFromView = (view) => {
  const built = buildTablePropsForSavedView(view);
  if (built && built.tableProps) {
    return { view, tableProps: built.tableProps };
  }
  return { view };
};

const resolveWidgetPreviewProps = (widget = {}, snapshots = {}) => {
  if (!widget || typeof widget !== 'object') {
    return { message: 'Widget metadata unavailable.' };
  }

  if (widget.type === 'view') {
    const candidateObjects = [];
    const snapKey = widgetSnapshotKey(widget);
    if (snapKey && snapshots[snapKey]) {
      const snapshotEntry = snapshots[snapKey];
      if (snapshotEntry.tableProps) {
        return { tableProps: snapshotEntry.tableProps };
      }
      if (snapshotEntry.view) {
        candidateObjects.push(snapshotEntry.view);
      }
    }
    if (widget.viewContent) {
      candidateObjects.push({ ...widget, content: widget.viewContent });
      if (typeof widget.viewContent === 'object') {
        candidateObjects.push(widget.viewContent);
      }
    }
    if (widget.viewState) {
      candidateObjects.push({ ...widget, content: widget.viewState });
    }
    candidateObjects.push(widget);

    for (const candidate of candidateObjects) {
      const bundle = buildTablePropsForSavedView(candidate);
      if (bundle && bundle.tableProps) {
        return { tableProps: bundle.tableProps };
      }
    }
  }

  const meta = widget.viewContent || widget.meta || {};
  const options = widget.options || meta.options || {};
  const state = pickObject(widget.state, meta.state, options.state);

  const exportContext = pickDefined(
    widget.exportContext,
    meta.exportContext,
    state && state.exportContext,
    options.exportContext,
  );

  if (exportContext && exportContext.prompt && exportContext.mode && exportContext.model) {
    const previewOptions = pickDefined(widget.previewOptions, meta.previewOptions, options.previewOptions);
    const perfOptions = pickDefined(widget.perfOptions, meta.perfOptions, options.perfOptions);
    const tableOpsMode = pickDefined(
      widget.tableOpsMode,
      meta.tableOpsMode,
      state && state.tableOpsMode,
      options.tableOpsMode,
    ) || 'flask';
    const pushDownDb = pickDefined(
      widget.pushDownDb,
      meta.pushDownDb,
      state && state.pushDownDb,
      options.pushDownDb,
    ) ?? false;
    const buttonPermissions = pickDefined(
      widget.buttonPermissions,
      meta.buttonPermissions,
      options.buttonPermissions,
    );
    const initialPageSize = pickDefined(
      widget.initialPageSize,
      meta.initialPageSize,
      options.initialPageSize,
    ) || 25;
    const initialFontSize = pickDefined(
      widget.initialFontSize,
      meta.initialFontSize,
      options.initialFontSize,
    ) || 11;
    const totalRows = pickDefined(
      widget.totalRows,
      meta.totalRows,
      state && state.totalRows,
      options.totalRows,
    );
    const initialSchema = pickDefined(
      widget.initialSchema,
      meta.initialSchema,
      options.initialSchema,
      state && state.schema,
    );
    const virtualizeOnMaximize = pickDefined(
      widget.virtualizeOnMaximize,
      meta.virtualizeOnMaximize,
      options.virtualizeOnMaximize,
    );

    return {
      tableProps: {
        data: [],
        exportContext,
        previewOptions,
        perfOptions,
        tableOpsMode,
        pushDownDb,
        buttonPermissions,
        initialPageSize,
        initialFontSize,
        totalRows,
        initialViewState: state,
        initialSchema,
        virtualizeOnMaximize,
        serverMode: true,
      },
    };
  }

  if (widget.type === 'view') {
    const snapKey = widgetSnapshotKey(widget);
    if (snapKey && snapshots[snapKey] && snapshots[snapKey].error) {
      return { message: snapshots[snapKey].error };
    }
    return { message: 'Preview unavailable: this widget is missing export context or model details.' };
  }

  return { message: 'Preview not available for this widget type.' };
};

export default function DashboardViewer() {
  const [layout, setLayout] = useState(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [dashboards, setDashboards] = useState([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [draggingWidgetId, setDraggingWidgetId] = useState(null);
  const [activeWidgetId, setActiveWidgetId] = useState(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [viewSnapshots, setViewSnapshots] = useState({});

  const loadGuardRef = useRef(0);
  const initializedRef = useRef(false);
  const widgetRefs = useRef(new Map());
  const snapshotFetchRef = useRef(new Set());

  const widgets = useMemo(() => (layout && Array.isArray(layout.widgets) ? layout.widgets : []), [layout]);
  const widgetPreviewProps = useMemo(
    () => widgets.map((w) => resolveWidgetPreviewProps(w, viewSnapshots)),
    [widgets, viewSnapshots],
  );

  const updateDashboardQueryParam = useCallback((dashboardName) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (dashboardName) {
        params.set('dashboardView', dashboardName);
        params.set('page', 'dashboard-viewer');
      } else {
        params.delete('dashboardView');
      }
      const suffix = params.toString();
      const nextUrl = `${window.location.pathname}${suffix ? `?${suffix}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    } catch (error) {
      console.warn('Failed to update URL', error);
    }
  }, []);

  const loadDashboardLayout = useCallback(async (dashName, owner, guard) => {
    if (!dashName) {
      if (loadGuardRef.current === guard) {
        setLayout(null);
        setActiveWidgetId(null);
      }
      return;
    }

    setLoadingLayout(true);
    try {
      const qs = new URLSearchParams({ name: dashName });
      if (owner) qs.set('owner', owner);
      const res = await fetch(`/api/dashboard/get?${qs.toString()}`);
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const errMsg = payload && typeof payload === 'object' && payload.error ? payload.error : `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      if (loadGuardRef.current !== guard) return;
      const nextLayout = payload && typeof payload === 'object' ? payload.layout || {} : {};
      const snapshots = payload && typeof payload === 'object' && payload.viewSnapshots && typeof payload.viewSnapshots === 'object'
        ? payload.viewSnapshots
        : {};
      setLayout(nextLayout);
      setViewSnapshots(snapshots);
      setActiveWidgetId(null);
      setMessage('');
    } catch (error) {
      if (loadGuardRef.current === guard) {
        console.error('Dashboard layout load failed', error);
        setLayout(null);
        setMessage('Failed to load dashboard layout');
      }
    } finally {
      if (loadGuardRef.current === guard) {
        setLoadingLayout(false);
      }
    }
  }, []);

  const fetchDashboards = useCallback(async () => {
    setDashboardsLoading(true);
    try {
      const res = await fetch('/api/dashboard/list');
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const errMsg = payload && typeof payload === 'object' && payload.error ? payload.error : `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      const arr = Array.isArray(payload?.dashboards) ? payload.dashboards : [];
      setDashboards(arr);
      return arr;
    } catch (error) {
      console.error('Dashboard list load failed', error);
      setDashboards([]);
      setMessage((prev) => prev || 'Failed to load saved dashboards');
      return [];
    } finally {
      setDashboardsLoading(false);
    }
  }, []);

  const handleSelectDashboard = useCallback(
    (dash) => {
      if (!dash) return;
      const guard = Date.now();
      loadGuardRef.current = guard;
      snapshotFetchRef.current.clear();
      setViewSnapshots({});
      setLayout(null);
      setActiveWidgetId(null);
      const resolved = {
        name: dash.name || '',
        ownerName: dash.ownerName || dash.owner || '',
        createdAt: dash.createdAt || dash.created_at || '',
      };
      setSelectedDashboard(resolved);
      setName(resolved.name);
      setMessage('');
      updateDashboardQueryParam(resolved.name);
      loadDashboardLayout(resolved.name, resolved.ownerName, guard);
    },
    [loadDashboardLayout, updateDashboardQueryParam],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const initialName = (params.get('dashboardView') || '').trim();
    (async () => {
      const list = await fetchDashboards();
      if (!mounted) return;
      if (initialName) {
        const match = list.find((item) => (item?.name || '').toLowerCase() === initialName.toLowerCase());
        if (match) handleSelectDashboard(match);
        else handleSelectDashboard({ name: initialName });
        return;
      }
      if (list.length) handleSelectDashboard(list[0]);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchDashboards, handleSelectDashboard]);

  useEffect(() => {
    if (!selectedDashboard) return;
    const match = dashboards.find((item) => (item?.name || '').toLowerCase() === (selectedDashboard.name || '').toLowerCase());
    if (!match) return;
    const matchOwner = match.ownerName ?? '';
    const selectedOwner = selectedDashboard.ownerName ?? '';
    const matchCreated = match.createdAt ?? '';
    const selectedCreated = selectedDashboard.createdAt ?? '';
    if (matchOwner !== selectedOwner || matchCreated !== selectedCreated) {
      setSelectedDashboard({
        name: match.name || selectedDashboard.name,
        ownerName: matchOwner,
        createdAt: matchCreated,
      });
    }
  }, [dashboards, selectedDashboard]);

  useEffect(() => {
    if (!widgets || widgets.length === 0) return;
    const pending = [];
    widgets.forEach((widget) => {
      if (!widget || widget.type !== 'view') return;
      const key = widgetSnapshotKey(widget);
      if (!key) return;
      if (snapshotFetchRef.current.has(key)) return;
      if (Object.prototype.hasOwnProperty.call(viewSnapshots, key)) return;
      const preview = resolveWidgetPreviewProps(widget, viewSnapshots);
      if (preview && preview.tableProps) return;
      pending.push({ key, widget });
    });
    if (!pending.length) return;
    let cancelled = false;
    pending.forEach(({ key }) => snapshotFetchRef.current.add(key));
    (async () => {
      for (const { key, widget } of pending) {
        try {
          const name = (widget.viewName || widget.name || '').trim();
          if (!name) {
            if (!cancelled) {
              setViewSnapshots((prev) => ({ ...prev, [key]: { error: 'Saved view name missing.' } }));
            }
            continue;
          }
          const params = new URLSearchParams({ viewName: name });
          if (widget.datasetSig) params.set('datasetSig', widget.datasetSig);
          if (widget.ownerName) params.set('owner', widget.ownerName);
          const res = await fetch(`/api/table/saved_view?${params.toString()}`);
          const ct = res.headers.get('content-type') || '';
          const payload = ct.includes('application/json') ? await res.json() : await res.text();
          if (!res.ok) {
            const errMsg = payload && typeof payload === 'object' && payload.error
              ? payload.error
              : (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
            throw new Error(errMsg);
          }
          const viewPayload = payload && typeof payload === 'object' ? payload.view || payload : null;
          if (!viewPayload) {
            if (!cancelled) setViewSnapshots((prev) => ({ ...prev, [key]: { error: 'Saved view payload empty.' } }));
            continue;
          }
          const baseEntry = buildSnapshotEntryFromView(viewPayload);
          if (baseEntry.tableProps && !cancelled) {
            setViewSnapshots((prev) => ({ ...prev, [key]: baseEntry }));
            continue;
          }
          const pinId = getPinnedIdFromSavedView(viewPayload);
          if (pinId) {
            try {
              const pinRes = await fetch(`/api/table/pinned_view?pinId=${encodeURIComponent(pinId)}`);
              const pinCt = pinRes.headers.get('content-type') || '';
              const pinPayload = pinCt.includes('application/json') ? await pinRes.json() : await pinRes.text();
              if (!pinRes.ok) {
                const errMsg = pinPayload && typeof pinPayload === 'object' && pinPayload.error
                  ? pinPayload.error
                  : (typeof pinPayload === 'string' ? pinPayload : `HTTP ${pinRes.status}`);
                throw new Error(errMsg);
              }
              const normalized = {
                viewName: viewPayload.viewName || widget.viewName || name,
                datasetSig: viewPayload.datasetSig || pinPayload.datasetSig || widget.datasetSig || '',
                ownerName: viewPayload.ownerName || pinPayload.owner || widget.ownerName || '',
                content: {
                  viewState: pinPayload.state || {},
                  options: pinPayload.options || {},
                  schema: pinPayload.schema || {},
                  query: pinPayload.query || {},
                },
              };
              const pinnedEntry = buildSnapshotEntryFromView(normalized);
              if (pinnedEntry.tableProps && !cancelled) {
                setViewSnapshots((prev) => ({ ...prev, [key]: pinnedEntry }));
                continue;
              }
            } catch (pinnedErr) {
              if (!cancelled) {
                setViewSnapshots((prev) => ({ ...prev, [key]: { error: pinnedErr?.message || 'Failed to load pinned snapshot.' } }));
                continue;
              }
            }
          }
          if (!cancelled) {
            const message = baseEntry.tableProps ? undefined : 'Preview unavailable: this saved view is missing snapshot data.';
            setViewSnapshots((prev) => ({ ...prev, [key]: message ? { ...baseEntry, error: message } : baseEntry }));
          }
        } catch (err) {
          if (!cancelled) {
            setViewSnapshots((prev) => ({ ...prev, [key]: { error: err?.message || 'Failed to load saved view.' } }));
          }
        } finally {
          snapshotFetchRef.current.delete(key);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [widgets, viewSnapshots]);

  const handleDropOnCanvas = useCallback((event) => {
    event.preventDefault();
    const droppedId = event.dataTransfer.getData('text/plain');
    if (!droppedId) return;
    setActiveWidgetId(droppedId);
    setDraggingWidgetId(null);
    const node = widgetRefs.current.get(droppedId);
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleDragOverCanvas = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <StandaloneChrome title="Dashboard Browser">
      <div style={{ flex: 1, display: 'flex', background: '#101216', color: '#f7f9fc', minHeight: 0 }}>
        <div
          style={{
            width: leftCollapsed ? 56 : 320,
            transition: 'width 0.2s ease',
            background: '#121722',
            borderRight: '1px solid #1f2733',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: leftCollapsed ? 'center' : 'space-between',
              padding: leftCollapsed ? '10px 0' : '12px 16px',
              borderBottom: '1px solid #1f2733',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setLeftCollapsed((prev) => !prev)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid #2c323d',
                background: '#181f2c',
                color: '#d0d8e8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {leftCollapsed ? '>' : '<'}
            </button>
            {!leftCollapsed && <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#dce6f8' }}>Dashboards</div>}
          </div>
          {leftCollapsed ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {dashboardsLoading && <div style={{ fontSize: '0.75rem', color: '#8a96aa' }}>…</div>}
              {dashboards.map((dash) => {
                const key = `${dash.name || 'unnamed'}|${dash.ownerName || ''}`;
                const isSelected = selectedDashboard && (dash.name || '').toLowerCase() === (selectedDashboard.name || '').toLowerCase();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectDashboard(dash)}
                    title={dash.name || 'Dashboard'}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: isSelected ? '1px solid #3c8bff' : '1px solid transparent',
                      background: isSelected ? '#1f2a3d' : '#0f131d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <img src={savedDashboardGlyph} alt="Dashboard" style={{ width: 20, height: 20, opacity: 0.85 }} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.02em', color: '#9fb3d0', textTransform: 'uppercase', marginBottom: 10 }}>
                  Saved Dashboards
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dashboardsLoading && <div style={{ fontSize: '0.85rem', color: '#8a96aa' }}>Loading…</div>}
                  {!dashboardsLoading && dashboards.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#7685a0' }}>No dashboards saved yet.</div>
                  )}
                  {dashboards.map((dash) => {
                    const key = `${dash.name || 'unnamed'}|${dash.ownerName || ''}`;
                    const isSelected = selectedDashboard && (dash.name || '').toLowerCase() === (selectedDashboard.name || '').toLowerCase();
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectDashboard(dash)}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: isSelected ? '#1a2537' : '#0e1420',
                          color: '#d7e2f5',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
                          transition: 'background 0.15s ease, transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#142033';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#0e1420';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <img src={savedDashboardGlyph} alt="Dashboard icon" style={{ width: 18, height: 18, opacity: 0.9 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#e2ebff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {dash.name || 'Untitled Dashboard'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '6px 14px', borderBottom: '1px solid #1d2735', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{name || 'Dashboard Browser'}</div>
            {message && <div style={{ color: '#9cdcfe', fontSize: '0.72rem', lineHeight: 1.1 }}>{message}</div>}
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div
              onDragOver={handleDragOverCanvas}
              onDrop={handleDropOnCanvas}
              style={{
                flex: 1,
                padding: 16,
                overflow: 'auto',
                borderRight: '1px solid #1d2735',
                background: '#0d1119',
                transition: 'outline 0.2s ease',
                outline: draggingWidgetId ? '1px dashed #3c8bff' : '1px dashed transparent',
              }}
            >
              {loadingLayout && (
                <div style={{ color: '#8fa7c6', marginBottom: 12, fontSize: '0.9rem' }}>Loading layout…</div>
              )}
              {!loadingLayout && (!widgets || widgets.length === 0) && (
                <div style={{ color: '#7685a0', fontSize: '0.95rem' }}>No widgets configured for this dashboard.</div>
              )}
              {widgets && widgets.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 14 }}>
                  {widgets.map((widget, idx) => {
                    const key = deriveWidgetKey(widget, idx);
                    const isActive = activeWidgetId && key === activeWidgetId;
                    const preview = widgetPreviewProps[idx] || null;
                    const tableProps = preview && preview.tableProps ? preview.tableProps : null;
                    const infoMessage = preview && preview.message ? preview.message : null;
                    return (
                      <div
                        key={key}
                        ref={(node) => {
                          if (node) widgetRefs.current.set(key, node);
                          else widgetRefs.current.delete(key);
                        }}
                        onClick={() => setActiveWidgetId(key)}
                        style={{
                          gridColumn: `span ${Math.max(1, Math.min(12, widget.w || widget.width || 4))}`,
                          background: isActive ? '#162238' : '#131b2b',
                          border: isActive ? '2px solid #3c8bff' : '1px solid #1d2735',
                          borderRadius: 10,
                          padding: 16,
                          boxShadow: isActive ? '0 0 0 1px rgba(60,139,255,0.35)' : 'none',
                          cursor: tableProps ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: 240,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                            {widget.type === 'view' ? (widget.viewName || 'Untitled view') : humanizeKey(widget.type || 'Widget')}
                          </div>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          {tableProps ? (
                            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                              <div style={{ flex: 1, minHeight: 0, border: '1px solid #1d2735', borderRadius: 8, overflow: 'hidden', background: '#0e1624' }}>
                                <TableComponent
                                  {...tableProps}
                                  dashboardMode
                                  showMaximizeControl={false}
                                  buttonsDisabled={false}
                                />
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#b8c3d6', fontSize: '0.85rem', lineHeight: 1.4 }}>
                              {infoMessage
                                || (widget.type === 'view'
                                  ? 'Preview unavailable: this widget is missing export context or model details.'
                                  : 'Drag widgets from the palette to focus on specific items.')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              style={{
                width: paletteCollapsed ? 48 : 280,
                background: '#101520',
                padding: paletteCollapsed ? '12px 10px' : 20,
                display: 'flex',
                flexDirection: 'column',
                gap: paletteCollapsed ? 12 : 14,
                alignItems: paletteCollapsed ? 'center' : 'stretch',
                transition: 'width 0.2s ease',
                borderLeft: '1px solid #1d2735',
                overflow: 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => setPaletteCollapsed((prev) => !prev)}
                title={paletteCollapsed ? 'Expand palette' : 'Collapse palette'}
                style={{
                  width: paletteCollapsed ? 28 : '100%',
                  alignSelf: paletteCollapsed ? 'center' : 'flex-end',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: paletteCollapsed ? 6 : '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #1d2735',
                  background: '#162238',
                  color: '#dce6f8',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {paletteCollapsed ? '≡' : 'Hide Widgets'}
              </button>
              {!paletteCollapsed && (
                <>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dce6f8' }}>Widget Palette</div>
                  <div style={{ fontSize: '0.78rem', color: '#7a8aa5' }}>
                    Drag a widget card into the layout area to spotlight it. Clicking highlights the widget in-place.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                    {widgets.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#7685a0' }}>Nothing to drag yet.</div>
                    )}
                    {widgets.map((widget, idx) => {
                      const key = deriveWidgetKey(widget, idx);
                      const isActive = activeWidgetId && key === activeWidgetId;
                      return (
                        <div
                          key={`palette-${key}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', key);
                            event.dataTransfer.effectAllowed = 'move';
                            setDraggingWidgetId(key);
                          }}
                          onDragEnd={() => setDraggingWidgetId(null)}
                          onClick={() => setActiveWidgetId(key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: isActive ? '1px solid #3c8bff' : '1px solid #1d2735',
                            background: isActive ? '#182539' : '#0f1726',
                            color: '#d7e2f5',
                            cursor: 'grab',
                          }}
                        >
                          <img src={widgetGlyph} alt="Widget" style={{ width: 22, height: 22, opacity: 0.85 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2ebff' }}>
                              {widget.type === 'view' ? `View: ${widget.viewName}` : humanizeKey(widget.type || `Widget ${idx + 1}`)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#8da0bd' }}>
                              {widget.datasetSig ? `Dataset: ${widget.datasetSig}` : 'Drag to focus'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </StandaloneChrome>
  );
}
