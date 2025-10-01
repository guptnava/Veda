import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StandaloneChrome from './StandaloneChrome';
import TableComponent from './TableComponent';
import savedViewIcon from '../icons/worksheet_viewer.svg';
import { buildTablePropsForSavedView, extractSavedViewDetails, getFieldValue, getPinnedIdFromSavedView } from '../utils/savedViewTable';

const computeViewKey = (view) => {
  if (!view) return '';
  const viewName = getFieldValue(view, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || '';
  const datasetSig = getFieldValue(view, ['datasetSig', 'dataset_sig', 'DATASET_SIG', 'dataset', 'DATASET']) || '';
  const ownerName = getFieldValue(view, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER']) || '';
  const createdAt = getFieldValue(view, ['createdAt', 'created_at', 'CREATED_AT']) || '';
  const pinned = getPinnedIdFromSavedView(view) || '';
  return [viewName, datasetSig, ownerName, createdAt, pinned].join('||');
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

const MIN_LEFT_PANEL_SECTION_HEIGHT = 108;

function WorksheetViewerInner({ onFooterMetricsChange = () => {}, refreshHeapUsage = () => {} }) {
  const [savedViews, setSavedViews] = useState([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [viewsError, setViewsError] = useState('');
  const [selectedViewKey, setSelectedViewKey] = useState('');
  const [activeViewKey, setActiveViewKey] = useState('');
  const [activeViewDetails, setActiveViewDetails] = useState(null);
  const [activeTableProps, setActiveTableProps] = useState(null);
  const [tableRenderKey, setTableRenderKey] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const [dropError, setDropError] = useState('');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [leftViewStateExpanded, setLeftViewStateExpanded] = useState(false);
  const [hoveredViewKey, setHoveredViewKey] = useState('');
  const [savedListCollapsed, setSavedListCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [leftPanelSplit, setLeftPanelSplit] = useState(0.6);
  const leftPanelContentRef = useRef(null);
  const pendingResizeCleanupRef = useRef(null);

  const detailEntries = useMemo(() => {
    if (!activeViewDetails) return [];
    return [
      { key: 'viewName', label: 'View Name', value: activeViewDetails.viewName },
      { key: 'datasetSig', label: 'Dataset Signature', value: activeViewDetails.datasetSig },
      { key: 'ownerName', label: 'Owner', value: activeViewDetails.ownerName },
      { key: 'createdDisplay', label: 'Created At', value: activeViewDetails.createdDisplay },
      { key: 'formattedContent', label: 'View State', value: activeViewDetails.formattedContent, isMultiline: true },
    ];
  }, [activeViewDetails]);

  const summaryDetailEntries = useMemo(
    () => detailEntries.filter(({ key }) => key !== 'formattedContent'),
    [detailEntries],
  );

  const leftPanelViewState = activeViewDetails?.formattedContent || '';

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
    setLeftViewStateExpanded(false);
  }, [activeViewDetails]);

  useEffect(() => {
    if (detailsCollapsed) {
      setLeftViewStateExpanded(false);
    }
  }, [detailsCollapsed]);

  const handleLeftPanelResizeStart = useCallback((startEvent) => {
    if (!leftPanelContentRef.current || savedListCollapsed || detailsCollapsed) {
      return;
    }
    startEvent.preventDefault();
    const panel = leftPanelContentRef.current;
    const getClientY = (evt) => (evt.touches && evt.touches.length ? evt.touches[0].clientY : evt.clientY);
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    if (pendingResizeCleanupRef.current) {
      pendingResizeCleanupRef.current();
      pendingResizeCleanupRef.current = null;
    }

    const handlePointerMove = (moveEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const rect = panel.getBoundingClientRect();
      if (!rect.height) return;
      const clientY = getClientY(moveEvent);
      const relativeY = clientY - rect.top;
      const minOffset = MIN_LEFT_PANEL_SECTION_HEIGHT;
      const maxOffset = rect.height - MIN_LEFT_PANEL_SECTION_HEIGHT;
      const clampedOffset = Math.min(Math.max(relativeY, minOffset), Math.max(minOffset, maxOffset));
      const ratio = Math.min(0.85, Math.max(0.15, clampedOffset / rect.height));
      setLeftPanelSplit(ratio);
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
      pendingResizeCleanupRef.current = null;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);
    pendingResizeCleanupRef.current = handlePointerUp;
  }, [detailsCollapsed, savedListCollapsed]);

  const savedSectionStyle = useMemo(() => ({
    ...bevelSectionStyle,
    flex: savedListCollapsed ? '0 0 auto' : `${leftPanelSplit} 1 0%`,
    padding: savedListCollapsed ? '10px 10px 8px' : bevelSectionStyle.padding,
    overflow: 'hidden',
    transition: 'flex 0.18s ease',
  }), [savedListCollapsed, leftPanelSplit]);

  const detailsSectionStyle = useMemo(() => ({
    ...bevelSectionStyle,
    flex: detailsCollapsed ? '0 0 auto' : `${Math.max(0.1, (1 - leftPanelSplit) * 1.3)} 1 0%`,
    padding: detailsCollapsed ? '10px 10px 8px' : bevelSectionStyle.padding,
    overflow: 'hidden',
    transition: 'flex 0.18s ease',
  }), [detailsCollapsed, leftPanelSplit]);

  const resizerVisible = !savedListCollapsed && !detailsCollapsed;

  useEffect(() => () => {
    if (pendingResizeCleanupRef.current) {
      pendingResizeCleanupRef.current();
    }
  }, []);

  const initMetricsRef = useRef(false);
  useEffect(() => {
    if (initMetricsRef.current) return;
    try {
      refreshHeapUsage();
      onFooterMetricsChange({ rowsFetchedTotal: 0, avgResponseTime: NaN });
    } catch {}
    initMetricsRef.current = true;
  }, [refreshHeapUsage, onFooterMetricsChange]);

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

  const handleSelectSavedView = useCallback((view) => {
    if (!view) return;
    const key = computeViewKey(view);
    if (key) {
      setSelectedViewKey(key);
    } else {
      setSelectedViewKey('');
    }
  }, []);

  const handleDropArea = useCallback((event) => {
    event.preventDefault();
    setDropActive(false);
    setDropError('');
    try {
      const types = Array.from(event?.dataTransfer?.types || []);
      if (types.includes('text/pivot-field')) {
        return;
      }
      const txt = event?.dataTransfer?.getData('application/json')
        || event?.dataTransfer?.getData('text/plain');
      if (!txt) return;
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

      const computedKey = computeViewKey(viewMeta);
      if (computedKey) {
        setSelectedViewKey(computedKey);
        setActiveViewKey(computedKey);
      } else {
        setSelectedViewKey('');
        setActiveViewKey('');
      }
      const tableBundle = buildTablePropsForSavedView(viewMeta);
      if (!tableBundle || !tableBundle.tableProps) {
        throw new Error('Dropped view does not include table state.');
      }
      const details = extractSavedViewDetails(viewMeta) || null;
      setActiveViewDetails(details);
      setActiveTableProps({ ...tableBundle.tableProps });
      setTableRenderKey(prev => prev + 1);
      try {
        const total = tableBundle.tableProps.totalRows ?? tableBundle.tableProps.data?.length ?? 0;
        onFooterMetricsChange({ rowsFetchedTotal: total, avgResponseTime: NaN });
        refreshHeapUsage();
      } catch {}
      setLeftViewStateExpanded(false);
    } catch (err) {
      setDropError(err?.message || 'Failed to handle dropped view');
      setActiveViewKey('');
      setActiveViewDetails(null);
      setActiveTableProps(null);
      setTableRenderKey(0);
    }
  }, [onFooterMetricsChange, refreshHeapUsage]);

  useEffect(() => {
    if (!savedViews.length) {
      if (selectedViewKey) {
        setSelectedViewKey('');
      }
      if (activeViewKey) {
        setActiveViewKey('');
      }
      if (activeViewDetails || activeTableProps) {
        setActiveViewDetails(null);
        setActiveTableProps(null);
        setTableRenderKey(0);
      }
      return;
    }

    if (selectedViewKey) {
      const stillExists = savedViews.some(view => computeViewKey(view) === selectedViewKey);
      if (!stillExists) {
        setSelectedViewKey('');
      }
    }
  }, [savedViews, selectedViewKey, activeViewKey, activeViewDetails, activeTableProps]);

  useEffect(() => {
    if (!activeViewKey) return;
    const exists = savedViews.some(view => computeViewKey(view) === activeViewKey);
    if (!exists) {
      setActiveViewKey('');
      setActiveViewDetails(null);
      setActiveTableProps(null);
    }
  }, [activeViewKey, savedViews]);

  return (
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
              ref={leftPanelContentRef}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 10px',
                minHeight: 0,
              }}
            >
              <div style={savedSectionStyle}>
                <button
                  type="button"
                  onClick={() => setSavedListCollapsed(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    border: 'none',
                    background: 'transparent',
                    color: '#9ab5e9',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    padding: '2px 2px 4px',
                  }}
                  aria-expanded={!savedListCollapsed}
                >
                  <span>Saved Views</span>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{savedListCollapsed ? '▸' : '▾'}</span>
                </button>
                {!savedListCollapsed ? (
                  <div
                    style={{
                      flex: 1,
                      marginTop: 6,
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
                        const viewKey = computeViewKey(view) || `${idx}`;
                        const isActive = viewKey === selectedViewKey;
                        const isHover = hoveredViewKey === viewKey;
                        const key = `${viewKey}|${idx}`;
                        return (
                          <button
                            type="button"
                            key={key}
                            draggable
                            onDragStart={(event) => handleDragStart(event, view)}
                            onClick={() => handleSelectSavedView(view)}
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
                ) : null}
              </div>
              {resizerVisible ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  onMouseDown={handleLeftPanelResizeStart}
                  onTouchStart={handleLeftPanelResizeStart}
                  onDoubleClick={() => setLeftPanelSplit(0.6)}
                  style={{
                    height: 6,
                    margin: '2px 6px',
                    borderRadius: 999,
                    background: '#1c2433',
                    cursor: 'row-resize',
                    flex: '0 0 auto',
                  }}
                />
              ) : null}
              <div style={detailsSectionStyle}>
                <button
                  type="button"
                  onClick={() => setDetailsCollapsed(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    border: 'none',
                    background: 'transparent',
                    color: '#9ab5e9',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    padding: '2px 2px 4px',
                  }}
                  aria-expanded={!detailsCollapsed}
                >
                  <span>Saved View Details</span>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{detailsCollapsed ? '▸' : '▾'}</span>
                </button>
                {!detailsCollapsed ? (
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      overflowY: 'auto',
                      paddingRight: 2,
                    }}
                  >
                  {activeViewDetails ? (
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
                      Drop a saved view to display its details here.
                    </div>
                  )}
                </div>
                ) : null}
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
                padding: '20px 18px 36px',
                color: '#c7d5f2',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minHeight: 0,
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>Drop Zone</div>
              <div style={{ fontSize: '0.9rem', color: '#9aaac7', lineHeight: 1.4 }}>
                Drag a saved view from the list and drop it here to render its dataset. Selecting a view only highlights it—
                the table refreshes once the view is dropped.
              </div>
              {dropError ? (
                <div style={{ fontSize: '0.85rem', color: '#ff8686' }}>{dropError}</div>
              ) : null}

              {activeTableProps ? (
                <div
                  style={{
                    border: '1px solid #233043',
                    borderRadius: 12,
                    background: '#0f141f',
                    padding: 12,
                    minHeight: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: '#9aaac7', fontWeight: 600 }}>
                    {activeViewDetails?.viewName ? `View: ${activeViewDetails.viewName}` : 'Dropped View'}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {activeTableProps.serverMode || (Array.isArray(activeTableProps.data) && activeTableProps.data.length)
                      ? (
                        <TableComponent
                          key={`drop-table-${tableRenderKey}`}
                          {...activeTableProps}
                          buttonsDisabled={false}
                        />
                      )
                      : (
                        <div
                          style={{
                            border: '1px dashed #2b3646',
                            borderRadius: 12,
                            padding: '28px 24px',
                            color: '#8a9cc0',
                            fontSize: '0.95rem',
                            textAlign: 'center',
                            background: 'rgba(17, 23, 34, 0.35)',
                          }}
                        >
                          This saved view does not include row data to display.
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '1px dashed #2b3646',
                    borderRadius: 12,
                    padding: '32px 28px',
                    color: '#8a9cc0',
                    fontSize: '0.95rem',
                    background: 'rgba(17, 23, 34, 0.6)',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 320,
                  }}
                >
                  Drop a saved view here to render its dataset.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}

export default function WorksheetViewer(props) {
  return (
    <StandaloneChrome title="Worksheet Viewer">
      <WorksheetViewerInner {...props} />
    </StandaloneChrome>
  );
}
