import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import TableComponent from './TableComponent';
import dashboardTheme from '../theme/dashboardTheme';
import chartIcon from '../icons/chart.svg';
import openIcon from '../icons/load.svg';
import closeIcon from '../icons/close.svg';
import HeaderBar from './HeaderBar';
import textIcon from '../icons/text_widget.svg';
import imageIcon from '../icons/image_widget.svg';
import saveIcon from '../icons/save.svg';
import boldIcon from '../icons/bold.svg';
import italicIcon from '../icons/italic.svg';
import leftIcon from '../icons/left.svg';
import centreIcon from '../icons/centre.svg';
import rightIcon from '../icons/right.svg';
import numberIcon from '../icons/number.svg';
import dateIcon from '../icons/date.svg';
import alignWidgetsIcon from '../icons/align_widget.svg';
import distributeWidgetsIcon from '../icons/evenly_distribute.svg';
import lineChartIcon from '../icons/line_chart.svg';
import barChartIcon from '../icons/bar_chart.svg';
import pieChartIcon from '../icons/pie_chart.svg';
import areaChartIcon from '../icons/area_chart.svg';
import candlestickChartIcon from '../icons/candlestick_chart.svg';
import heatmapChartIcon from '../icons/heatmap_chart.svg';
import gaugeChartIcon from '../icons/gauge_chart.svg';
import tabsWidgetIcon from '../icons/tabs_widget.svg';
import drawerWidgetIcon from '../icons/drawer_widget.svg';
import accordionWidgetIcon from '../icons/accordion_widget.svg';
import modalWidgetIcon from '../icons/modal_widget.svg';
import dropdownWidgetIcon from '../icons/dropdown_widget.svg';
import datePickerWidgetIcon from '../icons/date_picker_widget.svg';
import sliderWidgetIcon from '../icons/slider_widget.svg';
import toggleWidgetIcon from '../icons/toggle_widget.svg';
import searchWidgetIcon from '../icons/search_widget.svg';
import kpiWidgetIcon from '../icons/kpi_widget.svg';
import statWidgetIcon from '../icons/stat_widget.svg';
import timelineWidgetIcon from '../icons/timeline_widget.svg';
import mapWidgetIcon from '../icons/map_widget.svg';
import scatterChartIcon from '../icons/scatter_chart.svg';
import borderIcon from '../icons/border.svg';
import fontIcon from '../icons/font.svg';
import fillIcon from '../icons/fill.svg';
import shadingIcon from '../icons/shading.svg';

const ResponsiveGridLayout = WidthProvider(Responsive);
const GRID_COLUMNS = 12;
const theme = dashboardTheme;
const palette = {
  background: theme.background,
  surface: theme.surface,
  panel: theme.panel,
  panelMuted: theme.panelMuted,
  card: theme.card,
  border: theme.border,
  borderMuted: theme.borderMuted,
  textPrimary: theme.textPrimary,
  textSecondary: theme.textSecondary,
  textMuted: theme.textMuted,
  textSubtle: theme.textSubtle,
  accent: theme.accent,
  accentSoft: theme.accentSoft,
  accentSoftHover: theme.accentSoftHover,
  overlay: theme.overlay,
  buttonBg: theme.buttonBg,
  buttonHover: theme.buttonBgHover,
};
const CHART_DEFINITIONS = [
  { type: 'line', label: 'Line Chart', icon: lineChartIcon },
  { type: 'bar', label: 'Bar Chart', icon: barChartIcon },
  { type: 'pie', label: 'Pie Chart', icon: pieChartIcon },
  { type: 'area', label: 'Area Chart', icon: areaChartIcon },
  { type: 'candlestick', label: 'Candlestick Chart', icon: candlestickChartIcon },
  { type: 'heatmap', label: 'Heatmap', icon: heatmapChartIcon },
  { type: 'scatter', label: 'Scatter Chart', icon: scatterChartIcon },
  { type: 'gauge', label: 'Gauge / Meter', icon: gaugeChartIcon },
];
const NAV_WIDGET_DEFINITIONS = [
  { type: 'tabs', label: 'Tabs', icon: tabsWidgetIcon },
  { type: 'drawer', label: 'Drawer / Sidebar', icon: drawerWidgetIcon },
  { type: 'accordion', label: 'Accordion', icon: accordionWidgetIcon },
  { type: 'modal', label: 'Modal / Popup', icon: modalWidgetIcon },
];
const CONTROL_WIDGET_DEFINITIONS = [
  { type: 'dropdown', label: 'Dropdown / Multi-select', icon: dropdownWidgetIcon },
  { type: 'date', label: 'Date Picker', icon: datePickerWidgetIcon },
  { type: 'slider', label: 'Slider', icon: sliderWidgetIcon },
  { type: 'toggle', label: 'Toggle Switch', icon: toggleWidgetIcon },
  { type: 'search', label: 'Search Box', icon: searchWidgetIcon },
];
const DISPLAY_WIDGET_DEFINITIONS = [
  { type: 'kpi', label: 'KPI Card', icon: kpiWidgetIcon },
  { type: 'stat', label: 'Statistic Widget', icon: statWidgetIcon },
  { type: 'timeline', label: 'Timeline Widget', icon: timelineWidgetIcon },
];

