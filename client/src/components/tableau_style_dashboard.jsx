import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import TableComponent from './TableComponent';
import chartIcon from '../icons/chart.svg';
import openIcon from '../icons/load.svg';
import closeIcon from '../icons/close.svg';
import HeaderBar from './HeaderBar';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function TableauStyleDashboard() {
  // Header bar minimal state
  const [hbPanelOpen, setHbPanelOpen] = useState(false);
  const [hbModel, setHbModel] = useState('llama3.2:1b');
  const [hbMode, setHbMode] = useState('direct');
  // Left panel: Saved views
  const [savedViews, setSavedViews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  // Dashboard size (Tableau-like): Automatic or Fixed Size
  const [sizeMode, setSizeMode] = useState('automatic'); // 'automatic' | 'fixed'
  const [fixedWidth, setFixedWidth] = useState(1200);
  const [fixedHeight, setFixedHeight] = useState(800);

  // Grid state
  const [layout, setLayout] = useState([]); // [{i,x,y,w,h}]
  const [widgets, setWidgets] = useState({}); // id -> { id, type, viewName, datasetSig }

  // Fetch saved views
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/table/saved_views');
        const ct = res.headers.get('content-type') || '';
        const payload = ct.includes('application/json') ? await res.json() : await res.text();
        if (!res.ok) throw new Error((payload && payload.error) || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
        const arr = (payload && payload.views) || [];
        setSavedViews(Array.isArray(arr) ? arr : []);
      } catch (e) {
        console.error('saved_views failed', e);
        setSavedViews([]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // Drag from left panel
  const onDragStartView = (e, v) => {
    try {
      const payload = JSON.stringify({
        kind: 'saved-view',
        viewName: v.viewName,
        datasetSig: v.datasetSig,
        content: v.content || v.viewState || v.view_state || null,
      });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };
  const onDragStartContainer = (e, orientation) => {
    try {
      const payload = JSON.stringify({ kind: 'container', orientation: orientation === 'v' ? 'v' : 'h' });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  // Drop onto grid
  const addWidgetAt = (vx, vy, view) => {
    const id = String(Date.now() + Math.random());
    const w = 6, h = 6;
    setWidgets(prev => ({
      ...prev,
      [id]: view?.kind === 'container'
        ? { id, type: 'container', orientation: view.orientation === 'v' ? 'v' : 'h', childLayout: [], childWidgets: {} }
        : { id, type: 'view', viewName: view.viewName, datasetSig: view.datasetSig, viewContent: view.content || null },
    }));
    setLayout(prev => [...prev, { i: id, x: vx ?? 0, y: vy ?? Infinity, w, h }]);
  };

  // Helper: add child widget into a container by id
  const addChildToContainer = (containerId, vx, vy, view) => {
    const meta = widgets[containerId];
    if (!meta || meta.type !== 'container') return;
    const cid = String(Date.now() + Math.random());
    const childLayout = Array.isArray(meta.childLayout) ? meta.childLayout.slice() : [];
    const x = Number.isFinite(vx) ? vx : 0;
    const y = Number.isFinite(vy) ? vy : Infinity;
    const w = 6; const h = 6;
    childLayout.push({ i: cid, x, y, w, h });
    const childWidgets = { ...(meta.childWidgets || {}), [cid]: { id: cid, type: 'view', viewName: view.viewName, datasetSig: view.datasetSig, viewContent: view.content || null } };
    setWidgets(prev => ({ ...prev, [containerId]: { ...meta, childLayout, childWidgets } }));
  };

  const onDrop = (newLayout, layoutItem, e) => {
    try {
      const txt = e?.dataTransfer?.getData('application/json') || e?.dataTransfer?.getData('text/plain');
      if (!txt) return;
      const data = JSON.parse(txt);
      // If dropping inside a container dropzone, skip top-level add
      try {
        if (e?.target?.closest && e.target.closest('.container-dropzone')) return;
      } catch {}
      if (data && data.kind === 'saved-view' && data.viewName) {
        dropGuardRef.current = Date.now();
        addWidgetAt(layoutItem?.x, layoutItem?.y, data);
      } else if (data && data.kind === 'container' && (data.orientation === 'h' || data.orientation === 'v')) {
        dropGuardRef.current = Date.now();
        addWidgetAt(layoutItem?.x, layoutItem?.y, data);
      }
    } catch (err) {
      console.warn('onDrop parse failed', err);
    }
  };

  const removeWidget = (id) => {
    setLayout(prev => prev.filter(l => l.i !== id));
    setWidgets(prev => { const c = { ...prev }; delete c[id]; return c; });
  };

  const onLayoutChange = (l) => {
    const sanitized = Array.isArray(l)
      ? l.filter(it => String(it.i) !== '__dropping__' && !String(it.i).startsWith('__dropping'))
      : [];
    setLayout(sanitized);
  };

  // Save dashboard
  const saveDashboard = async () => {
    try {
      const nm = (name || '').trim();
      if (!nm) { setMessage('Please provide a dashboard name'); return; }
      const widgetsArr = layout.map(item => ({
        id: item.i,
        type: widgets[item.i]?.type,
        viewName: widgets[item.i]?.viewName,
        datasetSig: widgets[item.i]?.datasetSig,
        x: item.x, y: item.y, w: item.w, h: item.h,
      }));
      const body = { name: nm, layout: { widgets: widgetsArr } };
      const res = await fetch('/api/dashboard/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error((payload && payload.error) || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
      setMessage('Dashboard saved');
    } catch (e) {
      console.error('saveDashboard failed', e);
      setMessage('Failed to save dashboard');
    }
  };

  const cols = { lg: 12, md: 12, sm: 8, xs: 6, xxs: 4 };
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const rowHeight = 30;
  const layouts = useMemo(() => ({ lg: layout }), [layout]);
  const dropGuardRef = useRef(0);
  const gridContainerRef = useRef(null);
  const [gridWidthKey, setGridWidthKey] = useState(0);
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = null;
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setGridWidthKey(k => k + 1));
    });
    ro.observe(el);
    return () => { try { ro.disconnect(); } catch {} if (raf) cancelAnimationFrame(raf); };
  }, []);

  const onContainerDrop = (e) => {
    try {
      e.preventDefault();
      e.stopPropagation?.();
      if (Date.now() - (dropGuardRef.current || 0) < 200) return;
      const txt = e?.dataTransfer?.getData('application/json') || e?.dataTransfer?.getData('text/plain');
      if (!txt) return;
      const data = JSON.parse(txt);
      if (!(data && (data.kind === 'saved-view' || data.kind === 'container'))) return;
      const rect = gridContainerRef.current?.getBoundingClientRect();
      if (!rect) { addWidgetAt(0, Infinity, data); return; }
      const scrollLeft = gridContainerRef.current?.scrollLeft || 0;
      const scrollTop = gridContainerRef.current?.scrollTop || 0;
      const pxX = (e.clientX - rect.left) + scrollLeft - 8; // account for grid margin/padding roughly
      const pxY = (e.clientY - rect.top) + scrollTop - 8;
      const colWidth = Math.max(1, (gridContainerRef.current?.clientWidth || rect.width) / (cols.lg || 12));
      const col = Math.max(0, Math.floor(pxX / colWidth));
      const row = Math.max(0, Math.floor(pxY / rowHeight));
      addWidgetAt(col, row, data);
    } catch (err) {
      console.warn('container drop failed', err);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0b0b0b' }}>
      <HeaderBar
        title="C.Board"
        isPanelOpen={hbPanelOpen}
        onTogglePanel={() => setHbPanelOpen(v => !v)}
        model={hbModel}
        onModelChange={setHbModel}
        interactionMode={hbMode}
        onInteractionModeChange={setHbMode}
        loading={false}
      />
      {/* Minor padding under the header */}
      <div style={{ height: 8 }} />
      <style>{`
        .react-grid-item > .react-resizable-handle, .react-grid-item > .react-resizable-handle-e, .react-grid-item > .react-resizable-handle-se {
          z-index: 20 !important; width: 14px !important; height: 14px !important;
        }
        .react-grid-item > .react-resizable-handle-e { right: -4px !important; top: 50% !important; transform: translateY(-50%); cursor: ew-resize !important; }
        /* When dragging leaves a container, hide the placeholder to avoid a lingering reddish shadow */
        .container-dropzone.drag-out .react-grid-placeholder { display: none !important; }
        /* Suppress the TOP-LEVEL grid placeholder while hovering a container dropzone */
        .suppress-top-placeholder .top-grid .react-grid-placeholder { display: none !important; }
        /* Left panel list item hovers */
        .sheet-item { background: transparent; border: none; border-radius: 4px; cursor: grab; }
        .sheet-item:hover { background: rgba(255,255,255,0.06); }
        .object-item { background: transparent; border: none; border-radius: 6px; cursor: grab; }
        .object-item:hover { background: rgba(255,255,255,0.06); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
        <input placeholder="Dashboard name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#1e1e1e', color: '#ddd' }} />
        <button type="button" onClick={saveDashboard} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Save</button>
      </div>
      {message && <div style={{ color: '#9cdcfe', marginBottom: 10 }}>{message}</div>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)',
            gap: 12,
            width: '100%',
            flex: '1 1 auto',
            minWidth: 0,
            ...(sizeMode === 'automatic' ? { height: 'calc(100vh - 160px)',width: '99vw' } : {}),
          }}
        >
        {/* Saved Views (scrollable) */}
        <div
          style={{
            border: '1px solid #333', borderRadius: 8, padding: 10, background: '#1f1f1f',
            ...(sizeMode === 'automatic'
              ? { height: '100%' }
              : { maxHeight: 'calc(100vh - 160px)' }
            ),
            display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden'
          }}
        >
          {/* 1) Size */}
          <div style={{ border: '1px solid #444', borderRadius: 8, padding: 8, background: '#1f1f1f' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 8 }}>
              <label htmlFor="dash-size-mode" style={{ color: '#ddd', fontWeight: 600 }}>Size</label>
              <select
                id="dash-size-mode"
                value={sizeMode}
                onChange={(e) => setSizeMode(e.target.value === 'fixed' ? 'fixed' : 'automatic')}
                style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #444', background: '#252526', color: '#ddd' }}
              >
                <option value="automatic">Automatic</option>
                <option value="fixed">Fixed Size</option>
              </select>
            </div>
            {sizeMode === 'fixed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="dash-fixed-width" style={{ color: '#aaa' }}>Width</label>
                  <input
                    id="dash-fixed-width"
                    type="number"
                    min={320}
                    max={10000}
                    value={fixedWidth}
                    onChange={(e) => setFixedWidth(Math.max(320, Math.min(10000, Number(e.target.value) || 1200)))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #444', background: '#252526', color: '#ddd' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="dash-fixed-height" style={{ color: '#aaa' }}>Height</label>
                  <input
                    id="dash-fixed-height"
                    type="number"
                    min={240}
                    max={10000}
                    value={fixedHeight}
                    onChange={(e) => setFixedHeight(Math.max(240, Math.min(10000, Number(e.target.value) || 800)))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #444', background: '#252526', color: '#ddd' }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* 2) Sheets (Saved Views) */}
          <div style={{ border: '1px solid #444', borderRadius: 8, padding: 8, background: '#1f1f1f', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Sheets</div>
            <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ color: '#aaa' }}>Loading…</div>
            ) : (
              (savedViews && savedViews.length) ? savedViews.map(v => (
                <div
                  key={`${v.viewName}|${v.createdAt}`}
                  draggable
                  onDragStart={(e) => onDragStartView(e, v)}
                  title={`Drag ${v.viewName} to layout`}
                  className="sheet-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', marginBottom: 4, color: '#e6e6e6' }}
                >
                  <img src={chartIcon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9, flex: '0 0 auto' }} />
                  <div style={{
                    color: '#e6e6e6',
                    fontWeight: 600,
                    letterSpacing: 0.2,
                    fontSize: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2
                  }}>
                    {v.viewName}
                  </div>
                </div>
              )) : <div style={{ color: '#aaa' }}>No saved views.</div>
          )}
            </div>
          </div>

          {/* 3) Objects */}
          <div style={{ border: '1px solid #444', borderRadius: 8, padding: 8, background: '#1f1f1f' }}>
            <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Objects</div>
            <div
              draggable
              onDragStart={(e) => onDragStartContainer(e, 'h')}
              title="Drag horizontal container"
              className="object-item"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, marginTop: 4 }}
            >
              <img src={openIcon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9, flex: '0 0 auto' }} />
            <span style={{ color: '#fff', lineHeight: 1.2, fontSize: '12px' }}>Horizontal Container</span>
            </div>
            <div
              draggable
              onDragStart={(e) => onDragStartContainer(e, 'v')}
              title="Drag vertical container"
              className="object-item"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, marginTop: 4 }}
            >
              <img src={openIcon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9, flex: '0 0 auto' }} />
            <span style={{ color: '#fff', lineHeight: 1.2, fontSize: '12px' }}>Vertical Container</span>
            </div>
          </div>
        </div>

        {/* Layout Grid (scrollable) */}
        <div
          ref={gridContainerRef}
          style={{
            border: '1px solid #333', borderRadius: 8, padding: 10, background: '#1b1b1b', overflow: 'auto', width: '100%',
            ...(sizeMode === 'fixed'
              ? { width: fixedWidth, height: fixedHeight }
              : { height: '100%'}
            ),
          }}
          onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch {} }}
          onDrop={onContainerDrop}
        >
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Layout</div>
          <ResponsiveGridLayout
            key={`top:${gridWidthKey}`}
            className="layout top-grid"
            layouts={layouts}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={rowHeight}
            isDroppable
            isResizable
            resizeHandles={['e','s','se']}
            droppingItem={{ i: '__dropping__', w: 6, h: 6 }}
            onDropDragOver={(e) => {
              // If dragging over a container dropzone, suppress top-level placeholder
              try { if (e?.target?.closest && e.target.closest('.container-dropzone')) return false; } catch {}
              return { w: 6, h: 6 };
            }}
            onDrop={onDrop}
            onLayoutChange={onLayoutChange}
            margin={[8, 8]}
            containerPadding={[8, 8]}
            draggableCancel=".widget-toolbar"
          >
            {layout.map(item => {
              const meta = widgets[item.i];
              if (meta?.type === 'container') {
                return (
                  <div key={item.i} style={{ background: '#1f1f1f', border: '1px dashed #555', borderRadius: 6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #333' }}>
                      <div style={{ color: '#fff', fontWeight: 600 }}>{meta.orientation === 'v' ? 'Vertical' : 'Horizontal'} Container</div>
                      <button type="button" onClick={() => removeWidget(item.i)} title="Close" aria-label="Close" style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}>
                        <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 12, height: 12, opacity: 0.9 }} />
                      </button>
                    </div>
                    <div
                      className="container-dropzone"
                      style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 6 }}
                      onDragEnter={(e) => { try { e.currentTarget.classList.remove('drag-out'); gridContainerRef.current?.classList.add('suppress-top-placeholder'); } catch {} }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); try { e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.remove('drag-out'); gridContainerRef.current?.classList.add('suppress-top-placeholder'); } catch {} }}
                      onDragLeave={(e) => { try { e.currentTarget.classList.add('drag-out'); gridContainerRef.current?.classList.remove('suppress-top-placeholder'); } catch {} }}
                      onDrop={(e) => {
                        try {
                          e.preventDefault(); e.stopPropagation();
                          try { e.currentTarget.classList.remove('drag-out'); gridContainerRef.current?.classList.remove('suppress-top-placeholder'); } catch {}
                          // If RGL already handled (drop guard), ignore
                          if (Date.now() - (dropGuardRef.current || 0) < 200) return;
                          const txt = e?.dataTransfer?.getData('application/json') || e?.dataTransfer?.getData('text/plain');
                          if (!txt) return;
                          const data = JSON.parse(txt);
                          if (!(data && data.kind === 'saved-view' && data.viewName)) return;
                          // Rough position mapping for fallback
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pxX = e.clientX - rect.left + e.currentTarget.scrollLeft - 6;
                          const pxY = e.clientY - rect.top + e.currentTarget.scrollTop - 6;
                          const colWidth = Math.max(1, rect.width / (cols.lg || 12));
                          const col = Math.max(0, Math.floor(pxX / colWidth));
                          const row = Math.max(0, Math.floor(pxY / rowHeight));
                          addChildToContainer(item.i, col, row, data);
                        } catch {}
                      }}
                    >
                      <ResponsiveGridLayout
                        key={`${item.i}:${(meta.childLayout || []).length}`}
                        className="layout"
                        layouts={{ lg: meta.childLayout || [] }}
                        breakpoints={breakpoints}
                        cols={cols}
                        rowHeight={rowHeight}
                        isDroppable
                        isResizable
                        resizeHandles={['e','s','se']}
                        droppingItem={{ i: `__dropping__-${item.i}`, w: 6, h: 6 }}
                        onDropDragOver={(e) => {
                          // Only show nested placeholder when actually over this dropzone
                          try {
                            const dz = e?.target?.closest && e.target.closest('.container-dropzone');
                            if (!dz) return false;
                          } catch {}
                          return { w: 6, h: 6 };
                        }}
                        draggableCancel=".child-widget-toolbar, .no-drag"
                        onDrop={(nl, li, e) => {
                          try {
                            const txt = e?.dataTransfer?.getData('application/json') || e?.dataTransfer?.getData('text/plain');
                            if (!txt) return;
                            const data = JSON.parse(txt);
                            if (data && data.kind === 'saved-view' && data.viewName) {
                              dropGuardRef.current = Date.now();
                              const x = li?.x ?? 0; const y = li?.y ?? Infinity;
                              addChildToContainer(item.i, x, y, data);
                            }
                          } catch {}
                        }}
                        onLayoutChange={(l) => {
                          // Save child layout into container meta, drop placeholders and items no longer present
                          setWidgets(prev => {
                            const current = prev[item.i] || meta;
                            const keep = new Set(Object.keys(current.childWidgets || {}));
                            const sanitized = Array.isArray(l)
                              ? l.filter(it => keep.has(String(it.i)) && !String(it.i).startsWith('__dropping__'))
                              : [];
                            return { ...prev, [item.i]: { ...current, childLayout: sanitized } };
                          });
                        }}
                        margin={[6, 6]}
                        containerPadding={[6, 6]}
                      >
                        {(meta.childLayout || [])
                          .filter(ci => !String(ci.i).startsWith('__dropping__'))
                          .filter(ci => (meta.childWidgets || {})[ci.i])
                          .map(ci => (
                          <div key={ci.i} style={{ background: '#222', border: '1px solid #444', borderRadius: 4, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div className="child-widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #333' }}>
                              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{(meta.childWidgets || {})[ci.i]?.viewName || 'View'}</div>
                              <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  setWidgets(prev => {
                                    const cur = prev[item.i] || meta;
                                    const childLayout = (cur.childLayout || []).filter(x => x.i !== ci.i);
                                    const childWidgets = { ...(cur.childWidgets || {}) };
                                    delete childWidgets[ci.i];
                                    return { ...prev, [item.i]: { ...cur, childLayout, childWidgets } };
                                  });
                                }}
                                title="Close"
                                aria-label="Close"
                                style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer' }}
                              >
                                <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 12, height: 12, opacity: 0.9 }} />
                              </button>
                            </div>
                            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 6, color: '#bbb', fontSize: '0.9rem' }}>
                              {((meta.childWidgets || {})[ci.i]?.viewContent?.exportContext) ? (
                                <TableComponent
                                  data={[{}]}
                                  initialPageSize={10}
                                  initialFontSize={11}
                                  buttonsDisabled={true}
                                  perfOptions={{ maxScan: 5000, maxDistinct: 200 }}
                                  previewOptions={{ maxClob: 4096, maxBlob: 1024 }}
                                  exportContext={(meta.childWidgets || {})[ci.i].viewContent.exportContext}
                                  serverMode={true}
                                  tableOpsMode={(meta.childWidgets || {})[ci.i].viewContent.tableOpsMode || 'flask'}
                                  pushDownDb={!!(meta.childWidgets || {})[ci.i].viewContent.pushDownDb}
                                  virtualizeOnMaximize={false}
                                />
                              ) : (
                                <>Saved view: <strong>{(meta.childWidgets || {})[ci.i]?.viewName}</strong> (no preview config).</>
                              )}
                            </div>
                          </div>
                        ))}
                      </ResponsiveGridLayout>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.i} style={{ background: '#222', border: '1px solid #444', borderRadius: 6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #333' }}>
                    <div style={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{widgets[item.i]?.viewName || 'Widget'}</div>
                    <button type="button" onClick={() => removeWidget(item.i)} title="Close" aria-label="Close" style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}>
                      <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 12, height: 12, opacity: 0.9 }} />
                    </button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }}>
                    {widgets[item.i]?.type === 'view' && (widgets[item.i]?.viewContent?.exportContext) ? (
                      <TableComponent
                        data={[{}]}
                        initialPageSize={10}
                        initialFontSize={11}
                        buttonsDisabled={true}
                        perfOptions={{ maxScan: 5000, maxDistinct: 200 }}
                        previewOptions={{ maxClob: 4096, maxBlob: 1024 }}
                        exportContext={widgets[item.i].viewContent.exportContext}
                        serverMode={true}
                        tableOpsMode={widgets[item.i].viewContent.tableOpsMode || 'flask'}
                        pushDownDb={!!widgets[item.i].viewContent.pushDownDb}
                        virtualizeOnMaximize={false}
                      />
                    ) : (
                      <div style={{ color: '#bbb', fontSize: '0.9rem' }}>
                        Saved view: <strong>{widgets[item.i]?.viewName}</strong> (no preview config). Resize freely; content scrolls.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#aaa' }}>
        Tips: drag a view from the left and drop it onto the grid. Use the right/bottom handles to resize. The grid and each widget are scrollable.
      </div>
    </div>
  );
}