export default function TableauStyleDashboard() {
  // Header bar minimal state
  const [hbPanelOpen, setHbPanelOpen] = useState(false);
  const [hbModel, setHbModel] = useState('llama3.2:1b');
  const [hbMode, setHbMode] = useState('direct');
  // Left panel: Saved views
  const [savedViews, setSavedViews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [dashboardName, setDashboardName] = useState('');
  const [saveDraftName, setSaveDraftName] = useState('');
  // Dashboard size (Tableau-like): Automatic or Fixed Size
  const [sizeMode, setSizeMode] = useState('automatic'); // 'automatic' | 'fixed'
  const [fixedWidth, setFixedWidth] = useState(1200);
  const [fixedHeight, setFixedHeight] = useState(800);

  // Grid state
  const [layout, setLayout] = useState([]); // [{i,x,y,w,h}]
  const [widgets, setWidgets] = useState({}); // id -> { id, type, viewName, datasetSig }
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [showNumberMenu, setShowNumberMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [savePanelAlignment, setSavePanelAlignment] = useState('right');
  const [widgetGroupsCollapsed, setWidgetGroupsCollapsed] = useState({
    charts: false,
    nav: false,
    control: false,
    display: false,
  });
  const chartTypeLabelMap = useMemo(() => {
    const map = Object.create(null);
    CHART_DEFINITIONS.forEach(entry => { map[entry.type] = entry.label; });
    return map;
  }, []);
  const navWidgetLabelMap = useMemo(() => {
    const map = Object.create(null);
    NAV_WIDGET_DEFINITIONS.forEach(entry => { map[entry.type] = entry.label; });
    return map;
  }, []);
  const controlWidgetLabelMap = useMemo(() => {
    const map = Object.create(null);
    CONTROL_WIDGET_DEFINITIONS.forEach(entry => { map[entry.type] = entry.label; });
    return map;
  }, []);
  const displayWidgetLabelMap = useMemo(() => {
    const map = Object.create(null);
    DISPLAY_WIDGET_DEFINITIONS.forEach(entry => { map[entry.type] = entry.label; });
    return map;
  }, []);
  const [formatOptions, setFormatOptions] = useState({
    bold: false,
    italic: false,
    border: false,
    borderStyle: 'outline',
    fontFamily: 'Inter',
    fontSize: '14',
    fontColor: palette.textPrimary,
    borderSize: '1',
    borderColor: palette.border,
    fillColor: palette.panel,
    shading: '#00000000',
    textAlign: 'left',
    numberFormat: 'general',
    dateFormat: 'shortDate',
  });

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

  const onDragStartText = (e) => {
    try {
      const payload = JSON.stringify({ kind: 'text', text: 'Text' });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const onDragStartImage = (e) => {
    try {
      const payload = JSON.stringify({ kind: 'image', imageUrl: '' });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const onDragStartChart = (e, chartType) => {
    try {
      const payload = JSON.stringify({ kind: 'chart', chartType });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const onDragStartNavWidget = (e, navType) => {
    try {
      const payload = JSON.stringify({ kind: 'nav', navType });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const onDragStartControl = (e, controlType) => {
    try {
      const payload = JSON.stringify({ kind: 'control', controlType });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const onDragStartDisplay = (e, displayType) => {
    try {
      const payload = JSON.stringify({ kind: 'display', displayType });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', payload);
      e.dataTransfer.effectAllowed = 'copy';
    } catch {}
  };

  const toggleWidgetGroup = (groupKey, customToggle) => {
    if (typeof customToggle === 'function') {
      customToggle();
      return;
    }
    setWidgetGroupsCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const baseObjectItems = [
    {
      key: 'container-h',
      label: 'Horizontal Container',
      icon: openIcon,
      onDragStart: (e) => onDragStartContainer(e, 'h'),
    },
    {
      key: 'container-v',
      label: 'Vertical Container',
      icon: openIcon,
      onDragStart: (e) => onDragStartContainer(e, 'v'),
    },
    {
      key: 'text',
      label: 'Text Widget',
      icon: textIcon,
      onDragStart: onDragStartText,
    },
    {
      key: 'image',
      label: 'Image Widget',
      icon: imageIcon,
      onDragStart: onDragStartImage,
    },
  ];

  const renderWidgetGroup = (groupKey, title, items, dragStart, options = {}) => {
    const collapsed = !!widgetGroupsCollapsed[groupKey];
    const { extraItems = [], renderItem, customGridStyle } = options;
    const combined = [...extraItems, ...items];

    const renderDefault = (item) => {
      const key = item.type || item.key || item.label;
      const handleDrag = item.onDragStart || ((e) => dragStart(e, item.type));
      const label = item.label || 'Widget';
      return (
        <div
          key={key}
          draggable
          onDragStart={handleDrag}
          title={`Drag ${label.toLowerCase()}`}
          className="object-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 6,
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            background: 'rgba(36,36,36,0.6)',
            cursor: 'grab',
          }}
        >
          <img src={item.icon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9 }} />
          <span style={{ color: palette.textPrimary, lineHeight: 1.2, fontSize: '12px' }}>{label}</span>
        </div>
      );
    };

    return (
      <div style={{ marginTop: groupKey === 'charts' ? 10 : 12 }}>
        <button
          type="button"
          onClick={() => toggleWidgetGroup(groupKey)}
          aria-expanded={!collapsed}
          style={{
            width: '100%',
            background: 'rgba(32,32,32,0.6)',
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            padding: '6px 10px',
            color: palette.textPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '12px', letterSpacing: 0.3 }}>{title}</span>
          <span aria-hidden="true" style={{ fontSize: '12px' }}>{collapsed ? '▶' : '▼'}</span>
        </button>
        {!collapsed && (
          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 6,
              ...(customGridStyle || {}),
            }}
          >
            {combined.map(item => {
              const handleDrag = item.onDragStart || ((e) => dragStart(e, item.type));
              if (renderItem) return renderItem(item, handleDrag);
              return renderDefault(item);
            })}
          </div>
        )}
      </div>
    );
  };

  const handleSaveButtonToggle = () => {
    if (showSavePanel) {
      setShowSavePanel(false);
      return;
    }
    setSaveDraftName(dashboardName || '');
    setShowBorderMenu(false);
    setShowNumberMenu(false);
    setShowDateMenu(false);
    setShowSavePanel(true);
  };

  const createWidgetMeta = (id, payload) => {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.kind === 'container') {
      return {
        id,
        type: 'container',
        orientation: payload.orientation === 'v' ? 'v' : 'h',
        childLayout: [],
        childWidgets: {},
      };
    }
    if (payload.kind === 'text') {
      return {
        id,
        type: 'text',
        text: typeof payload.text === 'string' && payload.text.trim() ? payload.text : 'Text',
      };
    }
    if (payload.kind === 'image') {
      return {
        id,
        type: 'image',
        imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : '',
        fileName: '',
        sourceType: 'url',
      };
    }
    if (payload.kind === 'chart' && payload.chartType) {
      const normalized = String(payload.chartType).toLowerCase();
      return {
        id,
        type: 'chart',
        chartType: normalized,
        title: typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : chartTypeLabelMap[normalized] || 'Custom Chart',
        config: payload.config && typeof payload.config === 'object' ? payload.config : null,
      };
    }
    if (payload.kind === 'nav' && payload.navType) {
      const normalized = String(payload.navType).toLowerCase();
      return {
        id,
        type: 'nav',
        navType: normalized,
        title: typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : navWidgetLabelMap[normalized] || 'Navigation Widget',
        config: payload.config && typeof payload.config === 'object' ? payload.config : null,
      };
    }
    if (payload.kind === 'control' && payload.controlType) {
      const normalized = String(payload.controlType).toLowerCase();
      return {
        id,
        type: 'control',
        controlType: normalized,
        title: typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : controlWidgetLabelMap[normalized] || 'Interactive Control',
        config: payload.config && typeof payload.config === 'object' ? payload.config : null,
      };
    }
    if (payload.kind === 'display' && payload.displayType) {
      const normalized = String(payload.displayType).toLowerCase();
      return {
        id,
        type: 'display',
        displayType: normalized,
        title: typeof payload.title === 'string' && payload.title.trim()
          ? payload.title.trim()
          : displayWidgetLabelMap[normalized] || 'Data Display',
        config: payload.config && typeof payload.config === 'object' ? payload.config : null,
      };
    }
    if (payload.kind === 'saved-view' && payload.viewName) {
      return {
        id,
        type: 'view',
        viewName: payload.viewName,
        datasetSig: payload.datasetSig,
        viewContent: payload.content || null,
      };
    }
    return null;
  };

  const normalizeChildLayout = (entries, orientation) => {
    if (!Array.isArray(entries) || !entries.length) return [];
    if (orientation === 'h') {
      const sorted = entries.slice().sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const count = sorted.length;
      const baseWidth = Math.max(1, Math.floor(GRID_COLUMNS / Math.max(1, Math.min(count, GRID_COLUMNS))));
      let cursor = 0;
      return sorted.map((entry, idx) => {
        const remainingCols = Math.max(1, GRID_COLUMNS - cursor);
        let w = idx === count - 1 ? remainingCols : Math.min(baseWidth, remainingCols);
        if (w <= 0) w = 1;
        const h = entry.h && entry.h > 0 ? entry.h : 6;
        const x = Math.min(cursor, Math.max(0, GRID_COLUMNS - w));
        const next = { ...entry, x, y: 0, w, h };
        cursor = x + w;
        return next;
      });
    }
    if (orientation === 'v') {
      const sorted = entries.slice().sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
      let cursor = 0;
      return sorted.map((entry) => {
        const h = entry.h && entry.h > 0 ? entry.h : 6;
        const w = entry.w && entry.w > 0 ? entry.w : 6;
        const next = { ...entry, x: 0, y: cursor, w, h };
        cursor += h;
        return next;
      });
    }
    return entries.slice();
  };

  // Drop onto grid
  const addWidgetAt = (vx, vy, view) => {
    const id = String(Date.now() + Math.random());
    const w = 6, h = 6;
    const meta = createWidgetMeta(id, view);
    if (!meta) return;
    setWidgets(prev => ({
      ...prev,
      [id]: meta,
    }));
    setLayout(prev => [...prev, { i: id, x: vx ?? 0, y: vy ?? Infinity, w, h }]);
  };

  // Helper: add child widget into a container by id
  const addChildToContainer = (containerId, vx, vy, view) => {
    if (view?.kind === 'container') return; // Nested containers not yet supported
    setWidgets(prev => {
      const meta = prev[containerId];
      if (!meta || meta.type !== 'container') return prev;
      const cid = String(Date.now() + Math.random());
      const childMeta = createWidgetMeta(cid, view);
      if (!childMeta) return prev;
      const w = 6; const h = 6;
      const existingLayout = Array.isArray(meta.childLayout) ? meta.childLayout : [];
      let x = Number.isFinite(vx) ? vx : 0;
      let y = Number.isFinite(vy) ? vy : Infinity;
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = Infinity;
      const combinedLayout = [...existingLayout, { i: cid, x, y, w, h }];
      const childLayout = normalizeChildLayout(combinedLayout, meta.orientation);
      const childWidgets = { ...(meta.childWidgets || {}), [cid]: childMeta };
      return { ...prev, [containerId]: { ...meta, childLayout, childWidgets } };
    });
  };

  const updateTextWidget = (id, text, parentId = null) => {
    setWidgets(prev => {
      if (parentId) {
        const container = prev[parentId];
        if (!container || container.type !== 'container') return prev;
        const childMeta = (container.childWidgets || {})[id];
        if (!childMeta || childMeta.type !== 'text') return prev;
        const nextChildWidgets = {
          ...(container.childWidgets || {}),
          [id]: { ...childMeta, text },
        };
        return { ...prev, [parentId]: { ...container, childWidgets: nextChildWidgets } };
      }
      const meta = prev[id];
      if (!meta || meta.type !== 'text') return prev;
      return { ...prev, [id]: { ...meta, text } };
    });
  };

  const updateImageWidget = (id, imageUrl, parentId = null, extras = {}) => {
    setWidgets(prev => {
      if (parentId) {
        const container = prev[parentId];
        if (!container || container.type !== 'container') return prev;
        const childMeta = (container.childWidgets || {})[id];
        if (!childMeta || childMeta.type !== 'image') return prev;
        const nextChildWidgets = {
          ...(container.childWidgets || {}),
          [id]: { ...childMeta, imageUrl, ...extras },
        };
        return { ...prev, [parentId]: { ...container, childWidgets: nextChildWidgets } };
      }
      const meta = prev[id];
      if (!meta || meta.type !== 'image') return prev;
      return { ...prev, [id]: { ...meta, imageUrl, ...extras } };
    });
  };

  const handleImageFileSelect = (widgetId, parentId = null) => (event) => {
    try {
      const file = event?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = typeof reader.result === 'string' ? reader.result : '';
          if (result) {
            updateImageWidget(widgetId, result, parentId, { fileName: file.name || '', sourceType: 'file' });
          }
        } catch (err) {
          console.warn('image widget file load failed', err);
        }
      };
      reader.onerror = (err) => {
        console.warn('image widget file read errored', err);
      };
      reader.readAsDataURL(file);
    } finally {
      if (event?.target) event.target.value = '';
    }
  };

  useEffect(() => {
    if (!showSavePanel) return;
    const onClick = (e) => {
      if (savePanelRef.current && savePanelRef.current.contains(e.target)) return;
      if (saveButtonWrapperRef.current && saveButtonWrapperRef.current.contains(e.target)) return;
      setShowSavePanel(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSavePanel(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keyup', onKey);
    };
  }, [showSavePanel]);

  useLayoutEffect(() => {
    // Keep the save panel inside the viewport even when the toolbar is near an edge.
    if (!showSavePanel) {
      setSavePanelAlignment('right');
      return undefined;
    }
    const alignPanel = () => {
      const panelEl = savePanelRef.current;
      const wrapperEl = saveButtonWrapperRef.current;
      if (!panelEl || !wrapperEl) return;
      const panelWidth = panelEl.offsetWidth || 0;
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const spaceToLeft = wrapperRect.left;
      const spaceToRight = viewportWidth - wrapperRect.right;
      let next = 'right';
      if (panelWidth + 16 > spaceToLeft && spaceToRight >= spaceToLeft) {
        next = 'left';
      }
      setSavePanelAlignment(prev => (prev === next ? prev : next));
    };
    const raf = requestAnimationFrame(alignPanel);
    window.addEventListener('resize', alignPanel);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', alignPanel);
    };
  }, [showSavePanel]);

  useEffect(() => {
    if (!showBorderMenu) return;
    const onClick = (e) => {
      if (borderMenuRef.current && borderMenuRef.current.contains(e.target)) return;
      if (borderButtonRef.current && borderButtonRef.current.contains(e.target)) return;
      setShowBorderMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowBorderMenu(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keyup', onKey);
    };
  }, [showBorderMenu]);

  useEffect(() => {
    if (!showNumberMenu) return;
    const onClick = (e) => {
      if (numberMenuRef.current && numberMenuRef.current.contains(e.target)) return;
      if (numberButtonRef.current && numberButtonRef.current.contains(e.target)) return;
      setShowNumberMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowNumberMenu(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keyup', onKey);
    };
  }, [showNumberMenu]);

  useEffect(() => {
    if (!showDateMenu) return;
    const onClick = (e) => {
      if (dateMenuRef.current && dateMenuRef.current.contains(e.target)) return;
      if (dateButtonRef.current && dateButtonRef.current.contains(e.target)) return;
      setShowDateMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowDateMenu(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keyup', onKey);
    };
  }, [showDateMenu]);

  const toggleFormatOption = (key) => {
    setFormatOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateFormatOption = (key, value) => {
    setFormatOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleAlignWidgets = () => {
    setMessage('Align widgets action coming soon.');
  };

  const handleDistributeWidgets = () => {
    setMessage('Evenly distribute widgets action coming soon.');
  };

  const renderChartPlaceholder = (chartType) => (
    <div style={{ color: palette.textSubtle, fontSize: '0.9rem', lineHeight: 1.4 }}>
      {chartTypeLabelMap[chartType] || 'Custom Chart'} widget placeholder.
      <div style={{ color: palette.textMuted, fontSize: '0.8rem', marginTop: 6 }}>
        Connect this widget to a dataset to render a live visualization.
      </div>
    </div>
  );

  const renderNavPlaceholder = (navType) => (
    <div style={{ color: palette.textSubtle, fontSize: '0.9rem', lineHeight: 1.4 }}>
      {navWidgetLabelMap[navType] || 'Navigation Widget'} placeholder.
      <div style={{ color: palette.textMuted, fontSize: '0.8rem', marginTop: 6 }}>
        Configure content panes and interactions to activate this navigation layout.
      </div>
    </div>
  );

  const renderControlPlaceholder = (controlType) => (
    <div style={{ color: palette.textSubtle, fontSize: '0.9rem', lineHeight: 1.4 }}>
      {controlWidgetLabelMap[controlType] || 'Interactive Control'} placeholder.
      <div style={{ color: palette.textMuted, fontSize: '0.8rem', marginTop: 6 }}>
        Bind this control to filters or parameters to drive the dashboard experience.
      </div>
    </div>
  );

  const renderDisplayPlaceholder = (displayType) => (
    <div style={{ color: palette.textSubtle, fontSize: '0.9rem', lineHeight: 1.4 }}>
      {displayWidgetLabelMap[displayType] || 'Data Display'} placeholder.
      <div style={{ color: palette.textMuted, fontSize: '0.8rem', marginTop: 6 }}>
        Connect metrics or timelines to this widget to surface key insights.
      </div>
    </div>
  );

  const formatButtonBaseStyle = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s ease, border 0.2s ease',
  };

  const getButtonStyle = (active) => ({
    ...formatButtonBaseStyle,
    border: `1px solid ${active ? palette.accent : palette.border}`,
    background: active ? palette.accentSoft : palette.panel,
    color: active ? palette.textPrimary : palette.textSecondary,
  });

  const numberFormatOptions = useMemo(() => ([
    ['general', 'General'],
    ['number', 'Number'],
    ['currency', 'Currency'],
    ['accounting', 'Accounting'],
    ['percentage', 'Percentage'],
    ['scientific', 'Scientific'],
    ['fraction', 'Fraction'],
    ['text', 'Text'],
  ]), []);

  const dateFormatOptions = useMemo(() => ([
    ['shortDate', 'Short Date'],
    ['longDate', 'Long Date'],
    ['time', 'Time'],
    ['dateTime', 'Date & Time'],
    ['custom', 'Custom...'],
  ]), []);

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
      } else if (data && (data.kind === 'text' || data.kind === 'image' || data.kind === 'chart' || data.kind === 'nav' || data.kind === 'control' || data.kind === 'display')) {
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
  const saveDashboard = async ({ targetName, closePanel = true } = {}) => {
    if (!layout.length) {
      setMessage('Add at least one widget before saving');
      return false;
    }
    const effectiveName = (targetName !== undefined
      ? targetName
      : (dashboardName || saveDraftName || '')).trim();
    if (!effectiveName) {
      setMessage('Please provide a dashboard name');
      return false;
    }
    try {
      const widgetsArr = layout.map(item => {
        const meta = widgets[item.i] || {};
        const widget = {
          id: item.i,
          type: meta.type,
          viewName: meta.viewName,
          datasetSig: meta.datasetSig,
          x: item.x, y: item.y, w: item.w, h: item.h,
        };
        if (meta.type === 'text') widget.text = meta.text || '';
        if (meta.type === 'image') {
          widget.imageUrl = meta.imageUrl || '';
          if (meta.fileName) widget.fileName = meta.fileName;
          if (meta.sourceType) widget.sourceType = meta.sourceType;
        }
        if (meta.type === 'chart') {
          widget.chartType = meta.chartType;
          if (meta.title) widget.title = meta.title;
          if (meta.config) widget.config = meta.config;
        }
        if (meta.type === 'nav') {
          widget.navType = meta.navType;
          if (meta.title) widget.title = meta.title;
          if (meta.config) widget.config = meta.config;
        }
        if (meta.type === 'control') {
          widget.controlType = meta.controlType;
          if (meta.title) widget.title = meta.title;
          if (meta.config) widget.config = meta.config;
        }
        if (meta.type === 'display') {
          widget.displayType = meta.displayType;
          if (meta.title) widget.title = meta.title;
          if (meta.config) widget.config = meta.config;
        }
        return widget;
      });
      const body = { name: effectiveName, layout: { widgets: widgetsArr } };
      const res = await fetch('/api/dashboard/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error((payload && payload.error) || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
      const previousName = dashboardName;
      setDashboardName(effectiveName);
      setSaveDraftName(effectiveName);
      if (closePanel) setShowSavePanel(false);
      if (previousName && previousName === effectiveName) {
        setMessage('Dashboard saved');
      } else {
        setMessage(`Dashboard saved as "${effectiveName}"`);
      }
      return true;
    } catch (e) {
      console.error('saveDashboard failed', e);
      setMessage('Failed to save dashboard');
      return false;
    }
  };

  const cols = { lg: 12, md: 12, sm: 8, xs: 6, xxs: 4 };
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const rowHeight = 30;
  const layouts = useMemo(() => ({ lg: layout }), [layout]);
  const dropGuardRef = useRef(0);
  const gridContainerRef = useRef(null);
  const saveButtonWrapperRef = useRef(null);
  const savePanelRef = useRef(null);
  const borderButtonRef = useRef(null);
  const borderMenuRef = useRef(null);
  const numberButtonRef = useRef(null);
  const numberMenuRef = useRef(null);
  const dateButtonRef = useRef(null);
  const dateMenuRef = useRef(null);
  const [gridWidthKey, setGridWidthKey] = useState(0);
  const hasWidgets = layout.length > 0;
  const trimmedDraftName = saveDraftName.trim();
  const canSaveAs = hasWidgets && trimmedDraftName.length > 0;
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
      if (!(data && (data.kind === 'saved-view' || data.kind === 'container' || data.kind === 'text' || data.kind === 'image' || data.kind === 'chart' || data.kind === 'nav' || data.kind === 'control' || data.kind === 'display'))) return;
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: palette.background, color: palette.textPrimary }}>
      <HeaderBar
        title="Dashboard Studio"
        isPanelOpen={hbPanelOpen}
        onTogglePanel={() => setHbPanelOpen(v => !v)}
        model={hbModel}
        onModelChange={setHbModel}
        interactionMode={hbMode}
        onInteractionModeChange={setHbMode}
        loading={false}
      />
      {/* Minor padding under the header */}
      <div style={{ height: 0 }} />
      <style>{`
        .react-grid-item > .react-resizable-handle, .react-grid-item > .react-resizable-handle-e, .react-grid-item > .react-resizable-handle-se {
          z-index: 20 !important; width: 14px !important; height: 14px !important;
        }
        .react-grid-item > .react-resizable-handle-e { right: -4px !important; top: 50% !important; transform: translateY(-50%); cursor: ew-resize !important; }
        .layout .react-grid-placeholder { display: none !important; }
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

      <div style={{ width: '100%', padding: '0 18px 6px', boxSizing: 'border-box', background: palette.panel }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            width: '100%',
            overflow: 'visible',
            padding: '4px 8px',
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            background: palette.panelMuted,
            boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            position: 'relative',
            zIndex: 120,
            fontSize: '0.85rem',
          }}
        >
          <div ref={saveButtonWrapperRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={handleSaveButtonToggle}
              title="Save dashboard"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: showSavePanel ? `1px solid ${palette.accent}` : `1px solid ${palette.border}`,
                background: showSavePanel ? palette.accent : palette.panel,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s ease, border 0.2s ease',
              }}
            >
            <img src={saveIcon} alt="Save dashboard" style={{ width: 17, height: 17 }} />
            </button>
            {showSavePanel && (
              <div
                ref={savePanelRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  ...(savePanelAlignment === 'left'
                    ? { left: 0, right: 'auto' }
                    : { right: 0, left: 'auto' }),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                  background: palette.panel,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                  width: 'min(280px, calc(100vw - 24px))',
                  zIndex: 240,
                }}
              >
                <div style={{ fontWeight: 600, color: palette.textPrimary, fontSize: '0.95rem' }}>Save Dashboard</div>
                {!hasWidgets && (
                  <div style={{ color: palette.accent, fontSize: '0.85rem' }}>Add at least one widget before saving.</div>
                )}
                {dashboardName && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                    <div style={{ color: palette.textSecondary, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Current dashboard: <strong>{dashboardName}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void saveDashboard({ targetName: dashboardName }); }}
                      disabled={!hasWidgets}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1px solid ${palette.accent}`,
                        background: hasWidgets ? palette.accent : palette.buttonBg,
                        color: palette.textPrimary,
                        cursor: hasWidgets ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Save
                    </button>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ color: palette.textSecondary, fontSize: '0.85rem' }}>Save As</label>
                  <input
                    placeholder="Dashboard name"
                    value={saveDraftName}
                    onChange={(e) => setSaveDraftName(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.textPrimary }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowSavePanel(false)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.buttonBg, color: palette.textSecondary, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { void saveDashboard({ targetName: trimmedDraftName }); }}
                      disabled={!canSaveAs}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: `1px solid ${palette.accent}`,
                        background: canSaveAs ? palette.accent : palette.buttonBg,
                        color: palette.textPrimary,
                        cursor: canSaveAs ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Save As
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button type="button" title="Bold" aria-pressed={formatOptions.bold} onClick={() => toggleFormatOption('bold')} style={getButtonStyle(formatOptions.bold)}>
            <img src={boldIcon} alt="Bold" style={{ width: 16, height: 16 }} />
          </button>
          <button type="button" title="Italic" aria-pressed={formatOptions.italic} onClick={() => toggleFormatOption('italic')} style={getButtonStyle(formatOptions.italic)}>
            <img src={italicIcon} alt="Italic" style={{ width: 16, height: 16 }} />
          </button>
          <button
            type="button"
            title="Align left"
            aria-pressed={formatOptions.textAlign === 'left'}
            onClick={() => updateFormatOption('textAlign', 'left')}
            style={getButtonStyle(formatOptions.textAlign === 'left')}
          >
            <img src={leftIcon} alt="Align left" style={{ width: 16, height: 16 }} />
          </button>
          <button
            type="button"
            title="Align center"
            aria-pressed={formatOptions.textAlign === 'center'}
            onClick={() => updateFormatOption('textAlign', 'center')}
            style={getButtonStyle(formatOptions.textAlign === 'center')}
          >
            <img src={centreIcon} alt="Align center" style={{ width: 16, height: 16 }} />
          </button>
          <button
            type="button"
            title="Align right"
            aria-pressed={formatOptions.textAlign === 'right'}
            onClick={() => updateFormatOption('textAlign', 'right')}
            style={getButtonStyle(formatOptions.textAlign === 'right')}
          >
            <img src={rightIcon} alt="Align right" style={{ width: 16, height: 16 }} />
          </button>
          <div ref={numberButtonRef} style={{ position: 'relative' }}>
            <button
              type="button"
              title="Number format"
              aria-haspopup="true"
              aria-expanded={showNumberMenu}
              onClick={() => {
                setShowNumberMenu(prev => {
                  const next = !prev;
                  if (next) {
                    setShowBorderMenu(false);
                    setShowDateMenu(false);
                  }
                  return next;
                });
              }}
              style={getButtonStyle(formatOptions.numberFormat !== 'general')}
            >
              <img src={numberIcon} alt="Number format" style={{ width: 16, height: 16 }} />
            </button>
            {showNumberMenu && (
              <div
                ref={numberMenuRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  zIndex: 240,
                  background: palette.panel,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  padding: 10,
                  minWidth: 180,
                  boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.85rem' }}>Number Format</div>
                {numberFormatOptions.map(([value, label]) => {
                  const active = formatOptions.numberFormat === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        updateFormatOption('numberFormat', value);
                        setShowNumberMenu(false);
                      }}
                      style={{
                        textAlign: 'left',
                        background: active ? palette.accentSoft : 'transparent',
                        border: 'none',
                        color: active ? palette.textPrimary : palette.textSecondary,
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div ref={dateButtonRef} style={{ position: 'relative' }}>
            <button
              type="button"
              title="Date format"
              aria-haspopup="true"
              aria-expanded={showDateMenu}
              onClick={() => {
                setShowDateMenu(prev => {
                  const next = !prev;
                  if (next) {
                    setShowBorderMenu(false);
                    setShowNumberMenu(false);
                  }
                  return next;
                });
              }}
              style={getButtonStyle(formatOptions.dateFormat !== 'shortDate')}
            >
              <img src={dateIcon} alt="Date format" style={{ width: 16, height: 16 }} />
            </button>
            {showDateMenu && (
              <div
                ref={dateMenuRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  zIndex: 240,
                  background: palette.panel,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  padding: 10,
                  minWidth: 180,
                  boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.85rem' }}>Date Format</div>
                {dateFormatOptions.map(([value, label]) => {
                  const active = formatOptions.dateFormat === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        updateFormatOption('dateFormat', value);
                        setShowDateMenu(false);
                      }}
                      style={{
                        textAlign: 'left',
                        background: active ? palette.accentSoft : 'transparent',
                        border: 'none',
                        color: active ? palette.textPrimary : palette.textSecondary,
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={getButtonStyle(false)} title="Font">
              <img src={fontIcon} alt="Font" style={{ width: 16, height: 16 }} />
            </div>
            <select
              value={formatOptions.fontFamily}
              onChange={(e) => updateFormatOption('fontFamily', e.target.value)}
              title="Font"
              style={{ background: palette.panel, color: palette.textSecondary, border: `1px solid ${palette.border}`, borderRadius: 6, padding: '6px 8px', fontSize: '0.85rem' }}
            >
              {['Inter', 'Arial', 'Georgia', 'Courier New', 'Times New Roman'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select
              value={formatOptions.fontSize}
              onChange={(e) => updateFormatOption('fontSize', e.target.value)}
              title="Font size"
              style={{ background: palette.panel, color: palette.textSecondary, border: `1px solid ${palette.border}`, borderRadius: 6, padding: '6px 8px', fontSize: '0.85rem' }}
            >
              {['12', '14', '16', '18', '20', '24', '32'].map(sz => (
                <option key={sz} value={sz}>{sz}px</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            title="Align widgets"
            onClick={handleAlignWidgets}
            style={getButtonStyle(false)}
          >
            <img src={alignWidgetsIcon} alt="Align widgets" style={{ width: 16, height: 16 }} />
          </button>
          <button
            type="button"
            title="Evenly distribute widgets"
            onClick={handleDistributeWidgets}
            style={getButtonStyle(false)}
          >
            <img src={distributeWidgetsIcon} alt="Evenly distribute widgets" style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ position: 'relative' }}>
            <div style={getButtonStyle(false)} title="Font color">
              <input
                type="color"
                value={formatOptions.fontColor}
                onChange={(e) => updateFormatOption('fontColor', e.target.value)}
                title="Font color"
                style={{
                  opacity: 0,
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                }}
              />
              <img src={fontIcon} alt="Font color" style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div ref={borderButtonRef} style={{ position: 'relative' }}>
          <button
            type="button"
            title="Borders"
            aria-pressed={formatOptions.border}
            onClick={() => {
              setShowBorderMenu(prev => {
                const next = !prev;
                if (next) {
                  setShowNumberMenu(false);
                  setShowDateMenu(false);
                }
                return next;
              });
            }}
            style={getButtonStyle(formatOptions.border)}
          >
            <img src={borderIcon} alt="Borders" style={{ width: 18, height: 18 }} />
          </button>
          {showBorderMenu && (
            <div
              ref={borderMenuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 240,
                background: palette.panel,
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: 12,
                minWidth: 220,
                boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem' }}>Borders</div>
              <div style={{ display: 'grid', rowGap: 6 }}>
                {[
                  ['none', 'None'],
                  ['outline', 'Outside borders'],
                  ['inside', 'Inside borders'],
                  ['full', 'All borders'],
                ].map(([value, label]) => (
                  <label key={value} style={{ color: palette.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="radio"
                      name="border-style"
                      checked={formatOptions.borderStyle === value}
                      onChange={() => {
                        updateFormatOption('borderStyle', value);
                        updateFormatOption('border', value !== 'none');
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: palette.textMuted, fontSize: '0.85rem' }}>Width</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formatOptions.borderSize}
                  onChange={(e) => updateFormatOption('borderSize', e.target.value)}
                  style={{ width: 70, background: palette.panel, color: palette.textSecondary, border: `1px solid ${palette.border}`, borderRadius: 6, padding: '4px 8px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${palette.borderMuted}`, background: formatOptions.borderColor }} />
                <input
                  type="color"
                  value={formatOptions.borderColor}
                  onChange={(e) => updateFormatOption('borderColor', e.target.value)}
                  title="Border color"
                  style={{ width: 40, height: 40, border: `1px solid ${palette.border}`, borderRadius: 6, background: palette.panel, padding: 0 }}
                />
              </div>
            </div>
          )}
        </div>
          <div style={{ position: 'relative' }}>
            <div style={getButtonStyle(false)} title="Fill color">
              <input
                type="color"
                value={formatOptions.fillColor}
                onChange={(e) => updateFormatOption('fillColor', e.target.value)}
                title="Fill color"
                style={{
                  opacity: 0,
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                }}
              />
              <img src={fillIcon} alt="Fill color" style={{ width: 16, height: 16 }} />
              <span style={{ position: 'absolute', bottom: 4, right: 4, width: 10, height: 4, borderRadius: 2, background: formatOptions.fillColor }} />
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={getButtonStyle(false)} title="Shading">
              <input
                type="color"
                value={formatOptions.shading}
                onChange={(e) => updateFormatOption('shading', e.target.value)}
                title="Shading"
                style={{
                  opacity: 0,
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                }}
              />
              <img src={shadingIcon} alt="Shading" style={{ width: 16, height: 16 }} />
              <span style={{ position: 'absolute', bottom: 4, right: 4, width: 10, height: 4, borderRadius: 2, background: `linear-gradient(135deg, rgba(255,255,255,0.45), ${formatOptions.shading})` }} />
            </div>
          </div>
      </div>
      </div>
      {message && <div style={{ color: palette.textSubtle, marginBottom: 10 }}>{message}</div>}

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
            border: `1px solid ${palette.border}`, borderRadius: 8, padding: 10, background: palette.panel,
            ...(sizeMode === 'automatic'
              ? { height: '100%' }
              : { maxHeight: 'calc(100vh - 160px)' }
            ),
            display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden'
          }}
        >
          {/* 1) Size */}
          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, padding: 8, background: palette.panel }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 8 }}>
              <label
                htmlFor="dash-size-mode"
                style={{ color: palette.textSecondary, fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.02em' }}
              >
                Size
              </label>
              <select
                id="dash-size-mode"
                value={sizeMode}
                onChange={(e) => setSizeMode(e.target.value === 'fixed' ? 'fixed' : 'automatic')}
                style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.textSecondary, fontSize: '0.8rem' }}
              >
                <option value="automatic">Automatic</option>
                <option value="fixed">Fixed Size</option>
              </select>
            </div>
            {sizeMode === 'fixed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="dash-fixed-width" style={{ color: palette.textMuted }}>Width</label>
                  <input
                    id="dash-fixed-width"
                    type="number"
                    min={320}
                    max={10000}
                    value={fixedWidth}
                    onChange={(e) => setFixedWidth(Math.max(320, Math.min(10000, Number(e.target.value) || 1200)))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.textSecondary }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="dash-fixed-height" style={{ color: palette.textMuted }}>Height</label>
                  <input
                    id="dash-fixed-height"
                    type="number"
                    min={240}
                    max={10000}
                    value={fixedHeight}
                    onChange={(e) => setFixedHeight(Math.max(240, Math.min(10000, Number(e.target.value) || 800)))}
                    style={{ padding: '4px 6px', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.panel, color: palette.textSecondary }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* 2) Sheets (Saved Views) */}
          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, padding: 8, background: palette.panel, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: palette.textPrimary, fontWeight: 600, marginBottom: 6, fontSize: '0.8rem', letterSpacing: '0.02em' }}>Sheets</div>
            <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ color: palette.textMuted }}>Loading…</div>
            ) : (
              (savedViews && savedViews.length) ? savedViews.map(v => (
                <div
                  key={`${v.viewName}|${v.createdAt}`}
                  draggable
                  onDragStart={(e) => onDragStartView(e, v)}
                  title={`Drag ${v.viewName} to layout`}
                  className="sheet-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', marginBottom: 4, color: palette.textSecondary }}
                >
                  <img src={chartIcon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9, flex: '0 0 auto' }} />
                  <div style={{
                    color: palette.textSecondary,
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
              )) : <div style={{ color: palette.textMuted }}>No saved views.</div>
          )}
            </div>
          </div>

          {/* 3) Objects */}
          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, padding: 8, background: palette.panel }}>
            <div style={{ color: palette.textPrimary, fontWeight: 600, marginBottom: 6, fontSize: '0.8rem', letterSpacing: '0.02em' }}>Objects</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 6,
                marginTop: 4,
              }}
            >
              {baseObjectItems.map(item => (
                <div
                  key={item.key}
                  draggable
                  onDragStart={item.onDragStart}
                  title={`Drag ${item.label.toLowerCase()}`}
                  className="object-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 6,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 6,
                    background: 'rgba(36,36,36,0.6)',
                    cursor: 'grab',
                  }}
                >
                  <img src={item.icon} alt="" aria-hidden="true" style={{ width: 14, height: 14, opacity: 0.9 }} />
                  <span style={{ color: palette.textPrimary, lineHeight: 1.2, fontSize: '12px' }}>{item.label}</span>
                </div>
              ))}
            </div>
            {renderWidgetGroup(
              'charts',
              'Data Visualizations',
              CHART_DEFINITIONS,
              onDragStartChart,
              {
                extraItems: [
                  { type: 'map', label: 'Map Widget', icon: mapWidgetIcon, onDragStart: (e) => onDragStartDisplay(e, 'map') },
                ],
                renderItem: (item, handleDrag) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={handleDrag}
                    title={item.label}
                    className="object-item"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 2,
                      marginRight: 4,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 8,
                      background: 'rgba(36,36,36,0.65)',
                      cursor: 'grab',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(20,20,20,0.92)',
                        border: `1px solid ${palette.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img src={item.icon} alt="" aria-hidden="true" style={{ width: 20, height: 20, opacity: 0.95 }} />
                    </div>
                  </div>
                ),
                customGridStyle: {
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                },
              }
            )}
            {renderWidgetGroup('nav', 'Navigation & Layout', NAV_WIDGET_DEFINITIONS, onDragStartNavWidget)}
            {renderWidgetGroup('control', 'Interactive Controls', CONTROL_WIDGET_DEFINITIONS, onDragStartControl)}
            {renderWidgetGroup('display', 'Data Display', DISPLAY_WIDGET_DEFINITIONS, onDragStartDisplay)}
          </div>
        </div>

        {/* Layout Grid (scrollable) */}
        <div
          ref={gridContainerRef}
          style={{
            border: `1px solid ${palette.border}`, borderRadius: 8, padding: 10, background: palette.panelMuted, overflow: 'auto', width: '100%',
            ...(sizeMode === 'fixed'
              ? { width: fixedWidth, height: fixedHeight }
              : { height: '100%'}
            ),
          }}
          onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch {} }}
          onDrop={onContainerDrop}
        >
          <div style={{ color: palette.textPrimary, fontWeight: 600, marginBottom: 6 }}>Layout</div>
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
            draggableHandle=".widget-toolbar"
            draggableCancel=".widget-toolbar button, .no-drag, textarea, input, select"
          >
            {layout.map(item => {
              const meta = widgets[item.i];
              if (meta?.type === 'container') {
                return (
                  <div key={item.i} style={{ background: palette.panel, border: `1px dashed ${palette.borderMuted}`, borderRadius: 6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: `1px solid ${palette.border}`, cursor: 'grab' }}>
                      <div style={{ color: palette.textPrimary, fontWeight: 600 }}>{meta.orientation === 'v' ? 'Vertical' : 'Horizontal'} Container</div>
                      <button type="button" onClick={() => removeWidget(item.i)} title="Close" aria-label="Close" style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}>
                        <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.9 }} />
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
                          if (!(data && ((data.kind === 'saved-view' && data.viewName) || data.kind === 'text' || data.kind === 'image' || data.kind === 'chart' || data.kind === 'nav' || data.kind === 'control' || data.kind === 'display'))) return;
                          // Rough position mapping for fallback
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pxX = e.clientX - rect.left + e.currentTarget.scrollLeft - 6;
                          const pxY = e.clientY - rect.top + e.currentTarget.scrollTop - 6;
                          const colWidth = Math.max(1, rect.width / (cols.lg || 12));
                          const col = Math.max(0, Math.floor(pxX / colWidth));
                          const row = Math.max(0, Math.floor(pxY / rowHeight));
                          dropGuardRef.current = Date.now();
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
                        draggableHandle=".child-widget-toolbar"
                        draggableCancel=".child-widget-toolbar button, .no-drag, textarea, input, select"
                        onDrop={(nl, li, e) => {
                          try {
                            const txt = e?.dataTransfer?.getData('application/json') || e?.dataTransfer?.getData('text/plain');
                            if (!txt) return;
                            const data = JSON.parse(txt);
                            if (data && ((data.kind === 'saved-view' && data.viewName) || data.kind === 'text' || data.kind === 'image' || data.kind === 'chart' || data.kind === 'nav' || data.kind === 'control' || data.kind === 'display')) {
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
                            const normalized = normalizeChildLayout(sanitized, current.orientation);
                            return { ...prev, [item.i]: { ...current, childLayout: normalized } };
                          });
                        }}
                        margin={[6, 6]}
                        containerPadding={[6, 6]}
                      >
                        {(meta.childLayout || [])
                          .filter(ci => !String(ci.i).startsWith('__dropping__'))
                          .filter(ci => (meta.childWidgets || {})[ci.i])
                          .map(ci => {
                            const childMeta = (meta.childWidgets || {})[ci.i];
                            const childTitle = childMeta?.type === 'text'
                              ? ((childMeta?.text || '').trim() ? (childMeta.text || '').trim().slice(0, 32) : 'Text')
                              : childMeta?.type === 'image'
                                ? 'Image'
                              : childMeta?.type === 'chart'
                                ? (chartTypeLabelMap[childMeta?.chartType] || 'Chart')
                              : childMeta?.type === 'nav'
                                ? (navWidgetLabelMap[childMeta?.navType] || 'Navigation')
                                : childMeta?.type === 'control'
                                  ? (controlWidgetLabelMap[childMeta?.controlType] || 'Control')
                                : childMeta?.type === 'display'
                                  ? (displayWidgetLabelMap[childMeta?.displayType] || 'Data Display')
                                : childMeta?.viewName || 'View';
                            return (
                              <div key={ci.i} style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 4, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div className="child-widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: `1px solid ${palette.border}`, cursor: 'grab' }}>
                                  <div style={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{childTitle}</div>
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
                                      const normalizedLayout = normalizeChildLayout(childLayout, cur.orientation);
                                      return { ...prev, [item.i]: { ...cur, childLayout: normalizedLayout, childWidgets } };
                                    });
                                  }}
                                    title="Close"
                                    aria-label="Close"
                                    style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer' }}
                                  >
                                    <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.9 }} />
                                  </button>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 6, color: palette.textMuted, fontSize: '0.9rem' }}>
                                  {childMeta?.type === 'view' ? (
                                    childMeta?.viewContent?.exportContext ? (
                                      <TableComponent
                                        data={[{}]}
                                        initialPageSize={10}
                                        initialFontSize={11}
                                        buttonsDisabled={true}
                                        perfOptions={{ maxScan: 5000, maxDistinct: 200 }}
                                        previewOptions={{ maxClob: 4096, maxBlob: 1024 }}
                                        exportContext={childMeta.viewContent.exportContext}
                                        serverMode={true}
                                        tableOpsMode={childMeta.viewContent.tableOpsMode || 'flask'}
                                        pushDownDb={!!childMeta.viewContent.pushDownDb}
                                        virtualizeOnMaximize={false}
                                        dashboardMode={true}
                                      />
                                    ) : (
                                      <>Saved view: <strong>{childMeta?.viewName}</strong> (no preview config).</>
                                    )
                                  ) : childMeta?.type === 'text' ? (
                                    <textarea
                                      value={childMeta?.text || ''}
                                      onChange={(e) => updateTextWidget(ci.i, e.target.value, item.i)}
                                      style={{ width: '100%', minHeight: 80, background: palette.panelMuted, color: palette.textPrimary, border: `1px solid ${palette.border}`, borderRadius: 4, padding: '6px', resize: 'vertical' }}
                                    />
                                  ) : childMeta?.type === 'display' ? (
                                    renderDisplayPlaceholder(childMeta?.displayType)
                                  ) : childMeta?.type === 'control' ? (
                                    renderControlPlaceholder(childMeta?.controlType)
                                  ) : childMeta?.type === 'nav' ? (
                                    renderNavPlaceholder(childMeta?.navType)
                                  ) : childMeta?.type === 'chart' ? (
                                    renderChartPlaceholder(childMeta?.chartType)
                                  ) : childMeta?.type === 'image' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <input
                                        value={childMeta?.sourceType === 'file' ? '' : (childMeta?.imageUrl || '')}
                                        onChange={(e) => updateImageWidget(ci.i, e.target.value, item.i, { sourceType: 'url', fileName: '' })}
                                        placeholder="Image URL"
                                        style={{ width: '100%', background: palette.panelMuted, color: palette.textPrimary, border: `1px solid ${palette.border}`, borderRadius: 4, padding: '6px' }}
                                      />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageFileSelect(ci.i, item.i)}
                                        style={{ color: palette.textSecondary }}
                                      />
                                      {childMeta?.imageUrl ? (
                                        <img
                                          src={childMeta.imageUrl}
                                          alt="Widget"
                                          style={{ maxWidth: '100%', borderRadius: 4, border: `1px solid ${palette.border}` }}
                                        />
                                      ) : (
                                        <div style={{ color: palette.textMuted, fontSize: '0.85rem' }}>Enter an image URL above.</div>
                                      )}
                                      {childMeta?.fileName && (
                                        <div style={{ color: palette.textMuted, fontSize: '0.8rem' }}>File: {childMeta.fileName}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ color: palette.textMuted }}>Unsupported widget.</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </ResponsiveGridLayout>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.i} style={{ background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 6, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div className="widget-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: `1px solid ${palette.border}`, cursor: 'grab' }}>
                    <div style={{ color: palette.textPrimary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {meta?.type === 'text'
                        ? ((meta?.text || '').trim() ? (meta.text || '').trim().slice(0, 32) : 'Text')
                        : meta?.type === 'image'
                          ? 'Image'
                        : meta?.type === 'chart'
                          ? (chartTypeLabelMap[meta?.chartType] || 'Chart')
                        : meta?.type === 'nav'
                          ? (navWidgetLabelMap[meta?.navType] || 'Navigation')
                        : meta?.type === 'control'
                          ? (controlWidgetLabelMap[meta?.controlType] || 'Control')
                        : meta?.type === 'display'
                          ? (displayWidgetLabelMap[meta?.displayType] || 'Data Display')
                        : meta?.viewName || 'Widget'}
                    </div>
                    <button type="button" onClick={() => removeWidget(item.i)} title="Close" aria-label="Close" style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}>
                      <img src={closeIcon} alt="" aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.9 }} />
                    </button>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }}>
                    {meta?.type === 'view' ? (
                      meta?.viewContent?.exportContext ? (
                        <TableComponent
                          data={[{}]}
                          initialPageSize={10}
                          initialFontSize={11}
                          buttonsDisabled={true}
                          perfOptions={{ maxScan: 5000, maxDistinct: 200 }}
                          previewOptions={{ maxClob: 4096, maxBlob: 1024 }}
                          exportContext={meta.viewContent.exportContext}
                          serverMode={true}
                          tableOpsMode={meta.viewContent.tableOpsMode || 'flask'}
                          pushDownDb={!!meta.viewContent.pushDownDb}
                          virtualizeOnMaximize={false}
                          dashboardMode={true}
                        />
                      ) : (
                        <div style={{ color: palette.textMuted, fontSize: '0.9rem' }}>
                          Saved view: <strong>{meta?.viewName}</strong> (no preview config). Resize freely; content scrolls.
                        </div>
                      )
                    ) : meta?.type === 'text' ? (
                      <textarea
                        value={meta?.text || ''}
                        onChange={(e) => updateTextWidget(item.i, e.target.value)}
                        style={{ width: '100%', minHeight: 120, background: palette.panelMuted, color: palette.textPrimary, border: `1px solid ${palette.border}`, borderRadius: 4, padding: '6px', resize: 'vertical' }}
                      />
                    ) : meta?.type === 'control' ? (
                      renderControlPlaceholder(meta?.controlType)
                    ) : meta?.type === 'display' ? (
                      renderDisplayPlaceholder(meta?.displayType)
                    ) : meta?.type === 'nav' ? (
                      renderNavPlaceholder(meta?.navType)
                    ) : meta?.type === 'chart' ? (
                      renderChartPlaceholder(meta?.chartType)
                    ) : meta?.type === 'image' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          value={meta?.sourceType === 'file' ? '' : (meta?.imageUrl || '')}
                          onChange={(e) => updateImageWidget(item.i, e.target.value, null, { sourceType: 'url', fileName: '' })}
                          placeholder="Image URL"
                          style={{ width: '100%', background: palette.panelMuted, color: palette.textPrimary, border: `1px solid ${palette.border}`, borderRadius: 4, padding: '6px' }}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileSelect(item.i)}
                          style={{ color: palette.textSecondary }}
                        />
                        {meta?.imageUrl ? (
                          <img
                            src={meta.imageUrl}
                            alt="Widget"
                            style={{ maxWidth: '100%', borderRadius: 4, border: `1px solid ${palette.border}` }}
                          />
                        ) : (
                          <div style={{ color: palette.textMuted, fontSize: '0.9rem' }}>Enter an image URL above.</div>
                        )}
                        {meta?.fileName && (
                          <div style={{ color: palette.textMuted, fontSize: '0.85rem' }}>File: {meta.fileName}</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: palette.textMuted, fontSize: '0.9rem' }}>
                        Unsupported widget type.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      </div>

      <div style={{ marginTop: 12, color: palette.textMuted }}>
        Tips: drag a view from the left and drop it onto the grid. Use the right/bottom handles to resize. The grid and each widget are scrollable.
      </div>
    </div>
  );
}
