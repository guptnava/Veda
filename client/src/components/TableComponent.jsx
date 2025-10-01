import React, { useState, useRef, useEffect, Suspense } from "react";
import { FixedSizeList as VList } from 'react-window';
const ChartPanel = React.lazy(() => import('./ChartPanel'));
import IconColumns from '../icons/column.svg';
import IconFilter from '../icons/column_filter.svg';
import IconAdvanced from '../icons/advanced_filter.svg';
import IconPivot from '../icons/pivot.svg';
import IconDerived from '../icons/derived.svg';
import IconCondFormat from '../icons/condformat.svg';
import IconFormat from '../icons/format.svg';
import IconChart from '../icons/chart.svg';
import IconChartToggle from '../icons/charttoggle.svg';
import IconClearSort from '../icons/clearsort.svg';
import IconTop from '../icons/top.svg';
import IconBottom from '../icons/bottom.svg';
import IconMaximize from '../icons/maximize.svg';
import IconRestore from '../icons/restore.svg';
import IconSave from '../icons/save.svg';
import IconLoad from '../icons/load.svg';
import IconPin from '../icons/pin.svg';
// Fallback save icon (using existing format icon if no save asset)



// Toolbar icon placeholders (replace with your actual paths)
// Use bundled asset import for columns icon
const ICON_COLUMNS = IconColumns;
const ICON_FILTERS = IconFilter;
const ICON_ADVANCED = IconAdvanced;
const ICON_PIVOT = IconPivot;
const ICON_DERIVED = IconDerived;
const ICON_COND_FORMAT = IconCondFormat;
const ICON_FORMATS = IconFormat;
const ICON_CHART = IconChart;
const ICON_CHART_TOGGLE = IconChartToggle;
const ICON_CLEAR_SORT = IconClearSort;
const ICON_TOP = IconTop;
const ICON_BOTTOM = IconBottom
const ICON_MAXIMIZE = IconMaximize;
const ICON_RESTORE = IconRestore;
const ICON_SAVE = IconSave;
const ICON_LOAD = IconLoad;
const ICON_PIN = IconPin;

// Generic toolbar icon button
export const TABLE_COMPONENT_DEFAULT_PAGE_SIZE = 10;

const ToolbarButton = ({ icon, alt, title, onClick, active, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    title={title || alt}
    aria-label={alt}
    disabled={disabled}
    style={{
      width: 28,
      height: 28,
      padding: 4,
      borderRadius: 4,
      border: '1px solid ' + (active ? '#1e5b86' : '#444'),
      background: active ? '#114b6d' : '#2d2d2d',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
    }}
  >
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    <img src={icon} alt={alt} style={{ width: 16, height: 16, filter: disabled ? 'grayscale(0.6)' : 'none' }} />
  </button>
);

// Collapsible cell for long text values (safe for virtualized and non-virtualized views)
const CollapsibleCell = ({ text, collapseChars = 10, isVirtualized = false, fontSize = 11 }) => {
  try {
    const s = text == null ? '' : String(text);
    const needsCollapse = s.length > collapseChars || /\n/.test(s);
    const [expanded, setExpanded] = useState(false);

    if (!needsCollapse) return <span>{s}</span>;

    const preview = s.slice(0, collapseChars) + '…';

    // For virtualized rows, avoid changing row height. Use a modal overlay when expanding.
    if (isVirtualized) {
      return (
        <span style={{ display: 'inline-block', maxWidth: '100%' }}>
          <span title={s} style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }}>{preview}</span>
          <button type="button" onClick={() => setExpanded(true)} style={{ marginLeft: 6, padding: '0 4px', border: '1px solid #444', borderRadius: 3, background: '#2d2d2d', color: '#fff', cursor: 'pointer', fontSize: Math.max(9, fontSize - 2) }} title="Expand">
            More
          </button>
          {expanded && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setExpanded(false)}>
              <div style={{ background: '#111', color: '#ddd', border: '1px solid #333', borderRadius: 8, maxWidth: '80vw', maxHeight: '70vh', width: '720px', boxShadow: '0 4px 14px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: 8, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Cell Content</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(s); } catch {} }} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Copy</button>
                    <button type="button" onClick={() => setExpanded(false)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Close</button>
                  </div>
                </div>
                <div style={{ padding: 8, overflow: 'auto' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: `${fontSize}px` }}>{s}</pre>
                </div>
              </div>
            </div>
          )}
        </span>
      );
    }

    // Non-virtualized: inline expand/collapse with wrapping
    return (
      <span style={{ display: 'inline' }}>
        <span style={{ whiteSpace: expanded ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>{expanded ? s : preview}</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ marginLeft: 6, padding: '0 4px', border: '1px solid #444', borderRadius: 3, background: '#2d2d2d', color: '#fff', cursor: 'pointer', fontSize: Math.max(9, fontSize - 2) }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </span>
    );
  } catch {
    return <span>{String(text ?? '')}</span>;
  }
};

// Lightweight conditional formatting editor used by the simple table view
const FormatPicker = ({ headers, numericCols, rules, setRules, useFixed = true, fixedTop = 64, fixedRight = 10, fixedLeft = null }) => {
  const numericOps = ['>', '>=', '<', '<=', '=', '!='];
  const stringOps = ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'];
  const commonOps = ['isEmpty', 'notEmpty'];

  const [newRule, setNewRule] = useState(() => ({
    column: headers[0],
    operator: numericCols.has(headers[0]) ? '>' : 'contains',
    value: '',
    bgColor: '#3a3a3a',
    textColor: '#ffffff',
    enabled: true,
  }));

  const opsForColumn = (col) => {
    const isNum = numericCols.has(col);
    return isNum ? [...numericOps, ...commonOps] : [...stringOps, ...commonOps];
  };
  const needsValue = (op) => !commonOps.includes(op);

  const addRule = () => {
    if (!newRule.column || !newRule.operator) return;
    const id = Date.now() + Math.random();
    setRules((prev) => [...prev, { id, ...newRule }]);
  };
  const removeRule = (id) => setRules((prev) => prev.filter((r) => r.id !== id));
  const toggleEnabled = (id) => setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const [scaleDraft, setScaleDraft] = useState({ column: headers[0], minColor: '#2e7d32', midColor: '#f9a825', maxColor: '#c62828', barColor: '#0e639c' });

  return (
    <div style={{ position: useFixed ? 'fixed' : 'absolute', top: useFixed ? `${fixedTop}px` : '110%', ...(fixedLeft != null ? { left: `${fixedLeft}px` } : { right: useFixed ? `${fixedRight}px` : 0 }), backgroundColor: "#252526", border: "1px solid #444", borderRadius: 6, padding: 10, zIndex: 1000, minWidth: 320, maxWidth: 420, maxHeight: '70vh', overflow: 'auto', boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Conditional Formatting</div>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 8 }}>No rules yet. Add one below.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 200, overflow: 'auto' }}>
          {rules.map((r) => {
            const isScale = r.type === 'scale2' || r.type === 'scale3';
            const isBar = r.type === 'databar';
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1f1f1f', border: '1px solid #333', borderRadius: 6, padding: 6 }}>
                <input type="checkbox" checked={!!r.enabled} onChange={() => toggleEnabled(r.id)} title="Enable/disable" />
                {!isScale && !isBar && <div style={{ width: 12, height: 12, borderRadius: 2, background: r.bgColor, border: '1px solid #555' }} />}
                <span style={{ color: '#ddd', fontSize: '0.9rem' }}>
                  {isScale ? (
                    r.type === 'scale2' ? `${r.column} • 2-color scale` : `${r.column} • 3-color scale`
                  ) : isBar ? (
                    `${r.column} • data bar`
                  ) : (
                    `${r.column} ${r.operator} ${needsValue(r.operator) ? JSON.stringify(r.value) : ''}`
                  )}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => removeRule(r.id)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new rule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Column
          <select value={newRule.column} onChange={(e) => {
            const col = e.target.value; const isNum = numericCols.has(col);
            setNewRule((nr) => ({ ...nr, column: col, operator: isNum ? numericOps[0] : stringOps[0] }));
          }} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Operator
          <select value={newRule.operator} onChange={(e) => setNewRule((nr) => ({ ...nr, operator: e.target.value }))} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
            {opsForColumn(newRule.column).map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </label>
        {needsValue(newRule.operator) && (
          <label style={{ color: '#aaa', fontSize: '0.85rem', gridColumn: '1 / span 2' }}>Value
            <input value={newRule.value} onChange={(e) => setNewRule((nr) => ({ ...nr, value: e.target.value }))} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
          </label>
        )}
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Bg Color
          <input type="color" value={newRule.bgColor} onChange={(e) => setNewRule((nr) => ({ ...nr, bgColor: e.target.value }))} style={{ width: '100%', height: 34, padding: 0, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
        </label>
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Text Color
          <input type="color" value={newRule.textColor} onChange={(e) => setNewRule((nr) => ({ ...nr, textColor: e.target.value }))} style={{ width: '100%', height: 34, padding: 0, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
        </label>
      </div>
      {/* Drill-through side panel moved to TableComponent render (outside FormatPicker) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={addRule} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Add Rule</button>
      </div>

      {/* Scales and Data Bars */}
      <div style={{ marginTop: 10, borderTop: '1px solid #333', paddingTop: 8 }}>
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Scales & Data Bars</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
          <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Column
            <select value={scaleDraft.column} onChange={(e) => setScaleDraft((d) => ({ ...d, column: e.target.value }))} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
              {headers.filter(h => numericCols.has(h)).map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
          <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Min
            <input type="color" value={scaleDraft.minColor} onChange={(e) => setScaleDraft((d) => ({ ...d, minColor: e.target.value }))} style={{ width: '100%', height: 34, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
          </label>
          <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Mid
            <input type="color" value={scaleDraft.midColor} onChange={(e) => setScaleDraft((d) => ({ ...d, midColor: e.target.value }))} style={{ width: '100%', height: 34, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
          </label>
          <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Max
            <input type="color" value={scaleDraft.maxColor} onChange={(e) => setScaleDraft((d) => ({ ...d, maxColor: e.target.value }))} style={{ width: '100%', height: 34, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
          </label>
          <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Bar
            <input type="color" value={scaleDraft.barColor} onChange={(e) => setScaleDraft((d) => ({ ...d, barColor: e.target.value }))} style={{ width: '100%', height: 34, background: 'transparent', border: '1px solid #444', borderRadius: 4 }} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, { id: Date.now() + Math.random(), type: 'scale2', column: scaleDraft.column, minColor: scaleDraft.minColor, maxColor: scaleDraft.maxColor, enabled: true }])}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}
          >
            Add 2‑color scale
          </button>
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, { id: Date.now() + Math.random(), type: 'scale3', column: scaleDraft.column, minColor: scaleDraft.minColor, midColor: scaleDraft.midColor, maxColor: scaleDraft.maxColor, enabled: true }])}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}
          >
            Add 3‑color scale
          </button>
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, { id: Date.now() + Math.random(), type: 'databar', column: scaleDraft.column, barColor: scaleDraft.barColor, enabled: true }])}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}
          >
            Add Data Bar
          </button>
          <button
            type="button"
            title="Apply 2‑color scale to all numeric columns"
            onClick={() => {
              const t = Date.now();
              setRules((prev) => {
                const existing = new Set(prev.filter(r => (r.type === 'scale2' || r.type === 'scale3' || r.type === 'databar') && r.column).map(r => r.column));
                const targets = headers.filter(h => numericCols.has(h) && !existing.has(h));
                const newRules = targets.map((col, i) => ({ id: t + i + Math.random(), type: 'scale2', column: col, minColor: scaleDraft.minColor, maxColor: scaleDraft.maxColor, enabled: true }));
                return newRules.length ? [...prev, ...newRules] : prev;
              });
            }}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}
          >
            2‑color scale (whole table)
          </button>
        </div>
      </div>
    </div>
  );
};

// Editor for derived columns (name + formula)
const DerivedPicker = ({ baseHeaders, derivedCols, setDerivedCols, useFixed = true, fixedTop = 64, fixedRight = 10, fixedLeft = null }) => {
  const [draft, setDraft] = useState({ name: '', formula: '' });
  const [error, setError] = useState('');

  const addDerived = () => {
    setError('');
    const name = (draft.name || '').trim();
    if (!name) { setError('Name is required'); return; }
    if (baseHeaders.includes(name) || derivedCols.some(c => c.name === name)) {
      setError('Name conflicts with existing column'); return;
    }
    const id = Date.now() + Math.random();
    setDerivedCols((prev) => [...prev, { id, name, formula: draft.formula || '', enabled: true }]);
    setDraft({ name: '', formula: '' });
  };

  const remove = (id) => setDerivedCols((prev) => prev.filter((c) => c.id !== id));
  const toggle = (id) => setDerivedCols((prev) => prev.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));

  return (
    <div style={{ position: useFixed ? 'fixed' : 'absolute', top: useFixed ? `${fixedTop}px` : '110%', ...(fixedLeft != null ? { left: `${fixedLeft}px` } : { right: useFixed ? `${fixedRight}px` : 0 }), backgroundColor: "#252526", border: "1px solid #444", borderRadius: 6, padding: 10, zIndex: 1000, minWidth: 360, maxWidth: 520, maxHeight: '70vh', overflow: 'auto', boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Derived Columns</div>
      <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 8 }}>
        Use <code>col('Header Name')</code> or <code>row.Field</code> in formulas. Example: <code>col('Price') * col('Qty')</code>
      </div>
      {derivedCols.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 180, overflow: 'auto' }}>
          {derivedCols.map((c) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 6, background: '#1f1f1f', border: '1px solid #333', borderRadius: 6, padding: 6 }}>
              <input type="checkbox" checked={!!c.enabled} onChange={() => toggle(c.id)} title="Enable/disable" />
              <div style={{ color: '#ddd', fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.formula || '(no formula)'}</div>
              <button type="button" onClick={() => remove(c.id)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>New column name
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g., Total" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
        </label>
        <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Formula
          <input value={draft.formula} onChange={(e) => setDraft((d) => ({ ...d, formula: e.target.value }))} placeholder="e.g., col('Price') * col('Qty')" style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
        </label>
        {error && <div style={{ color: '#e57373', fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={addDerived} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Add Column</button>
        </div>
      </div>
  </div>
  );
};

const TableComponent = React.memo(({ data, initialPageSize = TABLE_COMPONENT_DEFAULT_PAGE_SIZE, initialFontSize = 11, buttonsDisabled = false, buttonPermissions, perfOptions, previewOptions, exportContext, totalRows, virtualizeOnMaximize = true, virtualRowHeight = 28, onMaximize, serverMode = false, tableOpsMode = 'flask', pushDownDb = false, initialMaximized = false, showMaximizeControl = true, initialViewState = null, initialSchema = null, dashboardMode = false }) => {
  const [sortConfig, setSortConfig] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showPivotPicker, setShowPivotPicker] = useState(false);

  const [fontSize, setFontSize] = useState(initialFontSize);
  const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // pivot
  const [isPivotView, setIsPivotView] = useState(false);
  const [pivotConfig, setPivotConfig] = useState({
    columns: [],
    // Column axis (not yet rendered as matrix, stored for future use)
    colAxis: [],
    aggColumn: "", // legacy single measure
    aggFunc: "sum", // legacy single func
    measures: [], // multi-measure support
    funcs: ["sum"], // [sum,avg,count,min,max]
    calcPctTotal: false,
    calcPctParent: false,
    calcRank: false,
    calcRunning: false,
    // Sorting among sibling groups by selected measure
    sortMeasure: null, // e.g., "Revenue (sum)"
    sortDir: 'desc',
    // Subtotal/Grand options
    showSubtotals: true,
    showGrand: true,
    subtotalPosition: 'above', // 'below' | 'above' — Excel shows parent above children
    // Row labels mode: separate columns (Excel default) or single combined column
    rowLabelsMode: 'separate', // 'separate' | 'single'
    // Top-N within groups
    topN: { enabled: false, level: 0, n: 10, measure: null, dir: 'desc' },
    // Percent-of directions
    percentRow: false,
    percentCol: false,
    // Time intelligence (scaffold; requires a time-grain column on column axis)
    timeIntel: { enabled: false, field: null, funcs: [] },
  });
  // Collapsed groups in pivot (persisted)
  const [pivotCollapsed, setPivotCollapsed] = useState(() => new Set());
  // Calculated measures (user-defined expressions on computed measures)
  const [pivotCalcMeasures, setPivotCalcMeasures] = useState([]); // [{id,name,formula,enabled}]
  const [pivotCalcDraft, setPivotCalcDraft] = useState({ name: '', formula: '' });
  // Simple numeric binning (equal width) and date grains
  const [pivotBins, setPivotBins] = useState({}); // { [col]: { type:'equal', bins:number } | { type:'time', grain:'year'|'quarter'|'month'|'week'|'day' } }

  const pickerRef = useRef(null);
  const pivotRef = useRef(null);
  const formatRef = useRef(null);
  const filterRef = useRef(null);
  const formatsRef = useRef(null);
  const [chartVisible, setChartVisible] = useState(false);
  const [isMaximized, setIsMaximized] = useState(initialMaximized);
  const isVirtualized = isMaximized && !!virtualizeOnMaximize;
  const prevLayoutRef = useRef({ pageSize: initialPageSize });
  const [chartPickerOpen, setChartPickerOpen] = useState(false);
  const vlistRef = useRef(null);
  const scrollerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showFormatsPanel, setShowFormatsPanel] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  // Popover anchors for toolbar icons (right-aligned to icon)
  const [anchorCols, setAnchorCols] = useState(null);
  const [anchorFilters, setAnchorFilters] = useState(null);
  const [anchorAdvanced, setAnchorAdvanced] = useState(null);
  const [anchorPivot, setAnchorPivot] = useState(null);
  const [anchorDerived, setAnchorDerived] = useState(null);
  const [anchorFormats, setAnchorFormats] = useState(null);
  const [anchorCondFmt, setAnchorCondFmt] = useState(null);
  const [condRules, setCondRules] = useState([]);
  const derivedRef = useRef(null);
  const [showDerivedPicker, setShowDerivedPicker] = useState(false);
  const [derivedCols, setDerivedCols] = useState([]); // [{id,name,formula,enabled}]
  const [colFilters, setColFilters] = useState({}); // { [col]: { op, value, value2? } }
  const [showSummary, setShowSummary] = useState(false);
  
  const getRightAlignedAnchor = (evt, panelWidth = 400) => {
    try {
      const rect = evt.currentTarget.getBoundingClientRect();
      const top = rect.bottom + 6 + (window.scrollY || window.pageYOffset || 0);
      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      let left = (rect.right + (window.scrollX || window.pageXOffset || 0)) - panelWidth;
      left = Math.max(8, Math.min(left, vw - panelWidth - 8));
      return { top, left };
    } catch { return { top: 64, left: 10 }; }
  };
  const advancedRef = useRef(null);
  const [advFilters, setAdvFilters] = useState([]); // [{id,column,op,value,value2}]
  const [advCombine, setAdvCombine] = useState('AND');
  const [searchMode, setSearchMode] = useState('substring'); // substring | exact | regex
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchVisibleOnly, setSearchVisibleOnly] = useState(false);
  const [headerFilterOpenCol, setHeaderFilterOpenCol] = useState(null);
  const headerFilterMenuRef = useRef(null);
  const [valueFilters, setValueFilters] = useState({}); // { [col]: [values...] } (stringified)
  // Staging for header filter menu; only apply on close
  const [headerFilterDraft, setHeaderFilterDraft] = useState(null); // { col, selected: string[] | null }
  const headerFilterDraftRef = useRef(null);
  const prevHeaderFilterOpenColRef = useRef(null);
  // Distinct values fetched from server for header filter
  const [headerDistincts, setHeaderDistincts] = useState({}); // { [col]: string[] }
  const [headerDistinctLoading, setHeaderDistinctLoading] = useState(false);
  const [headerDistinctTerm, setHeaderDistinctTerm] = useState('');
  // Define debouncer hook before first usage to avoid TDZ
  const useDebounced = (value, delay = 200) => {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
      const t = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
  };
  const debouncedHeaderDistinctTerm = useDebounced(headerDistinctTerm, 200);
  const [showDrill, setShowDrill] = useState(false);
  const [drillRows, setDrillRows] = useState([]);
  const [pivotStyle, setPivotStyle] = useState({ subtotalBg: '#2d2d2d', subtotalText: '#ffffff', grandBg: '#1f1f1f', grandText: '#ffffff', subtotalNewline: true });
  // Column layout + formatting
  const [colWidths, setColWidths] = useState({}); // { [col]: px }
  const [columnOrder, setColumnOrder] = useState([]); // ordered list of columns
  const [freezeCount, setFreezeCount] = useState(0);
  const resizeStateRef = useRef({ active: false, col: null, startX: 0, startW: 0 });
  const [colFormats, setColFormats] = useState({}); // { [col]: { type: 'default|number|thousands|percent|currency|date|datetime', currency?: 'USD', precision?: 0-4 } }
  // Inline sparkline option for pivot with column-axis
  const [pivotSparkline, setPivotSparkline] = useState(true);
  // Selection model
  const [selectedColumns, setSelectedColumns] = useState(new Set()); // Set<string>
  const [selectedValuesByCol, setSelectedValuesByCol] = useState({}); // { [col]: Set<string> }
  const [selectedRowIdx, setSelectedRowIdx] = useState(new Set()); // Set<number> (non-pivot virtual index)
  const clearSelection = () => { setSelectedColumns(new Set()); setSelectedValuesByCol({}); setSelectedRowIdx(new Set()); };

  // History (undo/redo) for filters/sort/pivot changes
  const historyRef = useRef({ stack: [], index: -1, guard: false, lastSig: '' });
  const takeSnapshot = () => ({
    sortConfig,
    colFilters,
    valueFilters,
    advFilters,
    advCombine,
    pivotConfig,
  });
  useEffect(() => {
    try {
      if (historyRef.current.guard) return;
      const snap = takeSnapshot();
      const sig = JSON.stringify(snap);
      if (sig === historyRef.current.lastSig) return;
      historyRef.current.lastSig = sig;
      const stack = historyRef.current.stack.slice(0, historyRef.current.index + 1);
      stack.push(snap);
      historyRef.current.stack = stack.slice(-50); // cap
      historyRef.current.index = historyRef.current.stack.length - 1;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sortConfig), JSON.stringify(colFilters), JSON.stringify(valueFilters), JSON.stringify(advFilters), advCombine, JSON.stringify(pivotConfig)]);
  const applySnapshot = (snap) => {
    historyRef.current.guard = true;
    try {
      setSortConfig(snap.sortConfig || []);
      setColFilters(snap.colFilters || {});
      setValueFilters(snap.valueFilters || {});
      setAdvFilters(snap.advFilters || []);
      setAdvCombine(snap.advCombine || 'AND');
      setPivotConfig((prev) => ({ ...prev, ...(snap.pivotConfig || {}) }));
    } finally {
      setTimeout(() => { historyRef.current.guard = false; }, 0);
    }
  };
  const undo = () => {
    const h = historyRef.current; if (h.index <= 0) return; h.index -= 1; const snap = h.stack[h.index]; applySnapshot(snap);
  };
  const redo = () => {
    const h = historyRef.current; if (h.index >= h.stack.length - 1) return; h.index += 1; const snap = h.stack[h.index]; applySnapshot(snap);
  };

  // Server mode data state (minimal integration)
  const [serverRows, setServerRows] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverCached, setServerCached] = useState(null);
  const [serverAllRows, setServerAllRows] = useState(null);
  const [serverAllLoading, setServerAllLoading] = useState(false);
  
  
  // Preview limits for large LOBs/objects when rendering cells
  const maxClob = Math.max(0, Math.min(100000, (previewOptions && previewOptions.maxClob) ?? 8192));
  const maxBlob = Math.max(0, Math.min(65536, (previewOptions && previewOptions.maxBlob) ?? 2048));
  const collapseChars = Math.max(80, Math.min(2000, (previewOptions && previewOptions.collapseChars) ?? 260));

  const renderCell = (val) => {
    try {
      if (val == null) return '';
      if (typeof val === 'object') {
        const t = val._type;
        if (t === 'CLOB') {
          const preview = String(val.preview ?? '');
          const text = preview.length > maxClob ? (preview.slice(0, maxClob) + '…') : preview + (val.truncated ? '…' : '');
          return text;
        }
        if (t === 'BLOB') {
          const len = Number(val.length ?? 0);
          const shown = Number(val.preview_bytes ?? 0);
          return `(BLOB ${len} bytes; showing ${shown} bytes)`;
        }
        const s = JSON.stringify(val);
        return s.length > Math.max(256, maxClob) ? s.slice(0, Math.max(256, maxClob)) + '…' : s;
      }
      const s = String(val);
      return s.length > maxClob ? s.slice(0, maxClob) + '…' : s;
    } catch {
      return String(val);
    }
  };
  

  // Choose rows sample for headers depending on server mode
  const rawRowsForHeaders = (serverMode && Array.isArray(serverRows) && serverRows.length > 0) ? serverRows : data;
  let baseHeaders = [];
  if (rawRowsForHeaders && rawRowsForHeaders.length > 0) {
    baseHeaders = Object.keys(rawRowsForHeaders[0] || {});
  } else if (initialSchema && Array.isArray(initialSchema.headers) && initialSchema.headers.length > 0) {
    baseHeaders = [...initialSchema.headers];
  } else {
    return <div style={{ color: "#aaa", padding: "10px" }}>No data to display.</div>;
  }
  const baseRowsForHeaders = rawRowsForHeaders || [];

  // Helper: bucket/grain header names from config
  const bucketHeaderFor = (col, cfg) => {
    if (!cfg) return null;
    if (cfg.type === 'equal') return `${col} (bins:${cfg.bins || 5})`;
    if (cfg.type === 'time') return `${col} (${cfg.grain || 'month'})`;
    return null;
  };
  // Combine base + derived + bucket headers (define early to avoid TDZ on usages)
  const headers = React.useMemo(() => {
    const extra = derivedCols.filter(c => c.enabled !== false && c.name).map(c => c.name);
    const bucketExtras = Object.entries(pivotBins || {}).map(([col, cfg]) => bucketHeaderFor(col, cfg)).filter(Boolean);
    return [...baseHeaders, ...extra, ...bucketExtras];
  }, [baseHeaders.join('|'), derivedCols, JSON.stringify(pivotBins)]);

  const initialViewAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialViewState || initialViewAppliedRef.current) return;
    initialViewAppliedRef.current = true;
    try {
      if (Array.isArray(initialViewState.visibleColumns)) {
        const filtered = initialViewState.visibleColumns.filter((h) => headers.includes(h));
        setVisibleColumns(filtered.length ? filtered : headers);
      }
      if (Array.isArray(initialViewState.sortConfig)) setSortConfig(initialViewState.sortConfig);
      if (typeof initialViewState.searchQuery === 'string') setSearchQuery(initialViewState.searchQuery);
      if (initialViewState.searchMode) setSearchMode(initialViewState.searchMode);
      if (typeof initialViewState.searchCaseSensitive === 'boolean') setSearchCaseSensitive(initialViewState.searchCaseSensitive);
      if (typeof initialViewState.searchVisibleOnly === 'boolean') setSearchVisibleOnly(initialViewState.searchVisibleOnly);
      if (initialViewState.colFilters && typeof initialViewState.colFilters === 'object') setColFilters(initialViewState.colFilters);
      if (initialViewState.valueFilters && typeof initialViewState.valueFilters === 'object') setValueFilters(initialViewState.valueFilters);
      if (Array.isArray(initialViewState.advFilters)) setAdvFilters(initialViewState.advFilters);
      if (typeof initialViewState.advCombine === 'string') setAdvCombine(initialViewState.advCombine);
      if (Array.isArray(initialViewState.derivedCols)) setDerivedCols(initialViewState.derivedCols);
      if (initialViewState.pivotConfig && typeof initialViewState.pivotConfig === 'object') {
        setPivotConfig((prev) => ({ ...prev, ...initialViewState.pivotConfig }));
      }
      if (Array.isArray(initialViewState.pivotCalcMeasures)) setPivotCalcMeasures(initialViewState.pivotCalcMeasures);
      if (initialViewState.pivotBins && typeof initialViewState.pivotBins === 'object') setPivotBins(initialViewState.pivotBins);
      if (Array.isArray(initialViewState.pivotCollapsed)) setPivotCollapsed(new Set(initialViewState.pivotCollapsed));
      if (initialViewState.colFormats && typeof initialViewState.colFormats === 'object') setColFormats(initialViewState.colFormats);
      if (typeof initialViewState.freezeCount === 'number') setFreezeCount(initialViewState.freezeCount);
      if (Array.isArray(initialViewState.columnOrder)) setColumnOrder(initialViewState.columnOrder);
      if (Array.isArray(initialViewState.condRules)) setCondRules(initialViewState.condRules);
      if (typeof initialViewState.pageSize === 'number' && initialViewState.pageSize > 0) setPageSize(initialViewState.pageSize);
      if (typeof initialViewState.fontSize === 'number' && initialViewState.fontSize > 0) setFontSize(initialViewState.fontSize);
      if (typeof initialViewState.isPivotView === 'boolean') setIsPivotView(initialViewState.isPivotView);
    } catch (err) {
      console.error('Apply initial view state failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewState, headers.join('|')]);

  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    // Try restore visible columns; default to all columns
    const visKey = `table.visibleColumns.${baseHeaders.join('|')}`;
    try {
      const storedVis = localStorage.getItem(visKey);
      if (storedVis) {
        const parsed = JSON.parse(storedVis);
        if (Array.isArray(parsed) && parsed.length) {
          setVisibleColumns(parsed.filter(h => baseHeaders.includes(h)));
          return;
        }
      }
    } catch {}
    setVisibleColumns(baseHeaders);
  }, [baseHeaders.join(",")]);

  // close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowColumnPicker(false);
      }
      if (pivotRef.current && !pivotRef.current.contains(e.target)) {
        setShowPivotPicker(false);
      }
      if (derivedRef.current && !derivedRef.current.contains(e.target)) {
        setShowDerivedPicker(false);
      }
      if (formatRef.current && !formatRef.current.contains(e.target)) {
        setShowFormatPicker(false);
      }
      if (formatsRef.current && !formatsRef.current.contains(e.target)) {
        setShowFormatsPanel(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterPicker(false);
      }
      if (advancedRef.current && !advancedRef.current.contains(e.target)) {
        setShowAdvancedPicker(false);
      }
      if (headerFilterMenuRef.current && !headerFilterMenuRef.current.contains(e.target)) {
        setHeaderFilterOpenCol(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When header filter menu opens/closes or switches columns, stage or commit selections
  useEffect(() => {
    const prevCol = prevHeaderFilterOpenColRef.current;
    if (prevCol && prevCol !== headerFilterOpenCol) {
      // Commit previous column's draft on switch/close
      const draft = headerFilterDraftRef.current;
      if (draft && draft.col === prevCol) {
        setValueFilters((prev) => {
          const copy = { ...prev };
          if (draft.selected === null) {
            // null => all selected (remove filter)
            delete copy[prevCol];
          } else {
            copy[prevCol] = [...draft.selected];
          }
          return copy;
        });
        setCurrentPage(1);
      }
    }
    if (headerFilterOpenCol) {
      const sel = valueFilters[headerFilterOpenCol] ? [...valueFilters[headerFilterOpenCol]] : null;
      const draft = { col: headerFilterOpenCol, selected: sel };
      headerFilterDraftRef.current = draft;
      setHeaderFilterDraft(draft);
    } else {
      headerFilterDraftRef.current = null;
      setHeaderFilterDraft(null);
    }
    prevHeaderFilterOpenColRef.current = headerFilterOpenCol;
  }, [headerFilterOpenCol, valueFilters]);

  // Fetch distinct values for header filter from server in serverMode
  useEffect(() => {
    const col = headerFilterOpenCol;
    if (!serverMode || !col) return;
    if (!exportContext || !exportContext.prompt || !exportContext.mode || !exportContext.model) return;
    const maxDistinctRaw = perfOptions && perfOptions.maxDistinct;
    const limit = ((maxDistinctRaw === 'full') || (Number(maxDistinctRaw) < 0)) ? 'full' : Math.max(1, Math.min(500, Number(maxDistinctRaw) || 50));
    const ctrl = new AbortController();
    const fetchDistinct = async () => {
      try {
        setHeaderDistinctLoading(true);
        const res = await fetch('/api/table/distinct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: exportContext.model,
            mode: exportContext.mode,
            prompt: exportContext.prompt,
            column: col,
            limit,
            searchTerm: debouncedHeaderDistinctTerm || undefined,
            // include current context filters for server-side filtering
            columnFilters: colFilters,
            valueFilters,
            advancedFilters: { rules: advFilters, combine: advCombine },
            tableOpsMode,
            pushDownDb,
            baseSql: exportContext.baseSql,
            columnTypes: exportContext.columnTypes,
            searchColumns: headers,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const distinct = Array.isArray(json.distinct) ? json.distinct : [];
        setHeaderDistincts(prev => ({ ...prev, [col]: distinct }));
      } catch (e) {
        if (e.name !== 'AbortError') console.error('distinct fetch failed', e);
      } finally {
        setHeaderDistinctLoading(false);
      }
    };
    fetchDistinct();
    return () => ctrl.abort();
  }, [serverMode, headerFilterOpenCol, exportContext && exportContext.prompt, exportContext && exportContext.mode, exportContext && exportContext.model, perfOptions && perfOptions.maxDistinct, debouncedHeaderDistinctTerm, JSON.stringify(colFilters), JSON.stringify(valueFilters), JSON.stringify(advFilters), advCombine]);

  // Reset term when switching columns
  useEffect(() => { setHeaderDistinctTerm(''); }, [headerFilterOpenCol]);

  // Persist prefs
  useEffect(() => {
    const visKey = `table.visibleColumns.${baseHeaders.join('|')}`;
    try { localStorage.setItem(visKey, JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns, baseHeaders]);
  // (Deliberately not persisting page size or font size to avoid conflicts with parent props)
  // Persist conditional formatting rules per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.condRules.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCondRules(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.condRules.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(condRules)); } catch {}
  }, [condRules, baseHeaders]);

  const toggleColumn = (col) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const selectAllColumns = () => setVisibleColumns([...headers]);
  const deselectAllColumns = () => setVisibleColumns([]);

  // Persist derived columns per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.derived.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setDerivedCols(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.derived.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(derivedCols)); } catch {}
  }, [derivedCols, baseHeaders]);

  // Ensure newly added enabled derived columns become visible automatically
  useEffect(() => {
    const activeDerived = derivedCols
      .filter((c) => c.enabled !== false && c.name)
      .map((c) => c.name);
    if (activeDerived.length === 0) return;
    setVisibleColumns((prev) => {
      const set = new Set(prev);
      let changed = false;
      for (const name of activeDerived) {
        if (!set.has(name)) { set.add(name); changed = true; }
      }
      return changed ? Array.from(set) : prev;
    });
  }, [derivedCols]);

  // Persist per-column filters per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.colFilters.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') setColFilters(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.colFilters.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(colFilters)); } catch {}
  }, [colFilters, baseHeaders]);

  // Persist summary row visibility per dataset signature (default hidden)
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.showSummary.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored != null) setShowSummary(stored === 'true');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.showSummary.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, String(showSummary)); } catch {}
  }, [showSummary, baseHeaders]);

  // Persist advanced filters and search preferences
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.advFilters.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setAdvFilters(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.advFilters.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(advFilters)); } catch {}
  }, [advFilters, baseHeaders]);
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.advCombine.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setAdvCombine(stored === 'OR' ? 'OR' : 'AND');
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.advCombine.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, String(advCombine)); } catch {}
  }, [advCombine, baseHeaders]);
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.searchPrefs.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (parsed.mode) setSearchMode(parsed.mode);
          if (typeof parsed.caseSensitive === 'boolean') setSearchCaseSensitive(parsed.caseSensitive);
          if (typeof parsed.visibleOnly === 'boolean') setSearchVisibleOnly(parsed.visibleOnly);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.searchPrefs.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify({ mode: searchMode, caseSensitive: searchCaseSensitive, visibleOnly: searchVisibleOnly })); } catch {}
  }, [searchMode, searchCaseSensitive, searchVisibleOnly, baseHeaders]);

  // Persist value filters per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.valueFilters.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') setValueFilters(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.valueFilters.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(valueFilters)); } catch {}
  }, [valueFilters, baseHeaders]);

  // Persist pivot row styles per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.pivotStyle.${baseHeaders.join('|')}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') setPivotStyle({ ...{ subtotalBg: '#2d2d2d', subtotalText: '#ffffff', grandBg: '#1f1f1f', grandText: '#ffffff', subtotalNewline: true }, ...parsed });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.pivotStyle.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(pivotStyle)); } catch {}
  }, [pivotStyle, baseHeaders]);

  // Persist column layout + formats per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const prefKey = (name) => `table.${name}.${baseHeaders.join('|')}`;
    try {
      const w = localStorage.getItem(prefKey('colWidths'));
      if (w) setColWidths(JSON.parse(w) || {});
    } catch {}
    try {
      const o = localStorage.getItem(prefKey('colOrder'));
      if (o) setColumnOrder(JSON.parse(o) || []);
    } catch {}
    try {
      const fz = localStorage.getItem(prefKey('freezeCount'));
      if (fz != null) setFreezeCount(Number(fz) || 0);
    } catch {}
    try {
      const fmt = localStorage.getItem(prefKey('colFormats'));
      if (fmt) setColFormats(JSON.parse(fmt) || {});
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.colWidths.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(colWidths)); } catch {}
  }, [colWidths, baseHeaders]);
  useEffect(() => {
    const key = `table.colOrder.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(columnOrder)); } catch {}
  }, [columnOrder, baseHeaders]);
  useEffect(() => {
    const key = `table.freezeCount.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, String(freezeCount)); } catch {}
  }, [freezeCount, baseHeaders]);
  useEffect(() => {
    const key = `table.colFormats.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(colFormats)); } catch {}
  }, [colFormats, baseHeaders]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, colFilters, valueFilters, advFilters, advCombine]);

  // Ensure columnOrder always contains current headers (in base order first time)
  useEffect(() => {
    setColumnOrder((prev) => {
      const ensure = (p) => {
        const base = p && p.length ? p : headers;
        const set = new Set(base);
        const added = headers.filter(h => !set.has(h));
        const merged = [...base, ...added].filter(h => headers.includes(h));
        // shallow equality check
        if (p && p.length === merged.length && p.every((v,i) => v === merged[i])) return p;
        return merged.slice();
      };
      return ensure(prev);
    });
  }, [headers.join(',')]);

  // Columns to display in non-pivot view in the chosen order
  const displayColumns = React.useMemo(() => {
    const vis = headers.filter((h) => visibleColumns.includes(h));
    if (!columnOrder || columnOrder.length === 0) return vis;
    const pos = new Map(columnOrder.map((c, i) => [c, i]));
    return [...vis].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
  }, [headers, visibleColumns, columnOrder]);

  const freezeLeft = React.useMemo(() => {
    const map = {};
    let left = 0;
    const cols = displayColumns.slice(0, Math.max(0, Math.min(freezeCount, displayColumns.length)));
    for (const c of cols) {
      map[c] = left;
      left += (colWidths[c] || 150);
    }
    return map;
  }, [displayColumns, freezeCount, colWidths]);

  // Virtual header/body shared dimensions
  const vCols = displayColumns;
  const vGridTemplate = React.useMemo(() => vCols.map(c => `${(colWidths[c] || 150)}px`).join(' '), [vCols.join(','), colWidths]);
  const vTotalWidth = React.useMemo(() => vCols.reduce((acc, c) => acc + (colWidths[c] || 150), 0), [vCols.join(','), colWidths]);
  const indexColWidth = 56;
  const vScale = (isVirtualized && viewportWidth) ? Math.max(1, (viewportWidth) / Math.max(1, vTotalWidth + indexColWidth)) : 1;
  const vGridTemplateScaled = React.useMemo(() => vCols.map(c => `${Math.round(((colWidths[c] || 150)) * vScale)}px`).join(' '), [vCols.join(','), colWidths, vScale]);
  const indexColWidthScaled = Math.round(indexColWidth * vScale);
  const vGridTemplateWithIndex = `${indexColWidth}px ${vGridTemplate}`;
  const vGridTemplateScaledWithIndex = `${indexColWidthScaled}px ${vGridTemplateScaled}`;
  const contentWidth = (isVirtualized && !isPivotView && viewportWidth) ? Math.max(viewportWidth, vTotalWidth + indexColWidth) : null;
  const vFreezeLeftScaled = React.useMemo(() => {
    const map = {};
    let left = 0;
    const cols = vCols.slice(0, Math.max(0, Math.min(freezeCount, vCols.length)));
    for (const c of cols) {
      map[c] = left;
      left += Math.round(((colWidths[c] || 150)) * vScale);
    }
    return map;
  }, [vCols.join(','), freezeCount, colWidths, vScale]);

  useEffect(() => {
    if (!isVirtualized) return;
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth || 0);
    update();
    let ro;
    try {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } catch {
      window.addEventListener('resize', update);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      window.removeEventListener('resize', update);
    };
  }, [isVirtualized]);

  // sorting
  const handleSort = (key, shiftKey) => {
    setSortConfig((prevConfig) => {
      let newConfig = [...prevConfig];
      const existingIndex = newConfig.findIndex((c) => c.key === key);

      if (existingIndex > -1) {
        const currentDirection = newConfig[existingIndex].direction;
        const newDirection = currentDirection === "asc" ? "desc" : "asc";
        newConfig[existingIndex] = { key, direction: newDirection };
      } else {
        newConfig.push({ key, direction: "asc" });
      }

      if (!shiftKey) {
        newConfig = [newConfig[newConfig.length - 1]];
      }
      return newConfig;
    });
  };

  const clearSorting = () => setSortConfig([]);
  const isValidDate = (val) => val && !isNaN(Date.parse(val));
  // Debounced search for better perf on large data
  const debouncedSearch = useDebounced(searchQuery, 200);

  // filter by search (over full dataset)
  const filteredData = React.useMemo(() => {
    const matchesColFilter = (row, col, f) => {
      if (!f || !f.op) return true;
      const raw = row?.[col];
      const val = raw == null ? '' : raw;
      const op = f.op;
      const v1 = f.value;
      const v2 = f.value2;
      // Treat numeric operators as numeric compare regardless of inferred type
      const isNumOp = ['=','!=','>','>=','<','<=','between'].includes(op);
      if (isNumOp) {
        const n = Number(val);
        const a = Number(v1);
        const b = Number(v2);
        if (!isFinite(n)) return false;
        switch (op) {
          case '=': return n === a;
          case '!=': return n !== a;
          case '>': return n > a;
          case '>=': return n >= a;
          case '<': return n < a;
          case '<=': return n <= a;
          case 'between': return isFinite(a) && isFinite(b) ? (n >= Math.min(a,b) && n <= Math.max(a,b)) : true;
          default: return true;
        }
      }
      // string-ish compare
      const s = String(val).toLowerCase();
      const t = String(v1 ?? '').toLowerCase();
      switch (op) {
        case 'contains': return s.includes(t);
        case 'equals': return s === t;
        case 'startsWith': return s.startsWith(t);
        case 'endsWith': return s.endsWith(t);
        case 'notContains': return !s.includes(t);
        case 'isEmpty': return s.length === 0;
        case 'notEmpty': return s.length > 0;
        default: return true;
      }
    };

    // Apply global search first (debounced)
    let base = data;
    if (debouncedSearch) {
      const cols = searchVisibleOnly ? headers.filter((h) => visibleColumns.includes(h)) : headers;
      if (searchMode === 'regex') {
        let re = null;
        try { re = new RegExp(debouncedSearch, searchCaseSensitive ? '' : 'i'); } catch {}
        if (re) {
          base = base.filter((row) => cols.some((h) => re.test(String(row?.[h] ?? ''))));
        }
      } else if (searchMode === 'exact') {
        const q = searchCaseSensitive ? debouncedSearch : debouncedSearch.toLowerCase();
        base = base.filter((row) => cols.some((h) => {
          const v = String(row?.[h] ?? '');
          return searchCaseSensitive ? v === q : v.toLowerCase() === q;
        }));
      } else {
        const q = searchCaseSensitive ? debouncedSearch : debouncedSearch.toLowerCase();
        base = base.filter((row) => cols.some((h) => {
          const v = String(row?.[h] ?? '');
          const sv = searchCaseSensitive ? v : v.toLowerCase();
          return sv.includes(q);
        }));
      }
    }

    // Apply per-column filters (AND across columns)
    const activeCols = Object.keys(colFilters).filter((c) => colFilters[c] && colFilters[c].op && (colFilters[c].op === 'isEmpty' || colFilters[c].op === 'notEmpty' || (colFilters[c].value != null && String(colFilters[c].value).length > 0)));
    const afterColFilters = activeCols.length === 0
      ? base
      : base.filter((row) => activeCols.every((c) => matchesColFilter(row, c, colFilters[c])));

    // Apply advanced filters
    const afterAdv = (() => {
      if (!advFilters.length) return afterColFilters;
      const evalAdv = (row, f) => matchesColFilter(row, f.column, f);
      if (advCombine === 'AND') return afterColFilters.filter((r) => advFilters.every((f) => evalAdv(r, f)));
      return afterColFilters.filter((r) => advFilters.some((f) => evalAdv(r, f)));
    })();

    // Apply value filters (multi-select per column)
    const vfCols = Object.keys(valueFilters || {}).filter((c) => Array.isArray(valueFilters[c]));
    if (vfCols.length === 0) return afterAdv;
    return afterAdv.filter((row) => vfCols.every((c) => {
      const sel = valueFilters[c];
      if (!sel) return true;
      const v = String(row?.[c] ?? '');
      return sel.includes(v);
    }));
  }, [data, debouncedSearch, headers, colFilters, advFilters, advCombine, searchMode, searchCaseSensitive, searchVisibleOnly, visibleColumns, valueFilters]);

  // Derived columns evaluation with compile/cache
  const formulaCacheRef = React.useRef(new Map());
  const evalFormula = React.useCallback((formula, row) => {
    const key = String(formula || '');
    let fn = formulaCacheRef.current.get(key);
    if (!fn) {
      try { fn = new Function('col', 'row', 'Math', '"use strict"; return ( ' + key + ' );'); }
      catch { fn = () => null; }
      formulaCacheRef.current.set(key, fn);
    }
    try { return fn((name) => row?.[name], row, Math); } catch { return null; }
  }, []);

  // Helper: apply derived columns to an arbitrary row array (for serverMode rows and pivot)
  const applyDerivedToRows = React.useCallback((rows) => {
    const actives = derivedCols.filter(c => c.enabled !== false && c.name);
    if (!actives.length || !Array.isArray(rows) || rows.length === 0) return rows;
    return rows.map((r) => {
      const out = { ...r };
      for (const c of actives) {
        out[c.name] = evalFormula(c.formula, r);
      }
      return out;
    });
  }, [derivedCols, evalFormula]);

  const withDerived = React.useMemo(() => {
    const actives = derivedCols.filter(c => c.enabled !== false && c.name);
    if (actives.length === 0) {
      if (isDev) console.debug('[Table] Derived: 0 active columns');
      return filteredData;
    }
    const t0 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const result = filteredData.map((r) => {
      const out = { ...r };
      for (const c of actives) {
        out[c.name] = evalFormula(c.formula, r);
      }
      return out;
    });
    const t1 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    if (isDev) console.log(`[Table] Derived computed in ${Math.round(t1 - t0)}ms (rows=${filteredData.length}, cols=${actives.length})`);
    return result;
  }, [filteredData, derivedCols, evalFormula]);

  // Server-mode rows with derived columns for display
  const serverRowsWithDerived = React.useMemo(() => applyDerivedToRows(serverRows), [serverRows, applyDerivedToRows]);

  // Apply numeric bins and time grains to rows (adds derived grouping columns used mainly for pivot)
  const applyBucketsToRows = React.useCallback((rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return rows;
    const cfgs = pivotBins || {};
    const keys = Object.keys(cfgs);
    if (!keys.length) return rows;
    // Precompute stats for equal bins
    const stats = {};
    for (const col of keys) {
      const cfg = cfgs[col];
      if (cfg && cfg.type === 'equal') {
        const nums = rows.map(r => Number(r[col])).filter(v => isFinite(v));
        if (nums.length) {
          let min = nums[0], max = nums[0];
          for (const n of nums) { if (n < min) min = n; if (n > max) max = n; }
          stats[col] = { min, max };
        }
      }
    }
    const toWeek = (d) => {
      const t = new Date(d);
      const onejan = new Date(t.getFullYear(),0,1);
      const millis = (t - onejan) + ((onejan.getTimezoneOffset()-t.getTimezoneOffset())*60000);
      const day = Math.floor(millis / 86400000) + 1;
      return Math.ceil(day/7);
    };
    return rows.map(r => {
      const out = { ...r };
      for (const col of keys) {
        const cfg = cfgs[col];
        const bHeader = bucketHeaderFor(col, cfg);
        if (!bHeader) continue;
        if (cfg.type === 'equal') {
          const s = stats[col];
          const n = Number(r[col]);
          const bins = Math.max(1, Number(cfg.bins)||5);
          if (!s || !isFinite(n)) { out[bHeader] = ''; continue; }
          const range = s.max - s.min || 1;
          let idx = Math.floor(((n - s.min) / range) * bins);
          if (idx >= bins) idx = bins - 1;
          const start = s.min + (range / bins) * idx;
          const end = s.min + (range / bins) * (idx + 1);
          out[bHeader] = `[${Number(start.toFixed(2))} – ${Number(end.toFixed(2))})`;
        } else if (cfg.type === 'time') {
          const v = r[col];
          const d = isValidDate(v) ? new Date(v) : null;
          if (!d) { out[bHeader] = ''; continue; }
          switch (cfg.grain) {
            case 'year': out[bHeader] = String(d.getFullYear()); break;
            case 'quarter': out[bHeader] = `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`; break;
            case 'month': out[bHeader] = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; break;
            case 'week': out[bHeader] = `${d.getFullYear()}-W${String(toWeek(d)).padStart(2,'0')}`; break;
            case 'day': default: out[bHeader] = d.toISOString().slice(0,10);
          }
        }
      }
      return out;
    });
  }, [JSON.stringify(pivotBins)]);

  const withDerivedAndBuckets = React.useMemo(() => applyBucketsToRows(withDerived), [withDerived, applyBucketsToRows]);
  const serverRowsWithDerivedAndBuckets = React.useMemo(() => applyBucketsToRows(serverRowsWithDerived), [serverRowsWithDerived, applyBucketsToRows]);

  // Drill helpers: open side panel with matching underlying rows
  const [drillContext, setDrillContext] = useState(null); // { column?, value?, groupKey? }
  const openDrillForCell = React.useCallback((opts) => {
    try {
      const { column, value, groupKey } = opts || {};
      // Base dataset with derived values so drilling on derived columns works, too
      const rows = withDerivedAndBuckets;
      const match = (r) => {
        // Apply group key match if provided (pivot)
        if (groupKey && typeof groupKey === 'object') {
          for (const k of Object.keys(groupKey)) {
            if (String(r?.[k] ?? '') !== String(groupKey[k] ?? '')) return false;
          }
        }
        if (column != null) {
          return String(r?.[column] ?? '') === String(value ?? '');
        }
        return true;
      };
      const out = rows.filter(match);
      setDrillRows(out);
      setDrillContext({ column, value, groupKey: groupKey || null });
      setShowDrill(true);
    } catch (e) {
      console.error('Drill open failed', e);
    }
  }, [withDerivedAndBuckets]);

  // apply sorting
  const sortedData = React.useMemo(() => {
    if (sortConfig.length === 0) return withDerived;

    return [...withDerived].sort((a, b) => {
      for (const { key, direction } of sortConfig) {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal === bVal) continue;

        let comparison = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else if (isValidDate(aVal) && isValidDate(bVal)) {
          comparison = new Date(aVal) - new Date(bVal);
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [withDerived, sortConfig]);

  // pivot logic (multi-level)
  const aggregate = (values, func) => {
    const nums = values.filter((v) => typeof v === "number");
    switch (func) {
      case "sum": return nums.reduce((a, b) => a + b, 0);
      case "avg": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      case "count": return values.length;
      case "min": return nums.length ? Math.min(...nums) : null;
      case "max": return nums.length ? Math.max(...nums) : null;
      default: return null;
    }
  };
  const numericCols = React.useMemo(() => {
    // Heuristic: column is numeric if sampled values are numeric
    const set = new Set();
    const sample = (isPivotView ? sortedData : withDerivedAndBuckets).slice(0, 50);
    headers.forEach((h) => {
      const vals = sample.map(r => r[h]).filter(v => v !== undefined && v !== null && v !== "");
      if (vals.length && vals.every(v => typeof v === 'number' || (!isNaN(Number(v)) && isFinite(Number(v))))) {
        set.add(h);
      }
    });
    if (set.size === 0 && initialSchema && initialSchema.columnTypes) {
      try {
        Object.entries(initialSchema.columnTypes).forEach(([col, typ]) => {
          const t = String(typ || '').toLowerCase();
          if (['number', 'numeric', 'float', 'double', 'decimal', 'integer', 'int'].some((kw) => t.includes(kw))) {
            set.add(col);
          }
        });
      } catch {}
    }
    return set;
  }, [headers.join('|'), withDerived, sortedData, isPivotView, initialSchema]);

  // charts are handled by ChartPanel (lazy-loaded)

  const pivotedData = React.useMemo(() => {
    if (!isPivotView || pivotConfig.columns.length === 0) return [];

    const t0 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

    // Choose base rows: server full/all rows (preferred), else server page, else client withDerived
    const baseRows = serverMode ? (Array.isArray(serverAllRows) && serverAllRows.length ? serverAllRows : serverRowsWithDerivedAndBuckets) : withDerivedAndBuckets;

    const measures = (pivotConfig.measures && pivotConfig.measures.length)
      ? pivotConfig.measures
      : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
    const funcs = (pivotConfig.funcs && pivotConfig.funcs.length)
      ? pivotConfig.funcs
      : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
    if (measures.length === 0) return [];

    const labels = [];
    for (const m of measures) for (const f of funcs) labels.push(`${m} (${f})`);
    // Calculated measures: append their names
    const calcLabels = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);

    const grandCollect = Object.fromEntries(labels.map(l => [l, []]));
    const rows = [];

    const computeAggs = (arr) => {
      const out = {};
      for (const m of measures) {
        const vals = arr.map(r => r[m]);
        for (const f of funcs) {
          const label = `${m} (${f})`;
          switch (f) {
            case 'sum': {
              const ns = vals.map(v => Number(v)).filter(v => isFinite(v));
              out[label] = ns.reduce((a,b)=>a+b,0);
              break; }
            case 'avg': {
              const ns = vals.map(v => Number(v)).filter(v => isFinite(v));
              out[label] = ns.length ? ns.reduce((a,b)=>a+b,0)/ns.length : 0; break; }
            case 'count': out[label] = vals.length; break;
            case 'min': {
              const ns = vals.map(v => Number(v)).filter(v => isFinite(v));
              out[label] = ns.length ? Math.min(...ns) : null; break; }
            case 'max': {
              const ns = vals.map(v => Number(v)).filter(v => isFinite(v));
              out[label] = ns.length ? Math.max(...ns) : null; break; }
            default: out[label] = null;
          }
        }
      }
      // Calculated measures: eval expressions with 'm' = out, 'Math'
      for (const cm of (pivotCalcMeasures || [])) {
        if (!cm || cm.enabled === false || !cm.name) continue;
        const key = String(cm.formula || '').trim();
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('m','Math', '"use strict"; return ( ' + (key || 'null') + ' );');
          const v = fn(out, Math);
          out[cm.name] = v;
        } catch { out[cm.name] = null; }
      }
      return out;
    };

    // Precompute grand totals per label for % of total
    const grandTotals = computeAggs(baseRows);

    // If column axis specified, produce cross-tab columns per column key
    const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
    let colKeyLabels = [];
    let colKeyToRows = new Map();
    if (colAxis.length > 0) {
      for (const r of baseRows) {
        const keyObj = Object.fromEntries(colAxis.map(c => [c, String(r[c] ?? '')]));
        const label = colAxis.map(c => `${c}: ${keyObj[c]}`).join(' | ');
        const k = JSON.stringify(keyObj);
        if (!colKeyToRows.has(k)) colKeyToRows.set(k, { label, rows: [] });
        colKeyToRows.get(k).rows.push(r);
      }
      colKeyLabels = Array.from(colKeyToRows.values()).map(v => v.label);
      colKeyLabels.sort((a,b) => a.localeCompare(b));
      if (pivotConfig.showGrand !== false) colKeyLabels.push('Grand Total');
    }

    const buildGroups = (arr, level, prefix = {}, parentTotals = null) => {
      const col = pivotConfig.columns[level];
      const grouped = new Map();
      for (const r of arr) {
        const key = String(r[col] ?? "");
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(r);
      }

      // Build per-key items (subtotal + children) first
      const items = [];
      for (const [key, groupRows] of grouped) {
        const nextPrefix = { ...prefix, [col]: key };
        // Collect values for grand totals collector
        for (const m of measures) grandCollect[`${m} (sum)`]?.push(...groupRows.map(g => g[m]));

        const subtotalRow = (() => {
          const obj = {};
          if (pivotConfig.rowLabelsMode === 'single') {
            const label = (nextPrefix[col] ?? '');
            obj['__row_label__'] = label;
            obj['Row Labels'] = label; // convenience for render paths
            // keep actual row-fields empty so they don't render in separate mode columns
            pivotConfig.columns.forEach((c) => { obj[c] = ''; });
          } else {
            pivotConfig.columns.forEach((c, i) => {
              obj[c] = (i === level) ? (nextPrefix[c] ?? "") : "";
            });
          }
          return obj;
        })();
        if (colAxis.length === 0) {
          const aggs = computeAggs(groupRows);
          for (const l of labels) subtotalRow[l] = aggs[l];
          for (const cl of calcLabels) subtotalRow[cl] = aggs[cl];
          if (pivotConfig.calcPctTotal) {
            for (const l of labels) {
              const denom = Number(grandTotals[l]);
              const num = Number(subtotalRow[l]);
              subtotalRow[`${l} (% total)`] = denom ? num / denom : 0;
            }
          }
          if (pivotConfig.calcPctParent && parentTotals) {
            for (const l of labels) {
              const denom = Number(parentTotals[l]);
              const num = Number(subtotalRow[l]);
              subtotalRow[`${l} (% parent)`] = denom ? num / denom : 0;
            }
          }
        } else {
          // Cross-tab: compute each column key
          const rowTotals = {};
          const colTotals = {};
          const byColLabelAgg = (label) => {
            if (label === 'Grand Total') return computeAggs(groupRows);
            // reconstruct keyObj from label
            // we built label as "col: val | col2: val2"; match rows that have same values
            const parts = label.split(' | ').map(s => s.split(': '));
            const match = (r) => parts.every(([c, v]) => String(r[c] ?? '') === v);
            const rowsForKey = groupRows.filter(match);
            return computeAggs(rowsForKey);
          };
          const ti = pivotConfig.timeIntel || {};
          const tiActive = !!ti.enabled && Array.isArray(ti.funcs) && ti.funcs.length && colAxis.length === 1 && (!ti.field || ti.field === colAxis[0]);
          const parseTimeVal = (label) => {
            try {
              const right = (label.split(': ').slice(1).join(': ') || '').trim();
              // 'YYYY', 'YYYY-MM', 'YYYY-MM-DD'
              if (/^\d{4}$/.test(right)) return { type: 'year', year: Number(right), key: right };
              if (/^\d{4}-\d{2}$/.test(right)) {
                const [y,m] = right.split('-').map(Number);
                return { type: 'month', year: y, month: m, key: right };
              }
              if (/^\d{4}-\d{2}-\d{2}$/.test(right)) {
                const [y,m,d] = right.split('-').map(Number);
                return { type: 'day', year: y, month: m, day: d, key: right };
              }
              const mq = right.match(/^Q(\d) (\d{4})$/);
              if (mq) return { type: 'quarter', quarter: Number(mq[1]), year: Number(mq[2]), key: right };
              const mw = right.match(/^(\d{4})-W(\d{2})$/);
              if (mw) return { type: 'week', week: Number(mw[2]), year: Number(mw[1]), key: right };
              return { type: 'unknown', key: right };
            } catch { return { type: 'unknown' }; }
          };
          const timeInfo = colKeyLabels.map(lbl => ({ lbl, t: parseTimeVal(lbl) }));
          if (tiActive) {
            // Sort time-aware if possible
            const orderVal = (t) => {
              if (!t) return Number.MAX_SAFE_INTEGER;
              switch (t.type) {
                case 'year': return t.year;
                case 'quarter': return t.year*10 + t.quarter;
                case 'month': return t.year*100 + t.month;
                case 'week': return t.year*100 + t.week;
                case 'day': return (new Date(`${t.year}-${String(t.month||1).padStart(2,'0')}-${String(t.day||1).padStart(2,'0')}`).getTime()/86400000);
                default: return Number.MAX_SAFE_INTEGER;
              }
            };
            timeInfo.sort((a,b) => orderVal(a.t) - orderVal(b.t));
            colKeyLabels = timeInfo.map(x => x.lbl);
          }
          for (const colLabel of colKeyLabels) {
            const aggs = byColLabelAgg(colLabel);
            for (const l of labels) {
              const keyName = `${colLabel} | ${l}`;
              subtotalRow[keyName] = aggs[l];
              rowTotals[l] = (rowTotals[l] || 0) + (Number(aggs[l])||0);
              colTotals[keyName] = (colTotals[keyName] || 0) + (Number(aggs[l])||0);
            }
            for (const cl of calcLabels) {
              const keyName = `${colLabel} | ${cl}`;
              subtotalRow[keyName] = aggs[cl];
            }
          }
          // Time intelligence columns
          if (tiActive && (ti.funcs||[]).length) {
            const idxByKey = new Map(colKeyLabels.map((lbl,i) => [lbl, i]));
            const infoByLbl = new Map(timeInfo.map(x => [x.lbl, x.t]));
            const sameMonthPrevYearLbl = (lbl) => {
              const t = infoByLbl.get(lbl);
              if (!t || (t.type !== 'month' && t.type !== 'year' && t.type !== 'day')) return null;
              if (t.type === 'year') {
                const target = `${t.year-1}`;
                const match = colKeyLabels.find(x => (parseTimeVal(x).key === target));
                return match || null;
              }
              if (t.type === 'month') {
                const target = `${t.year-1}-${String(t.month).padStart(2,'0')}`;
                const match = colKeyLabels.find(x => (parseTimeVal(x).key === target));
                return match || null;
              }
              if (t.type === 'day') {
                // naive: compare same day prev month
                let y = t.year, m = t.month-1, d = t.day;
                if (m <= 0) { m = 12; y--; }
                const target = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const match = colKeyLabels.find(x => (parseTimeVal(x).key === target));
                return match || null;
              }
              return null;
            };
            for (let i = 0; i < colKeyLabels.length; i++) {
              const lbl = colKeyLabels[i];
              const prevLbl = i > 0 ? colKeyLabels[i-1] : null;
              const yoyLbl = sameMonthPrevYearLbl(lbl);
              for (const l of labels) {
                const baseKey = `${lbl} | ${l}`;
                const baseVal = Number(subtotalRow[baseKey]) || 0;
                if (ti.funcs.includes('MoM') && prevLbl) {
                  const prevVal = Number(subtotalRow[`${prevLbl} | ${l}`]) || 0;
                  subtotalRow[`${baseKey} (MoM%)`] = prevVal ? (baseVal - prevVal) / prevVal : 0;
                }
                if (ti.funcs.includes('YoY') && yoyLbl) {
                  const prevVal = Number(subtotalRow[`${yoyLbl} | ${l}`]) || 0;
                  subtotalRow[`${baseKey} (YoY%)`] = prevVal ? (baseVal - prevVal) / prevVal : 0;
                }
                if (ti.funcs.includes('YTD')) {
                  // accumulate since beginning of same year for month/day; for year use itself
                  const t = infoByLbl.get(lbl);
                  if (t && (t.type === 'month' || t.type === 'day')) {
                    let acc = 0;
                    for (let j = 0; j <= i; j++) {
                      const tj = infoByLbl.get(colKeyLabels[j]);
                      if (!tj) continue;
                      if (tj.type === t.type && tj.year === t.year && (t.type !== 'month' || tj.month <= t.month) && (t.type !== 'day' || (tj.month < t.month || (tj.month === t.month && tj.day <= t.day)))) {
                        acc += Number(subtotalRow[`${colKeyLabels[j]} | ${l}`]) || 0;
                      }
                    }
                    subtotalRow[`${baseKey} (YTD)`] = acc;
                  } else if (t && t.type === 'year') {
                    subtotalRow[`${baseKey} (YTD)`] = baseVal;
                  }
                }
                if (ti.funcs.includes('MTD')) {
                  const t = infoByLbl.get(lbl);
                  if (t && t.type === 'day') {
                    let acc = 0;
                    for (let j = 0; j <= i; j++) {
                      const tj = infoByLbl.get(colKeyLabels[j]);
                      if (tj && tj.type === 'day' && tj.year === t.year && tj.month === t.month && tj.day <= t.day) {
                        acc += Number(subtotalRow[`${colKeyLabels[j]} | ${l}`]) || 0;
                      }
                    }
                    subtotalRow[`${baseKey} (MTD)`] = acc;
                  }
                }
              }
            }
          }
          // Percent of row/column if enabled
          if (pivotConfig.percentRow) {
            for (const colLabel of colKeyLabels) for (const l of labels) {
              const keyName = `${colLabel} | ${l}`;
              const denom = rowTotals[l] || 0;
              const num = Number(subtotalRow[keyName]) || 0;
              subtotalRow[`${keyName} (% row)`] = denom ? num / denom : 0;
            }
          }
          if (pivotConfig.percentCol) {
            // compute totals for each column across rows later; here we leave value as-is; will be meaningful when exporting or viewing totals
          }
        }

        // Calculated: % of total / parent
        subtotalRow._isSubtotal = true;
        subtotalRow._level = level;
        subtotalRow._groupKey = nextPrefix;
        items.push({ key, subtotalRow, groupRows });
      }

      // Sort siblings by configured measure
      const primary = pivotConfig.sortMeasure || labels[0];
      if (primary) {
        const dir = (pivotConfig.sortDir === 'asc') ? 1 : -1;
        items.sort((a, b) => (Number(a.subtotalRow[primary])||0) < (Number(b.subtotalRow[primary])||0) ? dir*-1 : (Number(a.subtotalRow[primary])||0) > (Number(b.subtotalRow[primary])||0) ? dir*1 : 0);
      }
      // Top-N within this level
      if (pivotConfig.topN && pivotConfig.topN.enabled && level === (pivotConfig.topN.level || 0)) {
        const by = pivotConfig.topN.measure || primary || labels[0];
        const dir = (pivotConfig.topN.dir === 'asc') ? 1 : -1;
        const n = Math.max(1, Math.min(100, Number(pivotConfig.topN.n)||10));
        items.sort((a,b) => (Number(a.subtotalRow[by])||0) < (Number(b.subtotalRow[by])||0) ? dir*-1 : (Number(a.subtotalRow[by])||0) > (Number(b.subtotalRow[by])||0) ? dir*1 : 0);
        items.splice(n);
      }
      // Rank and running on first/selected label among siblings
      if (pivotConfig.calcRank || pivotConfig.calcRunning) {
        const rankLabel = primary || labels[0];
        if (pivotConfig.calcRank) items.forEach((it, idx) => { it.subtotalRow[`${rankLabel} (Rank)`] = idx + 1; });
        if (pivotConfig.calcRunning) {
          let acc = 0;
          items.forEach((it) => { const v = Number(it.subtotalRow[rankLabel]) || 0; acc += v; it.subtotalRow[`${rankLabel} (Running)`] = acc; });
        }
      }
      // Emit rows in correct order (parent above/below children)
      for (const it of items) {
        if (pivotConfig.subtotalPosition === 'above' && level < pivotConfig.columns.length - 1) {
          rows.push(it.subtotalRow);
          buildGroups(it.groupRows, level + 1, { ...prefix, [col]: it.key }, computeAggs(arr));
        } else {
          if (level < pivotConfig.columns.length - 1) buildGroups(it.groupRows, level + 1, { ...prefix, [col]: it.key }, computeAggs(arr));
          rows.push(it.subtotalRow);
        }
      }
    };

    buildGroups(baseRows, 0, {}, null);

    if (rows.length > 0 && pivotConfig.showGrand !== false) {
      const grand = {};
      if (pivotConfig.rowLabelsMode === 'single') {
        grand['__row_label__'] = 'Grand Total';
        grand['Row Labels'] = 'Grand Total';
        pivotConfig.columns.forEach((c) => (grand[c] = ''));
      } else {
        pivotConfig.columns.forEach((c, i) => (grand[c] = i === 0 ? "Grand Total" : ""));
      }
      if (colAxis.length === 0) {
        for (const l of labels) grand[l] = grandTotals[l];
        for (const cl of calcLabels) grand[cl] = grandTotals[cl] ?? null;
        if (pivotConfig.calcPctTotal) for (const l of labels) grand[`${l} (% total)`] = 1;
      } else {
        // For each col key label include totals
        for (const colLabel of colKeyLabels) {
          const aggs = (colLabel === 'Grand Total') ? grandTotals : (() => {
            const parts = colLabel.split(' | ').map(s => s.split(': '));
            const match = (r) => parts.every(([c, v]) => String(r[c] ?? '') === v);
            return computeAggs(baseRows.filter(match));
          })();
          for (const l of labels) grand[`${colLabel} | ${l}`] = aggs[l];
          for (const cl of calcLabels) grand[`${colLabel} | ${cl}`] = aggs[cl] ?? null;
        }
      }
      grand._isGrandTotal = true;
      grand._groupKey = {};
      rows.push(grand);
    }

    const t1 = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    if (isDev) console.log(`[Table] Pivot computed in ${Math.round(t1 - t0)}ms (rows=${baseRows.length}, levels=${pivotConfig.columns.length}, labels=${labels.length}, colAxis=${colAxis.length})`);
    return rows;
  }, [isPivotView, pivotConfig, withDerivedAndBuckets, serverMode, serverAllRows, serverRowsWithDerivedAndBuckets, JSON.stringify(pivotCalcMeasures)]);

  // Persist pivot collapsed, calc measures, and bins per dataset signature
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.pivotCollapsed.${baseHeaders.join('|')}`;
    try {
      const s = localStorage.getItem(key);
      if (s) setPivotCollapsed(new Set(JSON.parse(s)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.pivotCollapsed.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(Array.from(pivotCollapsed))); } catch {}
  }, [pivotCollapsed, baseHeaders]);
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.pivotCalcMeasures.${baseHeaders.join('|')}`;
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const v = JSON.parse(s);
        if (Array.isArray(v)) setPivotCalcMeasures(v);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.pivotCalcMeasures.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(pivotCalcMeasures)); } catch {}
  }, [pivotCalcMeasures, baseHeaders]);
  useEffect(() => {
    if (initialViewAppliedRef.current) return;
    const key = `table.pivotBins.${baseHeaders.join('|')}`;
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const v = JSON.parse(s);
        if (v && typeof v === 'object') setPivotBins(v);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeaders.join(',')]);
  useEffect(() => {
    const key = `table.pivotBins.${baseHeaders.join('|')}`;
    try { localStorage.setItem(key, JSON.stringify(pivotBins)); } catch {}
  }, [pivotBins, baseHeaders]);

  // pagination (last step) — in serverMode, rows come from server
  const sourceRows = isPivotView ? pivotedData : (serverMode ? serverRowsWithDerived : sortedData);
  const effectiveTotal = isPivotView ? pivotedData.length : (serverMode ? (serverTotal || 0) : sourceRows.length);
  const totalPages = Math.max(1, Math.ceil((effectiveTotal || 0) / pageSize) || 1);
  const paginatedData = React.useMemo(() => {
    if (serverMode) return isPivotView ? pivotedData : serverRowsWithDerived;
    const start = (currentPage - 1) * pageSize;
    return sourceRows.slice(start, start + pageSize);
  }, [serverMode, isPivotView, serverRowsWithDerived, pivotedData, sourceRows, currentPage, pageSize]);

  const goToPage = (page) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

  // Server mode: fetch page from backend
  useEffect(() => {
    if (!serverMode) return;
    if (!exportContext || !exportContext.prompt || !exportContext.mode || !exportContext.model) return;
    const ctrl = new AbortController();
    const doFetch = async () => {
      try {
        setServerLoading(true);
        const body = {
          model: exportContext.model,
          mode: exportContext.mode,
          prompt: exportContext.prompt,
          page: currentPage,
          pageSize,
          sort: sortConfig,
          search: { query: searchQuery, mode: searchMode, caseSensitive: searchCaseSensitive, visibleOnly: searchVisibleOnly },
          // Send filters scaffold; server may ignore for now
          columnFilters: colFilters,
          valueFilters,
          advancedFilters: { rules: advFilters, combine: advCombine },
          tableOpsMode,
          pushDownDb,
          baseSql: exportContext.baseSql,
          columnTypes: exportContext.columnTypes,
          searchColumns: headers,
        };
        const res = await fetch('/api/table/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setServerRows(Array.isArray(json.rows) ? json.rows : []);
        setServerTotal(Number(json.total) || 0);
        setServerCached(typeof json.cached === 'boolean' ? json.cached : null);
      } catch (e) {
        if (e.name !== 'AbortError') console.error('serverMode fetch failed', e);
      } finally {
        setServerLoading(false);
      }
    };
    doFetch();
    return () => ctrl.abort();
  }, [serverMode, exportContext && exportContext.prompt, exportContext && exportContext.mode, exportContext && exportContext.model, currentPage, pageSize, JSON.stringify(sortConfig), searchQuery, searchMode, searchCaseSensitive, searchVisibleOnly, JSON.stringify(colFilters), JSON.stringify(valueFilters), JSON.stringify(advFilters), advCombine]);

  // Reset page when toggling serverMode or changing key filters/search
  useEffect(() => {
    setCurrentPage(1);
  }, [serverMode]);

  // Server mode: fetch full, un-capped filtered/sorted rows for charts when chart becomes visible
  useEffect(() => {
    if (!serverMode || !chartVisible) return;
    if (!exportContext || !exportContext.prompt || !exportContext.mode || !exportContext.model) return;
    const ctrl = new AbortController();
    const fetchAll = async () => {
      try {
        setServerAllLoading(true);
        const body = {
          model: exportContext.model,
          mode: exportContext.mode,
          prompt: exportContext.prompt,
          all: true,
          sort: sortConfig,
          search: { query: searchQuery, mode: searchMode, caseSensitive: searchCaseSensitive, visibleOnly: searchVisibleOnly },
          columnFilters: colFilters,
          valueFilters,
          advancedFilters: { rules: advFilters, combine: advCombine },
          tableOpsMode,
          pushDownDb,
          baseSql: exportContext.baseSql,
          columnTypes: exportContext.columnTypes,
          searchColumns: headers,
        };
        const res = await fetch('/api/table/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setServerAllRows(Array.isArray(json.rows) ? json.rows : []);
      } catch (e) {
        if (e.name !== 'AbortError') console.error('serverMode full fetch failed', e);
      } finally {
        setServerAllLoading(false);
      }
    };
    fetchAll();
    return () => ctrl.abort();
  }, [serverMode, chartVisible, exportContext && exportContext.prompt, exportContext && exportContext.mode, exportContext && exportContext.model, JSON.stringify(sortConfig), searchQuery, searchMode, searchCaseSensitive, searchVisibleOnly, JSON.stringify(colFilters), JSON.stringify(valueFilters), JSON.stringify(advFilters), advCombine]);

  // Server mode: when maximizing (virtualized), fetch all rows to honor virtualization over full set
  useEffect(() => {
    if (!serverMode || !isVirtualized || isPivotView) return;
    if (!exportContext || !exportContext.prompt || !exportContext.mode || !exportContext.model) return;
    if (serverAllRows && Array.isArray(serverAllRows)) return; // already have full set
    const ctrl = new AbortController();
    const fetchAllForVirtual = async () => {
      try {
        setServerAllLoading(true);
        const body = {
          model: exportContext.model,
          mode: exportContext.mode,
          prompt: exportContext.prompt,
          all: true,
          sort: sortConfig,
          search: { query: searchQuery, mode: searchMode, caseSensitive: searchCaseSensitive, visibleOnly: searchVisibleOnly },
          columnFilters: colFilters,
          valueFilters,
          advancedFilters: { rules: advFilters, combine: advCombine },
          tableOpsMode,
          pushDownDb,
          baseSql: exportContext.baseSql,
          columnTypes: exportContext.columnTypes,
          searchColumns: headers,
        };
        const res = await fetch('/api/table/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setServerAllRows(Array.isArray(json.rows) ? json.rows : []);
      } catch (e) {
        if (e.name !== 'AbortError') console.error('serverMode full fetch (virtual) failed', e);
      } finally {
        setServerAllLoading(false);
      }
    };
    fetchAllForVirtual();
    return () => ctrl.abort();
  }, [serverMode, isVirtualized, isPivotView, exportContext && exportContext.prompt, exportContext && exportContext.mode, exportContext && exportContext.model, JSON.stringify(sortConfig), searchQuery, searchMode, searchCaseSensitive, searchVisibleOnly, JSON.stringify(colFilters), JSON.stringify(valueFilters), JSON.stringify(advFilters), advCombine]);

  const renderSortIndicator = (header) => {
    const index = sortConfig.findIndex((c) => c.key === header);
    if (index === -1) return null;
    const direction = sortConfig[index].direction === "asc" ? "▲" : "▼";
    return ` ${direction}${sortConfig.length > 1 ? ` (${index + 1})` : ""}`;
  };

  const exportData = (format) => {
    // If exportContext is available and format is CSV, request a full uncapped server-side export
    if (format === 'csv' && exportContext && exportContext.prompt && exportContext.mode && exportContext.model) {
      try {
        const payload = {
          prompt: exportContext.prompt,
          mode: exportContext.mode,
          model: exportContext.model,
          stream: true,
        };
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/download-csv-query';
        form.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        document.body.appendChild(form);
        // Use fetch + blob fallback if needed; for now, submit form to trigger file download.
        form.submit();
        setTimeout(() => form.remove(), 1000);
        return;
      } catch (e) { console.error('Server CSV export failed, falling back to client export', e); }
    }
    const cols = isPivotView
      ? (() => {
          const measures = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
          const funcs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
          const labels = [];
          for (const m of measures) for (const f of funcs) labels.push(`${m} (${f})`);
          const calcUser = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
          const calc = [];
          if (pivotConfig.calcPctTotal) calc.push(...labels.map(l => `${l} (% total)`));
          if (pivotConfig.calcPctParent) calc.push(...labels.map(l => `${l} (% parent)`));
          if (pivotConfig.calcRank) calc.push(`${labels[0]} (Rank)`);
          if (pivotConfig.calcRunning) calc.push(`${labels[0]} (Running)`);
          const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
          if (colAxis.length === 0) {
            const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
            return [...rowCols, ...labels, ...calc, ...calcUser];
          }
          const perCol = []; const rows = pivotedData;
          const colLabels = (() => {
            const set = new Set();
            rows.forEach(r => Object.keys(r).forEach(k => { if (k.includes(' | ')) set.add(k.split(' | ')[0]); }));
            return Array.from(set).sort((a,b) => a.localeCompare(b));
          })();
          const baseKeys = [...labels, ...calcUser];
          colLabels.forEach(c => { baseKeys.forEach(m => perCol.push(`${c} | ${m}`)); if (pivotConfig.percentRow) baseKeys.forEach(m => perCol.push(`${c} | ${m} (% row)`)); });
          // Include time-intel columns if present
          const hasTimeIntel = rows.some(r => Object.keys(r).some(k => /(MoM%|YoY%|YTD|MTD)$/.test(k)));
          if (hasTimeIntel) {
            const extra = [];
            rows.forEach(r => Object.keys(r).forEach(k => { if (/(MoM%|YoY%|YTD|MTD)$/.test(k)) extra.push(k); }));
            const uniq = Array.from(new Set(extra));
            // ensure we include only those whose left-part exists
            uniq.forEach(k => { if (!perCol.includes(k)) perCol.push(k); });
          }
          const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
          return [...rowCols, ...perCol];
        })()
      : displayColumns;
    const rows = isPivotView ? pivotedData : sortedData;

    if (format === 'json') {
      if (exportContext && exportContext.prompt && exportContext.mode && exportContext.model) {
        try {
          const payload = { prompt: exportContext.prompt, mode: exportContext.mode, model: exportContext.model, stream: true };
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/api/download-json-query';
          form.style.display = 'none';
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'payload';
          input.value = JSON.stringify(payload);
          form.appendChild(input);
          document.body.appendChild(form);
          form.submit();
          setTimeout(() => form.remove(), 1000);
          return;
        } catch (e) { console.error('Server JSON export failed, falling back to client export', e); }
      }
      const payload = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'table.json'; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [cols.map(escape).join(',')]
      .concat(rows.map(r => cols.map(c => escape(r[c])).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'table.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const linkButtonStyle = {
    background: "none",
    border: "none",
    color: "#0e639c",
    cursor: "pointer",
    padding: "0 6px",
    textDecoration: "underline",
    fontSize: `${fontSize}px`,
  };

  // XLSX export with formats using exceljs
  const exportXlsx = async () => {
    try {
      if (exportContext && exportContext.prompt && exportContext.mode && exportContext.model) {
        const payload = { prompt: exportContext.prompt, mode: exportContext.mode, model: exportContext.model, stream: true };
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/download-excel-query';
        form.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        setTimeout(() => form.remove(), 1000);
        return;
      }
      const cols = isPivotView
        ? (() => {
            const measures = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
            const funcs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
            const labels = [];
            for (const m of measures) for (const f of funcs) labels.push(`${m} (${f})`);
            const calcUser = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
            const calc = [];
            if (pivotConfig.calcPctTotal) calc.push(...labels.map(l => `${l} (% total)`));
            if (pivotConfig.calcPctParent) calc.push(...labels.map(l => `${l} (% parent)`));
            if (pivotConfig.calcRank) calc.push(`${labels[0]} (Rank)`);
            if (pivotConfig.calcRunning) calc.push(`${labels[0]} (Running)`);
            const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
            if (colAxis.length === 0) {
              const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
              return [...rowCols, ...labels, ...calc, ...calcUser];
            }
            const perCol = []; const rows = pivotedData;
            const colLabels = (() => {
              const set = new Set();
              rows.forEach(r => Object.keys(r).forEach(k => { if (k.includes(' | ')) set.add(k.split(' | ')[0]); }));
              return Array.from(set).sort((a,b) => a.localeCompare(b));
            })();
            const baseKeys = [...labels, ...calcUser];
            colLabels.forEach(c => { baseKeys.forEach(m => perCol.push(`${c} | ${m}`)); if (pivotConfig.percentRow) baseKeys.forEach(m => perCol.push(`${c} | ${m} (% row)`)); });
            const hasTimeIntel = rows.some(r => Object.keys(r).some(k => /(MoM%|YoY%|YTD|MTD)$/.test(k)));
            if (hasTimeIntel) {
              const extra = [];
              rows.forEach(r => Object.keys(r).forEach(k => { if (/(MoM%|YoY%|YTD|MTD)$/.test(k)) extra.push(k); }));
              const uniq = Array.from(new Set(extra));
              uniq.forEach(k => { if (!perCol.includes(k)) perCol.push(k); });
            }
            const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
            return [...rowCols, ...perCol];
          })()
        : displayColumns;
      const rows = isPivotView ? pivotedData : sortedData;
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Table');
      ws.addRow(cols);
      ws.getRow(1).font = { bold: true };
      const fmtFor = (col) => {
        const f = colFormats[col];
        if (!f || f.type === 'default') return null;
        const p = typeof f.precision === 'number' ? f.precision : 2;
        switch (f.type) {
          case 'number': return `0.${'0'.repeat(p)}`;
          case 'thousands': return `#,##0${p ? '.' + '0'.repeat(p) : ''}`;
          case 'percent': return `0.${'0'.repeat(p)}%`;
          case 'currency': return `"${(f.currency||'USD')}" #,##0${p ? '.' + '0'.repeat(p) : ''}`;
          case 'date': return 'yyyy-mm-dd';
          case 'datetime': return 'yyyy-mm-dd hh:mm';
          default: return null;
        }
      };
      rows.forEach(r => {
        const row = ws.addRow(cols.map(c => r[c]));
        cols.forEach((c, i) => {
          const cell = row.getCell(i+1);
          const fmt = fmtFor(c);
          if (fmt) cell.numFmt = fmt;
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'table.xlsx');
    } catch (e) { console.error('XLSX export failed', e); }
  };

  // PDF export using jsPDF + autoTable
  const exportPdf = async () => {
    try {
      if (exportContext && exportContext.prompt && exportContext.mode && exportContext.model) {
        const payload = { prompt: exportContext.prompt, mode: exportContext.mode, model: exportContext.model, stream: true };
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/download-pdf-query';
        form.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'payload';
        input.value = JSON.stringify(payload);
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        setTimeout(() => form.remove(), 1000);
        return;
      }
      const cols = isPivotView
        ? (() => {
            const measures = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
            const funcs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
            const labels = [];
            for (const m of measures) for (const f of funcs) labels.push(`${m} (${f})`);
            const calcUser = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
            const calc = [];
            if (pivotConfig.calcPctTotal) calc.push(...labels.map(l => `${l} (% total)`));
            if (pivotConfig.calcPctParent) calc.push(...labels.map(l => `${l} (% parent)`));
            if (pivotConfig.calcRank) calc.push(`${labels[0]} (Rank)`);
            if (pivotConfig.calcRunning) calc.push(`${labels[0]} (Running)`);
            const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
            if (colAxis.length === 0) return [...pivotConfig.columns, ...labels, ...calc, ...calcUser];
            const perCol = []; const rows = pivotedData;
            const colLabels = (() => {
              const set = new Set();
              rows.forEach(r => Object.keys(r).forEach(k => { if (k.includes(' | ')) set.add(k.split(' | ')[0]); }));
              return Array.from(set).sort((a,b) => a.localeCompare(b));
            })();
            const baseKeys = [...labels, ...calcUser];
            colLabels.forEach(c => { baseKeys.forEach(m => perCol.push(`${c} | ${m}`)); if (pivotConfig.percentRow) baseKeys.forEach(m => perCol.push(`${c} | ${m} (% row)`)); });
            const hasTimeIntel = rows.some(r => Object.keys(r).some(k => /(MoM%|YoY%|YTD|MTD)$/.test(k)));
            if (hasTimeIntel) {
              const extra = [];
              rows.forEach(r => Object.keys(r).forEach(k => { if (/(MoM%|YoY%|YTD|MTD)$/.test(k)) extra.push(k); }));
              const uniq = Array.from(new Set(extra));
              uniq.forEach(k => { if (!perCol.includes(k)) perCol.push(k); });
            }
            return [...pivotConfig.columns, ...perCol];
          })()
        : displayColumns;
      const rows = isPivotView ? pivotedData : sortedData;
      const jsPDFmod = await import('jspdf');
      const autoTable = await import('jspdf-autotable');
      const doc = new jsPDFmod.jsPDF({ orientation: 'landscape' });
      autoTable.default(doc, { head: [cols], body: rows.map(r => cols.map(c => r[c])), styles: { fontSize: 8 }, headStyles: { fillColor: [14,99,156] } });
      doc.save('table.pdf');
    } catch (e) { console.error('PDF export failed', e); }
  };

  // Clipboard copy: current page and selected rows
  const copyRowsToClipboard = async (rows, colsOverride) => {
    const cols = colsOverride || (isPivotView ? [...pivotConfig.columns, `${pivotConfig.aggColumn} (${pivotConfig.aggFunc})`] : displayColumns);
    const lines = [cols.join('\t')].concat(rows.map(r => cols.map(c => String(r[c] ?? '')).join('\t')));
    try { await navigator.clipboard.writeText(lines.join('\n')); } catch (e) { console.error('Clipboard copy failed', e); }
  };

  // Value formatter
  const formatValue = (col, val) => {
    if (val == null) return '';
    const f = colFormats[col];
    if (!f || f.type === 'default') return val;
    const prec = typeof f.precision === 'number' ? f.precision : 2;
    if (f.type === 'date' || f.type === 'datetime') {
      const d = isValidDate(val) ? new Date(val) : null;
      if (!d) return val;
      return f.type === 'date' ? d.toLocaleDateString() : d.toLocaleString();
    }
    const num = Number(val);
    if (!isFinite(num)) return val;
    if (f.type === 'number') return Number(num.toFixed(prec));
    if (f.type === 'thousands') return new Intl.NumberFormat(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
    if (f.type === 'percent') return new Intl.NumberFormat(undefined, { style: 'percent', minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
    if (f.type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currency || 'USD', minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
    return val;
  };

  // Stats for numeric columns (for scales/data bars)
  const colStats = React.useMemo(() => {
    const stats = {};
    const rows = serverMode ? serverRowsWithDerived : withDerived;
    headers.forEach((h) => {
      const nums = rows.map(r => Number(r[h])).filter((v) => isFinite(v));
      if (nums.length) {
        let min = nums[0], max = nums[0];
        for (const n of nums) { if (n < min) min = n; if (n > max) max = n; }
        stats[h] = { min, max };
      }
    });
    return stats;
  }, [headers, withDerived, serverMode, serverRowsWithDerived]);

  // Conditional formatting helpers
  const needsValue = (op) => !["isEmpty", "notEmpty"].includes(op);
  const evaluateRule = (rule, value) => {
    if (!rule?.enabled) return false;
    const v = value == null ? '' : value;
    if (numericCols.has(rule.column)) {
      const num = Number(v);
      const cmp = Number(rule.value);
      if (!isFinite(num) || !isFinite(cmp)) return false;
      switch (rule.operator) {
        case '>': return num > cmp;
        case '>=': return num >= cmp;
        case '<': return num < cmp;
        case '<=': return num <= cmp;
        case '=': return num === cmp;
        case '!=': return num !== cmp;
        case 'isEmpty': return v === '';
        case 'notEmpty': return v !== '';
        default: return false;
      }
    }
    const s = String(v).toLowerCase();
    const t = String(rule.value ?? '').toLowerCase();
    switch (rule.operator) {
      case 'contains': return s.includes(t);
      case 'startsWith': return s.startsWith(t);
      case 'endsWith': return s.endsWith(t);
      case 'equals': return s === t;
      case 'notEquals': return s !== t;
      case 'isEmpty': return s.length === 0;
      case 'notEmpty': return s.length > 0;
      default: return false;
    }
  };
  const hexToRgb = (hex) => {
    if (!hex) return [0,0,0];
    const h = hex.replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255;
    return [r,g,b];
  };
  const rgbToHex = ([r,g,b]) => '#' + [r,g,b].map(x => Math.max(0, Math.min(255, x))|0).map(x => x.toString(16).padStart(2,'0')).join('');
  const lerp = (a,b,t) => a + (b-a)*t;
  const lerpColor = (c1, c2, t) => {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return rgbToHex([lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]);
  };
  const getConditionalStyle = (col, value) => {
    if (!condRules || condRules.length === 0) return null;
    let style = null;
    for (const r of condRules) {
      if (r.column !== col) continue;
      // Scales & data bars (numeric only)
      if (r.type === 'scale2' || r.type === 'scale3') {
        const stat = colStats[col];
        const num = Number(value);
        if (!stat || !isFinite(num)) continue;
        const range = stat.max - stat.min || 1;
        const t = Math.max(0, Math.min(1, (num - stat.min) / range));
        const color = r.type === 'scale2'
          ? lerpColor(r.minColor || '#2e7d32', r.maxColor || '#c62828', t)
          : (t <= 0.5
            ? lerpColor(r.minColor || '#2e7d32', r.midColor || '#f9a825', t*2)
            : lerpColor(r.midColor || '#f9a825', r.maxColor || '#c62828', (t-0.5)*2));
        style = { ...(style || {}), backgroundColor: color };
        continue;
      }
      if (r.type === 'databar') {
        const stat = colStats[col];
        const num = Number(value);
        if (!stat || !isFinite(num)) continue;
        const range = stat.max - stat.min || 1;
        const t = Math.max(0, Math.min(1, (num - stat.min) / range));
        const pct = Math.round(t * 100);
        const color = r.barColor || '#0e639c';
        style = { ...(style || {}), backgroundImage: `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)` };
        continue;
      }
      if (evaluateRule(r, value)) {
        style = {
          ...(style || {}),
          ...(r.bgColor ? { backgroundColor: r.bgColor } : {}),
          ...(r.textColor ? { color: r.textColor } : {}),
        };
      }
    }
    return style;
  };

  // Fullscreen/Maximize behavior (lock body scroll and adjust page size)
  useEffect(() => {
    try {
      if (isMaximized) {
        // Save current layout and expand rows per page for easier scanning
        prevLayoutRef.current.pageSize = pageSize;
        if (!isVirtualized && pageSize !== 100) setPageSize(100);
        document.body.style.overflow = 'hidden';
      } else {
        // Restore previous rows per page
        const prevPageSize = prevLayoutRef.current.pageSize;
        if (typeof prevPageSize === 'number' && prevPageSize > 0 && pageSize !== prevPageSize) {
          setPageSize(prevPageSize);
        } else if (!prevPageSize) {
          setPageSize(initialPageSize);
        }
        document.body.style.overflow = '';
      }
    } catch {}
    return () => { try { document.body.style.overflow = ''; } catch {} };
  }, [isMaximized, isVirtualized]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isMaximized) setIsMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMaximized]);

  const containerStyle = isMaximized
    ? { position: 'fixed', inset: 0, zIndex: 1000, background: '#0b0b0b', padding: 10, overflow: 'auto', fontSize: `${fontSize}px` }
    : { position: 'relative', fontSize: `${fontSize}px` };
  const basePerm = buttonPermissions || {
    searchAndSorting: true,
    columns: true,
    pivot: true,
    derived: true,
    formatting: true,
    filters: true,
    advanced: true,
    headerMenu: true,
    chart: true,
    pagination: true,
    export: true,
  };
  const perm = dashboardMode ? { ...basePerm, export: false, pagination: true } : basePerm;
  const disabledStyle = { pointerEvents: 'none', opacity: 0.6, cursor: 'not-allowed' };
  const allDisabled = !!buttonsDisabled;
  const containerControlsDisabled = allDisabled && !dashboardMode;
  const paginationDisabled = !dashboardMode && (!perm.pagination || allDisabled);
  const headerMenuDisabled = (!perm.headerMenu) || (allDisabled && !dashboardMode);


  const collectViewState = () => ({
    visibleColumns,
    sortConfig,
    colFilters,
    valueFilters,
    advFilters,
    advCombine,
    derivedCols,
    pivotConfig,
    pivotCalcMeasures,
    pivotBins,
    pivotCollapsed: Array.from(pivotCollapsed || []),
    colFormats,
    freezeCount,
    columnOrder,
    condRules,
    rowLabelsMode: pivotConfig && pivotConfig.rowLabelsMode,
    exportContext,
    tableOpsMode,
    pushDownDb,
    searchQuery,
    searchMode,
    searchCaseSensitive,
    searchVisibleOnly,
    pageSize,
    fontSize,
    isPivotView,
    serverMode,
    headers,
    totalRows,
  });

  // Helper to save current view to backend (Oracle)
  const saveCurrentView = async () => {
    try {
      const name = window.prompt('Enter a name for this view');
      if (!name) return;
      const datasetSig = baseHeaders.join('|');
      const viewState = collectViewState();
      const res = await fetch('/api/table/save_view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewName: name, datasetSig, viewState, owner: '' }),
      });
      let payload = null;
      const ct = res.headers.get('content-type') || '';
      try {
        payload = ct.includes('application/json') ? await res.json() : await res.text();
      } catch (e) {
        payload = null;
      }
      if (!res.ok) {
        const msg = (payload && payload.error) ? payload.error : (typeof payload === 'string' ? payload : `HTTP ${res.status}`);
        throw new Error(msg);
      }
      alert('View saved');
    } catch (e) {
      console.error('Save view failed', e);
      alert('Failed to save view. See console for details.');
    }
  };

  const pinCurrentView = async () => {
    if (isPinning) return;
    try {
      setIsPinning(true);
      const datasetSig = baseHeaders.join('|');
      const viewState = collectViewState();
      const schema = {
        headers,
        columnTypes: exportContext && exportContext.columnTypes ? exportContext.columnTypes : (initialSchema && initialSchema.columnTypes) || null,
      };
      const options = {
        initialPageSize: pageSize,
        initialFontSize: fontSize,
        buttonPermissions: perm,
        perfOptions,
        previewOptions,
        exportContext,
        totalRows,
        serverMode,
        tableOpsMode,
        pushDownDb,
        virtualizeOnMaximize: true,
        virtualRowHeight,
        initialSchema: schema,
      };
      const payload = {
        datasetSig,
        state: viewState,
        options,
        schema,
        query: {
          exportContext,
          tableOpsMode,
          pushDownDb,
        },
      };
      const res = await fetch('/api/table/pin_view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let resp = null;
      const ct = res.headers.get('content-type') || '';
      try {
        resp = ct.includes('application/json') ? await res.json() : await res.text();
      } catch (e) {
        resp = null;
      }
      if (!res.ok || !resp || !resp.pinId) {
        const msg = resp && resp.error ? resp.error : (typeof resp === 'string' ? resp : `HTTP ${res.status}`);
        throw new Error(msg);
      }
      if (typeof window !== 'undefined') {
        const base = `${window.location.origin}${window.location.pathname}`;
        const nextUrl = new URL(base);
        nextUrl.searchParams.set('page', 'pinned-table');
        nextUrl.searchParams.set('pinnedId', resp.pinId);
        window.open(nextUrl.toString(), '_blank', 'noopener');
      }
    } catch (e) {
      console.error('Pin view failed', e);
      alert('Failed to pin view. See console for details.');
    } finally {
      setIsPinning(false);
    }
  };

  // Load views UI
  const [showLoadPicker, setShowLoadPicker] = useState(false);
  const [savedViews, setSavedViews] = useState([]);
  const fetchSavedViews = async () => {
    try {
      const qs = new URLSearchParams({ datasetSig: baseHeaders.join('|') });
      const res = await fetch(`/api/table/saved_views?${qs.toString()}`);
      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw new Error((payload && payload.error) || (typeof payload === 'string' ? payload : `HTTP ${res.status}`));
      const arr = (payload && payload.views) || [];
      setSavedViews(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error('Fetch saved views failed', e);
      setSavedViews([]);
    }
  };

  const applyViewState = (st) => {
    try {
      if (!st || typeof st !== 'object') return;
      if (st.visibleColumns) setVisibleColumns(st.visibleColumns);
      if (st.sortConfig) setSortConfig(st.sortConfig);
      if (st.colFilters) setColFilters(st.colFilters);
      if (st.valueFilters) setValueFilters(st.valueFilters);
      if (st.advFilters) setAdvFilters(st.advFilters);
      if (st.advCombine) setAdvCombine(st.advCombine);
      if (st.derivedCols) setDerivedCols(st.derivedCols);
      if (st.pivotConfig) setPivotConfig(prev => ({ ...prev, ...st.pivotConfig }));
      if (st.colFormats) setColFormats(st.colFormats);
      if (typeof st.freezeCount === 'number') setFreezeCount(st.freezeCount);
      if (st.columnOrder) setColumnOrder(st.columnOrder);
      if (st.condRules) setCondRules(st.condRules);
      setCurrentPage(1);
    } catch (e) { console.error('Apply view failed', e); }
  };

  return (
    <div className={`table-container ${containerControlsDisabled ? 'disable-buttons' : ''}`} style={containerStyle} aria-disabled={containerControlsDisabled}>
      {(
        <style>
          {`
          .table-container.disable-buttons button {
            pointer-events: none !important;
            opacity: 0.6 !important;
            cursor: not-allowed !important;
          }
          /* Thin, minimal range style for toolbar font slider (scoped + higher specificity) */
          .table-container .veda-range { -webkit-appearance: none !important; appearance: none !important; height: 1px !important; background: #555 !important; border-radius: 1px !important; outline: none !important; -webkit-tap-highlight-color: transparent; width: auto; }
          .table-container .veda-range::-webkit-slider-runnable-track { height: 1px !important; background: #555 !important; border-radius: 1px !important; }
          /* '+' style thumb: small square with cross using layered gradients */
          .table-container .veda-range::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 8px !important; height: 8px !important; border-radius: 2px !important;
            background-image:
              linear-gradient(to right, transparent calc(50% - 0.5px), #0e639c calc(50% - 0.5px), #0e639c calc(50% + 0.5px), transparent calc(50% + 0.5px)),
              linear-gradient(to bottom, transparent calc(50% - 0.5px), #0e639c calc(50% - 0.5px), #0e639c calc(50% + 0.5px), transparent calc(50% + 0.5px));
            background-color: #111;
            border: 1px solid #1e5b86 !important;
            cursor: pointer;
            margin-top: -4px !important;
            transition: transform 120ms ease, opacity 120ms ease;
          }
          .table-container .veda-range::-moz-range-thumb {
            width: 8px !important; height: 8px !important; border-radius: 2px !important;
            background-color: #111;
            border: 1px solid #1e5b86 !important;
            cursor: pointer;
            transition: transform 120ms ease, opacity 120ms ease;
            /* Simulate '+' using box-shadow for Firefox (gradients on thumb not consistently supported) */
            box-shadow: inset 0 0 0 1px transparent,
                        inset 0 -1px 0 0 #0e639c,
                        inset 0 1px 0 0 #0e639c,
                        inset -1px 0 0 0 #0e639c,
                        inset 1px 0 0 0 #0e639c;
          }
          .table-container .veda-range::-webkit-slider-thumb:active { transform: scale(1.15); }
          .table-container .veda-range::-moz-range-thumb:active { transform: scale(1.15); }
          .table-container .veda-range::-moz-range-track { height: 1px !important; background: #555 !important; border-radius: 1px !important; }
          .table-container .veda-range::-ms-track { height: 1px; background: transparent; border-color: transparent; color: transparent; }
          .table-container .veda-range::-ms-fill-lower { background: #555; border-radius: 1px; }
          .table-container .veda-range::-ms-fill-upper { background: #555; border-radius: 1px; }
          `}
        </style>
      )}
      {/* Excel-like Toolbar with icon buttons */}
      {!dashboardMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, border: '1px solid #333', borderRadius: 6, background: '#1f1f1f', marginBottom: 8, flexWrap: 'wrap' }}>
        {/* Save View */}
        <ToolbarButton
          icon={ICON_SAVE}
          alt="Save View"
          title="Save current view"
          active={false}
          disabled={allDisabled}
          onClick={saveCurrentView}
        />
        {/* Pin View */}
        <ToolbarButton
          icon={ICON_PIN}
          alt="Pin View"
          title={isPinning ? 'Saving current view…' : 'Pin current view'}
          active={!!isPinning}
          disabled={allDisabled || isPinning}
          onClick={pinCurrentView}
        />
        {/* Load View */}
        <ToolbarButton
          icon={ICON_LOAD}
          alt="Load View"
          title="Load saved view"
          active={!!showLoadPicker}
          disabled={allDisabled}
          onClick={() => { setShowLoadPicker(v => !v); if (!showLoadPicker) fetchSavedViews(); }}
        />
        {/* Column Picker */}
        <ToolbarButton
          icon={ICON_COLUMNS}
          alt="Columns"
          title="Show/Hide Columns"
          active={!!showColumnPicker}
          disabled={allDisabled || !perm.columns}
          onClick={(e) => { setShowColumnPicker((p) => !p); setAnchorCols(getRightAlignedAnchor(e, 260)); }}
        />
        {/* Filters */}
        <ToolbarButton
          icon={ICON_FILTERS}
          alt="Filters"
          title="Column Filters"
          active={!!showFilterPicker}
          disabled={allDisabled || !perm.filters}
          onClick={(e) => { setShowFilterPicker((p) => !p); setAnchorFilters(getRightAlignedAnchor(e, 560)); }}
        />
        {/* Advanced Filters */}
        <ToolbarButton
          icon={ICON_ADVANCED}
          alt="Advanced"
          title="Advanced Filters"
          active={!!showAdvancedPicker}
          disabled={allDisabled || !perm.advanced}
          onClick={(e) => { setShowAdvancedPicker((p) => !p); setAnchorAdvanced(getRightAlignedAnchor(e, 640)); }}
        />
        {/* Pivot Options */}
        <ToolbarButton
          icon={ICON_PIVOT}
          alt="Pivot"
          title="Pivot Options"
          active={!!showPivotPicker}
          disabled={allDisabled || !perm.pivot}
          onClick={(e) => { setShowPivotPicker((p) => !p); setAnchorPivot(getRightAlignedAnchor(e, 560)); }}
        />
        {/* Pivot Toggle (quick switch) */}
        <ToolbarButton
          icon={isPivotView ? ICON_RESTORE : ICON_PIVOT}
          alt={isPivotView ? 'Normal View' : 'Pivot View'}
          title={isPivotView ? 'Switch to Normal View' : 'Switch to Pivot View'}
          active={!!isPivotView}
          disabled={allDisabled || !perm.pivot}
          onClick={() => setIsPivotView((v) => !v)}
        />
        {/* Derived Columns */}
        <ToolbarButton
          icon={ICON_DERIVED}
          alt="Derived"
          title="Derived Columns"
          active={!!showDerivedPicker}
          disabled={allDisabled || !perm.derived}
          onClick={(e) => { setShowDerivedPicker((p) => !p); setAnchorDerived(getRightAlignedAnchor(e, 520)); }}
        />
        {/* Conditional Formatting */}
        <ToolbarButton
          icon={ICON_COND_FORMAT}
          alt="Conditional Format"
          title="Conditional Formatting"
          active={!!showFormatPicker}
          disabled={allDisabled || !perm.formatting}
          onClick={(e) => { setShowFormatPicker((p) => !p); setAnchorCondFmt(getRightAlignedAnchor(e, 420)); }}
        />
        {/* Number/Date Formats */}
        <ToolbarButton
          icon={ICON_FORMATS}
          alt="Formats"
          title="Column Formats"
          active={!!showFormatsPanel}
          onClick={(e) => { setShowFormatsPanel((p) => !p); setAnchorFormats(getRightAlignedAnchor(e, 560)); }}
        />
        {/* Chart Config */}
        <ToolbarButton
          icon={ICON_CHART}
          alt="Chart Options"
          title="Chart Options"
          active={!!chartPickerOpen}
          disabled={allDisabled || !perm.chart || isPivotView}
          onClick={() => setChartPickerOpen((o) => !o)}
        />
        {/* Show/Hide Chart */}
        <ToolbarButton
          icon={ICON_CHART_TOGGLE}
          alt="Toggle Chart"
          title={chartVisible ? 'Hide Chart' : 'Show Chart'}
          active={!!chartVisible}
          disabled={allDisabled || !perm.chart || isPivotView}
          onClick={() => setChartVisible((v) => !v)}
        />
        {/* Clear Sorting */}
        <ToolbarButton
          icon={ICON_CLEAR_SORT}
          alt="Clear Sort"
          title="Clear Sorting"
          active={false}
          disabled={allDisabled || !perm.searchAndSorting || sortConfig.length === 0}
          onClick={() => setSortConfig([])}
        />
        {/* Jump Top / Bottom (virtualized only) */}
        {isVirtualized && !isPivotView && (
          <>
            <ToolbarButton
              icon={ICON_TOP}
              alt="Top"
              title="Jump to Top"
              onClick={() => { try { vlistRef.current && vlistRef.current.scrollToItem(0, 'start'); } catch {} }}
            />
            <ToolbarButton
              icon={ICON_BOTTOM}
              alt="Bottom"
              title="Jump to Bottom"
              onClick={() => { try { vlistRef.current && vlistRef.current.scrollToItem(sortedData.length - 1, 'end'); } catch {} }}
            />
          </>
        )}
        {/* Maximize / Restore */}
        <ToolbarButton
          icon={isMaximized ? ICON_RESTORE : ICON_MAXIMIZE}
          alt={isMaximized ? 'Restore' : 'Maximize'}
          title={isMaximized ? 'Restore view (Esc)' : 'Maximize view'}
          active={!!isMaximized}
          disabled={allDisabled || !perm.searchAndSorting}
          onClick={() => setIsMaximized(m => { const next = !m; if (next) { try { onMaximize && onMaximize(); } catch {} } return next; })}
        />

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: '#333', margin: '0 4px' }} />

        {/* Search + options */}
        <input
          type="text"
          placeholder="Search all columns..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          style={{ flex: 1, minWidth: 180, maxWidth: 360, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#1e1e1e', color: '#d4d4d4' }}
        />
        <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)} title="Search mode" style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', fontSize: `${fontSize}px` }}>
          <option value="substring">contains</option>
          <option value="exact">exact</option>
          <option value="regex">regex</option>
        </select>
        <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Case sensitive search">
          <input type="checkbox" checked={searchCaseSensitive} onChange={(e) => setSearchCaseSensitive(e.target.checked)} /> Aa
        </label>
        <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Search only visible columns">
          <input type="checkbox" checked={searchVisibleOnly} onChange={(e) => setSearchVisibleOnly(e.target.checked)} /> Visible only
        </label>

        {/* Font size slider (thin, Excel-like) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Font size">
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(10, Math.min(24, (Number(s)||11) - 1)))}
            style={{ width: 16, height: 16, lineHeight: '16px', textAlign: 'center', border: 'none', background: 'transparent', color: '#d4d4d4', padding: 0, cursor: 'pointer', fontSize: 12 }}
            aria-label="Decrease font"
          >
            –
          </button>
          <input
            type="range"
            min="10"
            max="24"
            step="1"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="veda-range"
            style={{ width: 90, verticalAlign: 'middle' }}
            aria-label="Font size"
          />
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(10, Math.min(24, (Number(s)||11) + 1)))}
            style={{ width: 16, height: 16, lineHeight: '16px', textAlign: 'center', border: 'none', background: 'transparent', color: '#d4d4d4', padding: 0, cursor: 'pointer', fontSize: 12 }}
            aria-label="Increase font"
          >
            +
          </button>
        </div>

        {/* Freeze columns */}
        <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Freeze left columns">
          Freeze
          <input type="number" min="0" max={displayColumns.length} value={freezeCount} onChange={(e) => setFreezeCount(Math.max(0, Math.min(displayColumns.length, Number(e.target.value))))} style={{ width: 56, marginLeft: 6, padding: '2px', background: '#1e1e1e', border: '1px solid #444', color: '#d4d4d4', borderRadius: 4 }} />
        </label>
        </div>
      )}
      {/* Load view picker */}
      {showLoadPicker && (
        <div style={{ position: 'fixed', top: 64, right: 10, zIndex: 1000, background: '#252526', border: '1px solid #444', borderRadius: 6, padding: 8, width: 420, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ color: '#fff', fontWeight: 600 }}>Saved Views</div>
            <button type="button" onClick={() => setShowLoadPicker(false)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Close</button>
          </div>
          {savedViews.length === 0 ? (
            <div style={{ color: '#aaa' }}>No saved views.</div>
          ) : savedViews.map(v => (
            <div key={`${v.viewName}|${v.createdAt}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center', border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f', marginBottom: 6 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{v.viewName}</div>
                <div style={{ color: '#aaa', fontSize: '0.8rem' }}>{v.createdAt}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => { applyViewState(v.content || {}); setShowLoadPicker(false); }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Load</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Controls (minimal; main inputs moved to toolbar) */}
      {!dashboardMode && (
        <div className="sec-controls" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
        {/* Undo/Redo */}
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" onClick={undo} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Undo</button>
          <button type="button" onClick={redo} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Redo</button>
        </div>
        {/* Search, dropdown, checkboxes, font size, freeze are now in the toolbar */}

        {/* Column picker (trigger moved to toolbar) */}
        <div style={{ position: "relative", ...(allDisabled || !perm.columns ? disabledStyle : {}) }} ref={pickerRef}>
          {showColumnPicker && (
            <div style={{ position: 'fixed', top: `${(anchorCols?.top ?? 64)}px`, left: `${anchorCols?.left ?? 10}px`, backgroundColor: "#252526", border: "1px solid #444", borderRadius: "6px", padding: "8px", zIndex: 1000, display: "flex", flexDirection: "column", gap: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", minWidth: "220px", maxHeight: "300px", overflowY: "auto" }}>
              <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <button type="button" onClick={selectAllColumns} style={{ flex: 1, fontSize: "0.8rem", padding: "2px", background: "#0e639c", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Select All</button>
                <button type="button" onClick={deselectAllColumns} style={{ flex: 1, fontSize: "0.8rem", padding: "2px", background: "#2d2d2d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Deselect All</button>
              </div>
              {headers.map((col) => (
                <label key={col} style={{ fontSize: "0.9rem", cursor: "pointer", color: visibleColumns.includes(col) ? "#fff" : "#888", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={visibleColumns.includes(col)} onChange={() => toggleColumn(col)} style={{ marginRight: "6px" }} />
                  {col}
                </label>
              ))}
            </div>
          )}
        </div>

  {/* Drill-through side panel */}
  {showDrill && (
    <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: '50%', maxWidth: 640, background: '#111', borderLeft: '1px solid #333', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid #333', background: '#151515', color: '#ddd' }}>
        <div>
          <div style={{ fontWeight: 600 }}>Drill-through ({drillRows.length} rows)</div>
          {(() => {
            const ctx = drillContext || {};
            const chips = [];
            if (ctx.column != null) {
              chips.push({ k: String(ctx.column), v: String(ctx.value ?? '') });
            }
            if (ctx.groupKey && typeof ctx.groupKey === 'object') {
              for (const k of Object.keys(ctx.groupKey)) chips.push({ k, v: String(ctx.groupKey[k] ?? '') });
            }
            if (!chips.length) return null;
            return (
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {chips.map((c, i) => (
                  <span key={`${c.k}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderRadius: 12, background: '#2d2d2d', color: '#ddd', border: '1px solid #444' }}>
                    <strong>{c.k}</strong>: {c.v}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <button type="button" onClick={() => setShowDrill(false)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Close</button>
        </div>
      )}
      {/* Selection summary & actions */}
      {(() => {
        const colSel = Object.entries(selectedValuesByCol || {}).filter(([c, s]) => s && s.size > 0);
        const colCount = selectedColumns.size + colSel.length;
        const rowCount = selectedRowIdx.size;
        if (!colCount && !rowCount) return null;
        const keepOnly = () => {
          // If exactly one column of values selected, keep only those values via valueFilters
          const cols = colSel.length ? colSel : Array.from(selectedColumns).map(c => [c, new Set()]);
          if (cols.length === 1) {
            const [col, set] = cols[0];
            const values = set && set.size ? Array.from(set) : [];
            if (values.length) {
              setValueFilters(prev => ({ ...prev, [col]: values }));
              clearSelection(); setCurrentPage(1);
              return;
            }
          }
        };
        const exclude = () => {
          if (colSel.length === 1) {
            const [col, setv] = colSel[0];
            const currentRows = isPivotView ? pivotedData : sortedData;
            const allVals = Array.from(new Set(currentRows.map(r => String(r?.[col] ?? ''))));
            const remaining = allVals.filter(v => !setv.has(v));
            setValueFilters(prev => ({ ...prev, [col]: remaining }));
            clearSelection(); setCurrentPage(1);
          }
        };
        const addFilter = () => keepOnly();
        const copySel = async () => {
          try {
            const lines = [];
            for (const [col, setv] of colSel) {
              for (const v of Array.from(setv)) lines.push(`${col}\t${v}`);
            }
            if (!lines.length) return;
            await navigator.clipboard.writeText(lines.join('\n'));
          } catch {}
        };
        const exportSel = () => {
          const rows = [];
          for (const [col, setv] of colSel) {
            for (const v of Array.from(setv)) rows.push({ column: col, value: v });
          }
          const csv = ['column,value'].concat(rows.map(r => `${JSON.stringify(r.column)},${JSON.stringify(r.value)}`)).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'selection.csv'; a.click(); URL.revokeObjectURL(url);
        };
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: 6, border: '1px solid #333', borderRadius: 6, background: '#1f1f1f' }}>
            <span style={{ color: '#ddd' }}>Selection: {colCount ? `${colCount} col/cell groups` : ''}{rowCount ? ` • ${rowCount} rows` : ''}</span>
            <button type="button" onClick={keepOnly} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Keep Only</button>
            <button type="button" onClick={exclude} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Exclude</button>
            <button type="button" onClick={addFilter} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Add as filter</button>
            <button type="button" onClick={copySel} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Copy</button>
            <button type="button" onClick={exportSel} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Export</button>
            <button type="button" onClick={clearSelection} style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Clear</button>
          </div>
        );
      })()}
      <div style={{ overflow: 'auto', padding: 8 }}>
        {(() => {
          // Determine which columns to show: hide drilled column and group key columns (already shown as chips)
          const ctx = drillContext || {};
          const hide = new Set();
          if (ctx.column) hide.add(ctx.column);
          if (ctx.groupKey && typeof ctx.groupKey === 'object') { Object.keys(ctx.groupKey).forEach(k => hide.add(k)); }
          const cols = headers.filter(h => !hide.has(h));
          return (
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: `${fontSize}px` }}>
          <thead>
            <tr>
              {cols.map((h) => (
                <th key={h} style={{ border: '1px solid #333', background: '#0e639c', color: '#fff', padding: 4, textAlign: numericCols.has(h) ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drillRows.slice(0, 500).map((r, i) => (
              <tr key={i}>
                {cols.map((h) => {
                  const txt = renderCell(r[h]);
                  return (
                    <td key={`${i}-${h}`} style={{ border: '1px solid #333', padding: 4, textAlign: numericCols.has(h) ? 'right' : 'left' }}>
                      <CollapsibleCell text={txt} collapseChars={collapseChars} isVirtualized={false} fontSize={fontSize} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
            </table>
          );
        })()}
        {drillRows.length > 500 && <div style={{ color: '#aaa', marginTop: 6 }}>(Showing first 500 rows)</div>}
      </div>
    </div>
  )}

        {/* Filters */}
        <div style={{ position: 'relative', ...(allDisabled || !perm.filters ? disabledStyle : {}) }} ref={filterRef}>
          {/* Trigger moved to toolbar; panel anchored to icon */}
          {showFilterPicker && (
            <div style={{ position: 'fixed', top: `${(anchorFilters?.top ?? 64)}px`, left: `${anchorFilters?.left ?? 10}px`, background: '#252526', border: '1px solid #444', borderRadius: 6, padding: 8, zIndex: 1000, minWidth: 420, maxWidth: 560, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Column Filters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflow: 'auto' }}>
                {headers.map((col) => {
                  const isNum = numericCols.has(col);
                  const f = colFilters[col] || { op: isNum ? '=' : 'contains', value: '' };
                  const numOps = ['=','!=','>','>=','<','<=','between'];
                  const strOps = ['contains','equals','startsWith','endsWith','notContains','isEmpty','notEmpty'];
                  return (
                    <div key={col} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 140px 1fr 1fr auto', gap: 6, alignItems: 'center', border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f' }}>
                      <div style={{ color: '#ddd', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                      <select value={f.op} onChange={(e) => setColFilters(prev => ({ ...prev, [col]: { ...f, op: e.target.value } }))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                        {(isNum ? numOps : strOps).map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                      {f.op !== 'isEmpty' && f.op !== 'notEmpty' && (
                        <input value={f.value ?? ''} onChange={(e) => setColFilters(prev => ({ ...prev, [col]: { ...f, value: e.target.value } }))} placeholder={isNum ? 'value' : 'text'} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                      )}
                      {isNum && f.op === 'between' && (
                        <input value={f.value2 ?? ''} onChange={(e) => setColFilters(prev => ({ ...prev, [col]: { ...f, value2: e.target.value } }))} placeholder={'and'} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                      )}
                      <button type="button" onClick={() => setColFilters(prev => { const copy = { ...prev }; delete copy[col]; return copy; })} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Clear</button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <label style={{ color: '#ddd', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={showSummary} onChange={(e) => setShowSummary(e.target.checked)} /> Show summary row (Σ / μ / n)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                <button type="button" onClick={() => setColFilters({})} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Clear All</button>
                <button type="button" onClick={() => setShowFilterPicker(false)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Pivot picker (trigger moved to toolbar) */}
        <div style={{ position: "relative", ...(allDisabled || !perm.pivot ? disabledStyle : {}) }} ref={pivotRef}>
          {showPivotPicker && (
            <div style={{ position: 'fixed', top: `${(anchorPivot?.top ?? 64)}px`, left: `${anchorPivot?.left ?? 10}px`, backgroundColor: "#252526", border: "1px solid #444", borderRadius: "6px", zIndex: 1000, display: "flex", flexDirection: "column", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", minWidth: "300px", maxWidth: '80vw', height: '70vh', overflow: 'hidden' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#252526', padding: 8, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ color: "#fff", fontSize: "0.95rem" }}>Pivot Options</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowPivotPicker(false)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Close</button>
                  {isPivotView ? (
                    <button type="button" onClick={() => { setIsPivotView(false); setShowPivotPicker(false); }} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Switch to Normal View</button>
                  ) : (
                    <button type="button" onClick={() => { setIsPivotView(true); setShowPivotPicker(false); }} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #1e5b86', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Switch to Pivot View</button>
                  )}
                </div>
              </div>
              <div style={{ flex: '1 1 auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>

              {/* Field List: drag-and-drop Rows/Columns/Values/Filters */}
              <div style={{ color: '#aaa', fontSize: '0.85rem' }}>Field List (drag to areas):</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ border: '1px solid #333', borderRadius: 4, padding: 6, minHeight: 100 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const f = e.dataTransfer.getData('text/pivot-field');
                    if (!f) return;
                    setPivotConfig(prev => prev.columns.includes(f) ? prev : { ...prev, columns: [...prev.columns, f] });
                  }}>
                  <div style={{ color: '#ddd', fontWeight: 600, marginBottom: 4 }}>Rows</div>
                  {pivotConfig.columns.map((f) => (
                    <div key={`row-${f}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '2px 6px', margin: 2, background: '#1f1f1f', border: '1px solid #333', borderRadius: 12 }}>
                      <span>{f}</span>
                      <button type="button" onClick={() => setPivotConfig(prev => ({ ...prev, columns: prev.columns.filter(x => x !== f) }))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ border: '1px solid #333', borderRadius: 4, padding: 6, minHeight: 100 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const f = e.dataTransfer.getData('text/pivot-field');
                    if (!f) return;
                    setPivotConfig(prev => prev.colAxis && prev.colAxis.includes(f) ? prev : { ...prev, colAxis: [...(prev.colAxis||[]), f] });
                  }}>
                  <div style={{ color: '#ddd', fontWeight: 600, marginBottom: 4 }}>Columns</div>
                  {(pivotConfig.colAxis||[]).map((f) => (
                    <div key={`col-${f}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '2px 6px', margin: 2, background: '#1f1f1f', border: '1px solid #333', borderRadius: 12 }}>
                      <span>{f}</span>
                      <button type="button" onClick={() => setPivotConfig(prev => ({ ...prev, colAxis: (prev.colAxis||[]).filter(x => x !== f) }))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ gridColumn: '1 / span 2', border: '1px solid #333', borderRadius: 4, padding: 6 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const f = e.dataTransfer.getData('text/pivot-field');
                    if (!f) return;
                    setPivotConfig(prev => ({ ...prev, measures: prev.measures && prev.measures.includes(f) ? prev.measures : [...(prev.measures||[]), f], aggColumn: '' }));
                  }}>
                  <div style={{ color: '#ddd', fontWeight: 600, marginBottom: 4 }}>Values</div>
                  {(pivotConfig.measures && pivotConfig.measures.length ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : [])).map((f) => (
                    <div key={`val-${f}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '2px 6px', margin: 2, background: '#1f1f1f', border: '1px solid #333', borderRadius: 12 }}>
                      <span>{f}</span>
                      <button type="button" onClick={() => setPivotConfig(prev => ({ ...prev, measures: (prev.measures||[]).filter(x => x !== f), aggColumn: '' }))} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ gridColumn: '1 / span 2', border: '1px solid #333', borderRadius: 4, padding: 6 }}>
                  <div style={{ color: '#ddd', fontWeight: 600, marginBottom: 4 }}>Filters (use table filters or drag fields here for reference)</div>
                  {/* Placeholder list; actual filtering handled by table filters above */}
                </div>
                <div style={{ gridColumn: '1 / span 2', border: '1px dashed #444', borderRadius: 4, padding: 6, maxHeight: 160, overflow: 'auto' }}>
                  <div style={{ color: '#ddd', fontWeight: 600, marginBottom: 4 }}>All fields</div>
                  {headers.map(h => (
                    <span key={`fld-${h}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/pivot-field', h); e.dataTransfer.effectAllowed = 'move'; }} style={{ display: 'inline-block', margin: 2, padding: '2px 6px', background: '#1f1f1f', border: '1px solid #333', borderRadius: 12, color: '#ddd', cursor: 'grab' }}>{h}</span>
                  ))}
                </div>
              </div>

              {/* Measures (multi-select) */}
              <div style={{ color: "#aaa", fontSize: "0.85rem" }}>Measures:</div>
              <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid #333', borderRadius: 4, padding: 6 }}>
                {headers.map((col) => (
                  <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: "#ddd", fontSize: "0.9rem" }}>
                    <input
                      type="checkbox"
                      checked={pivotConfig.measures?.includes(col) || pivotConfig.aggColumn === col}
                      onChange={() => setPivotConfig((prev) => {
                        const measures = prev.measures && prev.measures.length ? [...prev.measures] : (prev.aggColumn ? [prev.aggColumn] : []);
                        const idx = measures.indexOf(col);
                        if (idx >= 0) measures.splice(idx, 1); else measures.push(col);
                        return { ...prev, measures, aggColumn: '' };
                      })}
                    />
                    {col}
                  </label>
                ))}
              </div>

              {/* Functions (multi-select) */}
              <div style={{ color: "#aaa", fontSize: "0.85rem" }}>Functions:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {["sum","avg","count","min","max"].map((fn) => (
                  <label key={fn} style={{ color: '#ddd' }}>
                    <input type="checkbox" checked={(pivotConfig.funcs || [pivotConfig.aggFunc || 'sum']).includes(fn)} onChange={() => setPivotConfig((prev) => {
                      const base = prev.funcs && prev.funcs.length ? [...prev.funcs] : (prev.aggFunc ? [prev.aggFunc] : ['sum']);
                      const i = base.indexOf(fn);
                      if (i >= 0) base.splice(i, 1); else base.push(fn);
                      return { ...prev, funcs: base, aggFunc: '' };
                    })} /> {fn}
                  </label>
                ))}
              </div>

              {/* Top-N within groups */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Top‑N within groups:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.topN && pivotConfig.topN.enabled)} onChange={(e) => setPivotConfig(prev => ({ ...prev, topN: { ...(prev.topN||{}), enabled: e.target.checked } }))} /> Enable</label>
                <label style={{ color: '#ddd' }}>Level
                  <input type="number" min="0" max={Math.max(0, pivotConfig.columns.length-1)} value={(pivotConfig.topN && pivotConfig.topN.level) || 0} onChange={(e) => setPivotConfig(prev => ({ ...prev, topN: { ...(prev.topN||{}), level: Math.max(0, Math.min(pivotConfig.columns.length-1, Number(e.target.value)||0)) } }))} style={{ width: 60, marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                </label>
                <label style={{ color: '#ddd' }}>N
                  <input type="number" min="1" max="100" value={(pivotConfig.topN && pivotConfig.topN.n) || 10} onChange={(e) => setPivotConfig(prev => ({ ...prev, topN: { ...(prev.topN||{}), n: Math.max(1, Math.min(100, Number(e.target.value)||10)) } }))} style={{ width: 60, marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                </label>
                <label style={{ color: '#ddd' }}>By
                  <select value={(pivotConfig.topN && pivotConfig.topN.measure) || ''} onChange={(e) => setPivotConfig(prev => ({ ...prev, topN: { ...(prev.topN||{}), measure: e.target.value || null } }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="">(primary measure)</option>
                    {(() => {
                      const ms = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
                      const fs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
                      const labels = [];
                      for (const m of ms) for (const f of fs) labels.push(`${m} (${f})`);
                      return labels.map(l => <option key={l} value={l}>{l}</option>);
                    })()}
                  </select>
                </label>
                <label style={{ color: '#ddd' }}>Dir
                  <select value={(pivotConfig.topN && pivotConfig.topN.dir) || 'desc'} onChange={(e) => setPivotConfig(prev => ({ ...prev, topN: { ...(prev.topN||{}), dir: e.target.value } }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </label>
              </div>

              {/* Percent of row/column */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Percent of parent:</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.percentRow} onChange={(e) => setPivotConfig(prev => ({ ...prev, percentRow: e.target.checked }))} /> by row</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.percentCol} onChange={(e) => setPivotConfig(prev => ({ ...prev, percentCol: e.target.checked }))} /> by column</label>
              </div>

              {/* Calculated toggles */}
              <div style={{ color: "#aaa", fontSize: "0.85rem", marginTop: 6 }}>Calculated columns:</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.calcPctTotal} onChange={(e) => setPivotConfig(prev => ({ ...prev, calcPctTotal: e.target.checked }))} /> % of total</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.calcPctParent} onChange={(e) => setPivotConfig(prev => ({ ...prev, calcPctParent: e.target.checked }))} /> % of parent</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.calcRank} onChange={(e) => setPivotConfig(prev => ({ ...prev, calcRank: e.target.checked }))} /> rank</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotConfig.calcRunning} onChange={(e) => setPivotConfig(prev => ({ ...prev, calcRunning: e.target.checked }))} /> running total</label>
              </div>

              {/* Sorting among groups */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Group sorting:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}>By
                  <select value={pivotConfig.sortMeasure || ''} onChange={(e) => setPivotConfig(prev => ({ ...prev, sortMeasure: e.target.value || null }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="">(primary measure)</option>
                    {(() => {
                      const ms = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
                      const fs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
                      const labels = [];
                      for (const m of ms) for (const f of fs) labels.push(`${m} (${f})`);
                      const calcU = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
                      return [...labels, ...calcU].map(l => <option key={l} value={l}>{l}</option>);
                    })()}
                  </select>
                </label>
                <label style={{ color: '#ddd' }}>Dir
                  <select value={pivotConfig.sortDir || 'desc'} onChange={(e) => setPivotConfig(prev => ({ ...prev, sortDir: e.target.value }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </label>
              </div>

              {/* Subtotals / Grand totals */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Totals:</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={pivotConfig.showSubtotals !== false} onChange={(e) => setPivotConfig(prev => ({ ...prev, showSubtotals: e.target.checked }))} /> Show subtotals</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={pivotConfig.showGrand !== false} onChange={(e) => setPivotConfig(prev => ({ ...prev, showGrand: e.target.checked }))} /> Show grand total</label>
                <button type="button" onClick={() => setPivotCollapsed(new Set())} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Expand all</button>
                <button type="button" onClick={() => setPivotConfig(prev => ({ ...prev, showSubtotals: false }))} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Collapse all</button>
              </div>

              {/* Row labels mode */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Row labels:</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}>
                  <input type="radio" name="rowlabels" checked={pivotConfig.rowLabelsMode === 'separate'} onChange={() => setPivotConfig(prev => ({ ...prev, rowLabelsMode: 'separate' }))} /> Separate columns (Region, Customer, ...)
                </label>
                <label style={{ color: '#ddd' }}>
                  <input type="radio" name="rowlabels" checked={pivotConfig.rowLabelsMode === 'single'} onChange={() => setPivotConfig(prev => ({ ...prev, rowLabelsMode: 'single' }))} /> Single "Row Labels" column
                </label>
              </div>

              {/* Calculated measures (user-defined) */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Calculated measures:</div>
              {pivotCalcMeasures && pivotCalcMeasures.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflow: 'auto' }}>
                  {pivotCalcMeasures.map(cm => (
                    <div key={cm.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 6, border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f' }}>
                      <input type="checkbox" checked={cm.enabled !== false} onChange={() => setPivotCalcMeasures(prev => prev.map(x => x.id === cm.id ? { ...x, enabled: !(x.enabled !== false) } : x))} />
                      <div style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cm.name} = {cm.formula}</div>
                      <button type="button" onClick={() => setPivotCalcMeasures(prev => prev.filter(x => x.id !== cm.id))} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <input placeholder="Name (e.g., Margin %)" value={pivotCalcDraft.name} onChange={(e) => setPivotCalcDraft(d => ({ ...d, name: e.target.value }))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                <input placeholder="Formula (use m['Sales (sum)'])" value={pivotCalcDraft.formula} onChange={(e) => setPivotCalcDraft(d => ({ ...d, formula: e.target.value }))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                <button type="button" onClick={() => {
                  const n = (pivotCalcDraft.name || '').trim();
                  if (!n) return;
                  setPivotCalcMeasures(prev => [...prev, { id: Date.now() + Math.random(), name: n, formula: pivotCalcDraft.formula || '', enabled: true }]);
                  setPivotCalcDraft({ name: '', formula: '' });
                }} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Add</button>
              </div>

              {/* Buckets / Grains */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Binning & Time Buckets:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <label style={{ color: '#ddd' }}>Column
                  <select onChange={(e) => {
                    const col = e.target.value;
                    if (!col) return;
                    setPivotBins(prev => ({ ...prev, [col]: prev[col] || { type: 'equal', bins: 5 } }));
                  }} value="" style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="">(choose)</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              </div>
              {Object.entries(pivotBins || {}).map(([col, cfg]) => (
                <div key={col} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center', border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f' }}>
                  <div style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                  <select value={cfg.type} onChange={(e) => setPivotBins(prev => ({ ...prev, [col]: { ...(prev[col]||{}), type: e.target.value } }))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="equal">equal bins</option>
                    <option value="time">time grain</option>
                  </select>
                  {cfg.type === 'equal' ? (
                    <label style={{ color: '#aaa' }}>Bins
                      <input type="number" min="1" max="20" value={cfg.bins || 5} onChange={(e) => setPivotBins(prev => ({ ...prev, [col]: { ...(prev[col]||{}), bins: Math.max(1, Math.min(20, Number(e.target.value)||5)) } }))} style={{ marginLeft: 6, width: 80, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                    </label>
                  ) : (
                    <label style={{ color: '#aaa' }}>Grain
                      <select value={cfg.grain || 'month'} onChange={(e) => setPivotBins(prev => ({ ...prev, [col]: { ...(prev[col]||{}), grain: e.target.value } }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                        <option value="year">year</option>
                        <option value="quarter">quarter</option>
                        <option value="month">month</option>
                        <option value="week">week</option>
                        <option value="day">day</option>
                      </select>
                    </label>
                  )}
                  <button type="button" onClick={() => setPivotBins(prev => { const copy = { ...prev }; delete copy[col]; return copy; })} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}

              {/* Time Intelligence (requires one time-grain column on Columns axis) */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Time Intelligence:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.timeIntel && pivotConfig.timeIntel.enabled)} onChange={(e) => setPivotConfig(prev => ({ ...prev, timeIntel: { ...(prev.timeIntel||{}), enabled: e.target.checked } }))} /> Enable</label>
                <label style={{ color: '#ddd' }}>Field
                  <select value={(pivotConfig.timeIntel && pivotConfig.timeIntel.field) || ''} onChange={(e) => setPivotConfig(prev => ({ ...prev, timeIntel: { ...(prev.timeIntel||{}), field: e.target.value || null } }))} style={{ marginLeft: 6, background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                    <option value="">(auto)</option>
                    {(pivotConfig.colAxis||[]).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.timeIntel && (pivotConfig.timeIntel.funcs||[]).includes('MoM'))} onChange={(e) => setPivotConfig(prev => { const funcs = new Set(prev.timeIntel?.funcs||[]); if (e.target.checked) funcs.add('MoM'); else funcs.delete('MoM'); return { ...prev, timeIntel: { ...(prev.timeIntel||{}), funcs: Array.from(funcs) } }; })} /> MoM</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.timeIntel && (pivotConfig.timeIntel.funcs||[]).includes('YoY'))} onChange={(e) => setPivotConfig(prev => { const funcs = new Set(prev.timeIntel?.funcs||[]); if (e.target.checked) funcs.add('YoY'); else funcs.delete('YoY'); return { ...prev, timeIntel: { ...(prev.timeIntel||{}), funcs: Array.from(funcs) } }; })} /> YoY</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.timeIntel && (pivotConfig.timeIntel.funcs||[]).includes('MTD'))} onChange={(e) => setPivotConfig(prev => { const funcs = new Set(prev.timeIntel?.funcs||[]); if (e.target.checked) funcs.add('MTD'); else funcs.delete('MTD'); return { ...prev, timeIntel: { ...(prev.timeIntel||{}), funcs: Array.from(funcs) } }; })} /> MTD</label>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!(pivotConfig.timeIntel && (pivotConfig.timeIntel.funcs||[]).includes('YTD'))} onChange={(e) => setPivotConfig(prev => { const funcs = new Set(prev.timeIntel?.funcs||[]); if (e.target.checked) funcs.add('YTD'); else funcs.delete('YTD'); return { ...prev, timeIntel: { ...(prev.timeIntel||{}), funcs: Array.from(funcs) } }; })} /> YTD</label>
              </div>

              {/* Row styles */}
              <div style={{ color: "#aaa", fontSize: "0.85rem", marginTop: 6 }}>Row styles:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Subtotal bg
                  <input type="color" value={pivotStyle.subtotalBg} onChange={(e) => setPivotStyle(ps => ({ ...ps, subtotalBg: e.target.value }))} />
                </label>
                <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Subtotal text
                  <input type="color" value={pivotStyle.subtotalText} onChange={(e) => setPivotStyle(ps => ({ ...ps, subtotalText: e.target.value }))} />
                </label>
                <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Grand bg
                  <input type="color" value={pivotStyle.grandBg} onChange={(e) => setPivotStyle(ps => ({ ...ps, grandBg: e.target.value }))} />
                </label>
                <label style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 6 }}>Grand text
                  <input type="color" value={pivotStyle.grandText} onChange={(e) => setPivotStyle(ps => ({ ...ps, grandText: e.target.value }))} />
                </label>
                <label style={{ color: '#ddd', gridColumn: '1 / span 2', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!pivotStyle.subtotalNewline} onChange={(e) => setPivotStyle(ps => ({ ...ps, subtotalNewline: e.target.checked }))} />
                  Show "Subtotal" on a new line in group cell
                </label>
              </div>

              {/* Sparklines */}
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>Inline sparklines:</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ color: '#ddd' }}><input type="checkbox" checked={!!pivotSparkline} onChange={(e) => setPivotSparkline(e.target.checked)} /> Show sparkline (primary measure across column axis)</label>
              </div>

              </div>
              {/* Footer actions sticky */}
              <div style={{ position: 'sticky', bottom: 0, zIndex: 1, background: '#252526', padding: 8, borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={() => setShowPivotPicker(false)} style={{ padding: 8, borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Close</button>
                {isPivotView ? (
                  <button onClick={() => { setIsPivotView(false); setShowPivotPicker(false); }} style={{ padding: 8, border: "none", borderRadius: 4, background: "#0e639c", color: "white", cursor: "pointer" }}>
                    Switch to Normal View
                  </button>
                ) : (
                  <button onClick={() => { setIsPivotView(true); setShowPivotPicker(false); }} style={{ padding: 8, border: "none", borderRadius: 4, background: "#0e639c", color: "white", cursor: "pointer" }}>
                    Switch to Pivot View
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Derived columns (trigger moved to toolbar) */}
        <div style={{ position: 'relative', ...(allDisabled || !perm.derived ? disabledStyle : {}) }} ref={derivedRef}>
          {showDerivedPicker && (
            <DerivedPicker
              baseHeaders={baseHeaders}
              derivedCols={derivedCols}
              setDerivedCols={setDerivedCols}
              useFixed={true}
              fixedTop={anchorDerived?.top ?? 64}
              fixedLeft={anchorDerived?.left ?? 10}
            />
          )}
        </div>

        {/* Conditional formatting (trigger moved to toolbar) */}
        <div style={{ position: 'relative', ...(allDisabled || !perm.formatting ? disabledStyle : {}) }} ref={formatRef}>
          {showFormatPicker && (
            <FormatPicker headers={headers} numericCols={numericCols} rules={condRules} setRules={setCondRules} useFixed={true} fixedTop={anchorCondFmt?.top ?? 64} fixedLeft={anchorCondFmt?.left ?? 10} />
          )}
        </div>

        {/* Formats (number/date) (trigger moved to toolbar) */}
        <div style={{ position: 'relative' }} ref={formatsRef}>
          {showFormatsPanel && (
            <div style={{ position: 'fixed', top: `${(anchorFormats?.top ?? 64)}px`, left: `${anchorFormats?.left ?? 10}px`, background: '#252526', border: '1px solid #444', borderRadius: 6, padding: 8, zIndex: 1000, minWidth: 420, maxWidth: 560, maxHeight: 260, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Column Formats</div>
              {headers.map((col) => {
                const f = colFormats[col] || { type: 'default', precision: 2, currency: 'USD' };
                return (
                  <div key={col} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 6, alignItems: 'center', border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f', marginBottom: 6 }}>
                    <div style={{ color: '#ddd', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                    <select value={f.type} onChange={(e) => setColFormats(prev => ({ ...prev, [col]: { ...f, type: e.target.value } }))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                      <option value="default">default</option>
                      <option value="number">number</option>
                      <option value="thousands">thousands</option>
                      <option value="percent">percent</option>
                      <option value="currency">currency</option>
                      <option value="date">date</option>
                      <option value="datetime">datetime</option>
                    </select>
                    <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Prec
                      <input type="number" min="0" max="6" value={f.precision ?? 2} onChange={(e) => setColFormats(prev => ({ ...prev, [col]: { ...f, precision: Number(e.target.value) } }))} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                    </label>
                    <label style={{ color: '#aaa', fontSize: '0.85rem' }}>Curr
                      <input value={f.currency || 'USD'} onChange={(e) => setColFormats(prev => ({ ...prev, [col]: { ...f, currency: e.target.value || 'USD' } }))} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                    </label>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFormatsPanel(false)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Chart controls moved to toolbar */}
        {/* Advanced filters (triggered by toolbar icon) */}
        <div style={{ position: 'relative' }} ref={advancedRef}>
          {showAdvancedPicker && (
            <div style={{ position: 'fixed', top: `${(anchorAdvanced?.top ?? 64)}px`, left: `${anchorAdvanced?.left ?? 10}px`, background: '#252526', border: '1px solid #444', borderRadius: 6, padding: 8, zIndex: 1000, minWidth: 520, maxWidth: 640, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Advanced Filters</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: '#aaa' }}>Combine:</span>
                <select value={advCombine} onChange={(e) => setAdvCombine(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button type="button" onClick={() => setAdvFilters(prev => [...prev, { id: Date.now() + Math.random(), column: headers[0], op: 'contains', value: '' }])} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Add Rule</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflow: 'auto' }}>
                {advFilters.length === 0 ? (
                  <div style={{ color: '#aaa' }}>No rules yet.</div>
                ) : advFilters.map((f) => {
                  const isNum = numericCols.has(f.column);
                  const numOps = ['=','!=','>','>=','<','<=','between'];
                  const strOps = ['contains','equals','startsWith','endsWith','notContains','isEmpty','notEmpty'];
                  const ops = isNum ? numOps : strOps;
                  return (
                    <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 1fr 1fr 1fr auto', gap: 6, alignItems: 'center', border: '1px solid #333', borderRadius: 6, padding: 6, background: '#1f1f1f' }}>
                      <select value={f.column} onChange={(e) => setAdvFilters(prev => prev.map(x => x.id === f.id ? { ...x, column: e.target.value, op: numericCols.has(e.target.value) ? '=' : 'contains', value: '', value2: '' } : x))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select value={f.op} onChange={(e) => setAdvFilters(prev => prev.map(x => x.id === f.id ? { ...x, op: e.target.value } : x))} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }}>
                        {ops.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                      {f.op !== 'isEmpty' && f.op !== 'notEmpty' && (
                        <input value={f.value ?? ''} onChange={(e) => setAdvFilters(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder={isNum ? 'value' : 'text'} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                      )}
                      {isNum && f.op === 'between' && (
                        <input value={f.value2 ?? ''} onChange={(e) => setAdvFilters(prev => prev.map(x => x.id === f.id ? { ...x, value2: e.target.value } : x))} placeholder={'and'} style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: 6, borderRadius: 4 }} />
                      )}
                      <button type="button" onClick={() => setAdvFilters(prev => prev.filter(x => x.id !== f.id))} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #555', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Delete</button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                <button type="button" onClick={() => setAdvFilters([])} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Clear All</button>
                <button type="button" onClick={() => setShowAdvancedPicker(false)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {/* Active filter chips */}
      {(() => {
        const entries = Object.entries(colFilters || {}).filter(([c, f]) => f && f.op && (f.op === 'isEmpty' || f.op === 'notEmpty' || (f.value != null && String(f.value).length > 0)));
        const valueEntries = Object.entries(valueFilters || {}).filter(([c, arr]) => Array.isArray(arr));
        if (entries.length === 0 && valueEntries.length === 0) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8, ...(allDisabled || !perm.filters ? disabledStyle : {}) }}>
            <span style={{ color: '#aaa' }}>Filters:</span>
            {entries.map(([col, f]) => (
              <span key={col} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderRadius: 12, background: '#2d2d2d', color: '#ddd', border: '1px solid #444' }}>
                <span>{col} {f.op}{(f.op !== 'isEmpty' && f.op !== 'notEmpty') ? ` ${f.value}${f.op === 'between' && f.value2 != null ? ` and ${f.value2}` : ''}` : ''}</span>
                <button type="button" onClick={() => setColFilters(prev => { const copy = { ...prev }; delete copy[col]; return copy; })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
              </span>
            ))}
            {valueEntries.map(([col, arr]) => (
              <span key={`vf-${col}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 6px', borderRadius: 12, background: '#2d2d2d', color: '#ddd', border: '1px solid #444' }}>
                <span>{col} ∈ {arr.length} values</span>
                <button type="button" onClick={() => setValueFilters(prev => { const copy = { ...prev }; delete copy[col]; return copy; })} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
              </span>
            ))}
            <button type="button" onClick={() => { setColFilters({}); setValueFilters({}); }} style={{ padding: '2px 8px', borderRadius: 12, border: '1px solid #444', background: '#1f1f1f', color: '#fff', cursor: 'pointer' }}>Clear All</button>
          </div>
        );
      })()}
      <Suspense fallback={<div style={{ color: '#aaa', margin: '8px 0' }}>Loading charts…</div>}>
        <ChartPanel
          headers={headers}
          rows={serverMode ? (serverAllRows ?? serverRows) : sortedData}
          disabled={isPivotView || allDisabled || !perm.chart || (serverMode && chartVisible && serverAllLoading)}
          controlsInParent={true}
          showPicker={chartPickerOpen}
          setShowPicker={setChartPickerOpen}
          visible={chartVisible}
          setVisible={setChartVisible}
          onCrossFilter={({ column, values, append }) => {
            if (!column || !values || values.length === 0) return;
            setValueFilters(prev => {
              const curr = prev[column];
              if (append && Array.isArray(curr)) {
                const set = new Set(curr);
                values.forEach(v => set.add(String(v)));
                return { ...prev, [column]: Array.from(set) };
              }
              return { ...prev, [column]: values.map(v => String(v)) };
            });
            setCurrentPage(1);
          }}
        />
      </Suspense>

      {/* Pivot readiness notice */}
      {(() => {
        if (!isPivotView) return null;
        const measuresH = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
        const funcsH = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
        const pivotReady = pivotConfig.columns.length > 0 && measuresH.length > 0 && funcsH.length > 0;
        if (pivotReady) return null;
        return (
          <div style={{ padding: 16, border: '1px solid #333', borderRadius: 8, background: '#151515', color: '#ddd', marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Pivot view needs configuration</div>
            <div style={{ marginBottom: 8 }}>Select at least one Pivot Column and one Measure/Function in Pivot ▾ to render the pivot table.</div>
            <button type="button" onClick={() => setShowPivotPicker(true)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Open Pivot Options</button>
          </div>
        );
      })()}

      {/* Table */}
      {((!isPivotView) || (isPivotView && pivotConfig.columns.length > 0 && ((pivotConfig.measures && pivotConfig.measures.length) || pivotConfig.aggColumn) && ((pivotConfig.funcs && pivotConfig.funcs.length) || pivotConfig.aggFunc))) && (
      <div style={{ overflowX: 'auto' }} ref={scrollerRef}>
      <table role={isPivotView ? 'treegrid' : 'grid'} aria-readonly="true" style={{ borderCollapse: "collapse", width: contentWidth ? `${contentWidth}px` : "100%", minWidth: "600px", fontSize: `${fontSize}px` }}>
        <thead>
          <tr>
            {isVirtualized && !isPivotView && (
              <th
                key="__index"
                style={{ position: 'sticky', top: 0, left: 0, zIndex: 4, border: '1px solid #ddd', padding: '5px', backgroundColor: '#0e639c', color: 'white', textAlign: 'right', whiteSpace: 'nowrap', width: `${indexColWidthScaled || indexColWidth}px`, minWidth: `${indexColWidthScaled || indexColWidth}px` }}
              >
                #
              </th>
            )}
            {/* selection checkbox column removed */}
            {(isPivotView ? (() => {
              const measures = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
              const funcs = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
              const labels = [];
              for (const m of measures) for (const f of funcs) labels.push(`${m} (${f})`);
              const calc = [];
              if (pivotConfig.calcPctTotal) calc.push(...labels.map(l => `${l} (% total)`));
              if (pivotConfig.calcPctParent) calc.push(...labels.map(l => `${l} (% parent)`));
              if (pivotConfig.calcRank) calc.push(`${labels[0]} (Rank)`);
              if (pivotConfig.calcRunning) calc.push(`${labels[0]} (Running)`);
              const calcUser = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
              const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
              if (colAxis.length === 0) {
                const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
                return [...rowCols, ...labels, ...calc, ...calcUser];
              }
              // Build column header labels from data keys in pivotedData
              let colKeyLabels = (() => {
                const set = new Set();
                const rows = paginatedData.length ? paginatedData : pivotedData;
                rows.forEach(r => Object.keys(r).forEach(k => { if (k.includes(' | ') && !pivotConfig.columns.includes(k)) set.add(k); }));
                // Extract the left side (colLabel) portion
                const lefts = new Set();
                Array.from(set).forEach(k => lefts.add(k.split(' | ')[0]));
                return Array.from(lefts).sort((a,b) => a.localeCompare(b));
              })();
              const measureKeys = [...labels, ...calcUser];
              const perCol = [];
              // Optional sparkline column for the first (primary) measure
              if (pivotSparkline && measureKeys.length > 0) {
                perCol.push('__sparkline__');
              }
              colKeyLabels.forEach(colLabel => {
                measureKeys.forEach(m => perCol.push(`${colLabel} | ${m}`));
                if (pivotConfig.percentRow) measureKeys.forEach(m => perCol.push(`${colLabel} | ${m} (% row)`));
              });
              const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
              return [...rowCols, ...perCol];
            })() : displayColumns).map((header, idx) => (
              <th
                key={`${header || 'col'}-${idx}`}
                draggable={!isPivotView}
                onDragStart={(e) => { if (isPivotView) return; e.dataTransfer.setData('text/plain', header); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (!isPivotView) e.preventDefault(); }}
                onDrop={(e) => {
                  if (isPivotView) return;
                  e.preventDefault();
                  const from = e.dataTransfer.getData('text/plain');
                  if (!from || from === header) return;
                  setColumnOrder((prev) => {
                    const order = prev && prev.length ? [...prev] : [...headers];
                    const vi = order.indexOf(from);
                    const ti = order.indexOf(header);
                    if (vi === -1 || ti === -1) return order;
                    order.splice(vi, 1);
                    order.splice(ti, 0, from);
                    return order;
                  });
                }}
                onClick={(e) => !isPivotView && handleSort(header, e.shiftKey)}
                style={{ position: 'sticky', top: 0, zIndex: (idx < freezeCount ? 3 : 2), border: "1px solid #ddd", padding: "5px 28px 5px 5px", backgroundColor: "#0e639c", color: "white", textAlign: "left", whiteSpace: "nowrap", cursor: isPivotView ? "default" : "pointer", userSelect: "none", width: (isVirtualized && !isPivotView) ? `${Math.round(((colWidths[header] || 150)) * vScale)}px` : (colWidths[header] ? `${colWidths[header]}px` : undefined), minWidth: (isVirtualized && !isPivotView) ? `${Math.round(((colWidths[header] || 150)) * vScale)}px` : (colWidths[header] ? `${colWidths[header]}px` : undefined), ...(idx < freezeCount && !isPivotView ? { left: `${(isVirtualized ? (indexColWidthScaled + (vFreezeLeftScaled[header] || 0)) : (freezeLeft[header] || 0))}px` } : {}) }}
              >
                <span onClick={(e) => {
                  if (!(e.ctrlKey || e.metaKey)) return;
                  setSelectedColumns(prev => { const s = new Set(prev); if (s.has(header)) s.delete(header); else s.add(header); return s; });
                }} style={{ cursor: 'default', userSelect: 'none' }}>{header === '__sparkline__' ? 'Sparkline' : header}{!isPivotView && renderSortIndicator(header)}</span>
                {!isPivotView && (
                  <span style={{ position: 'absolute', right: 4, top: 4 }}>
                    <button
                      type="button"
                      title="Filter values"
                      onClick={(e) => { e.stopPropagation(); setHeaderFilterOpenCol((c) => c === header ? null : header); }}
                      style={{ padding: '0 6px', height: 22, borderRadius: 4, border: '1px solid #1e5b86', background: headerFilterOpenCol === header ? '#114b6d' : '#0e639c', color: '#fff', cursor: 'pointer', ...(headerMenuDisabled ? disabledStyle : {}) }}
                    >▾</button>
                  </span>
                )}
                {/* Resize handle */}
                {!isPivotView && (
                  <span
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const th = e.currentTarget.parentElement;
                      const startW = th ? th.getBoundingClientRect().width : (colWidths[header] || 120);
                      resizeStateRef.current = { active: true, col: header, startX: e.clientX, startW };
                      const onMove = (ev) => {
                        if (!resizeStateRef.current.active) return;
                        const dx = ev.clientX - resizeStateRef.current.startX;
                        const w = Math.max(60, Math.round(resizeStateRef.current.startW + dx));
                        setColWidths((prev) => ({ ...prev, [resizeStateRef.current.col]: w }));
                      };
                      const onUp = () => {
                        resizeStateRef.current = { active: false, col: null, startX: 0, startW: 0 };
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                      };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                    style={{ position: 'absolute', right: 0, top: 0, width: 6, height: '100%', cursor: 'col-resize' }}
                    title="Drag to resize"
                  />
                )}
                {!isPivotView && headerFilterOpenCol === header && (
                  <div ref={el => (headerFilterMenuRef.current = el)} style={{ position: 'absolute', top: '100%', marginTop: 4, background: '#252526', border: '1px solid #444', borderRadius: 6, padding: 8, zIndex: 50, minWidth: 220, maxWidth: 320, maxHeight: 260, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', ...(idx === 0 ? { left: 0 } : { right: 0 }), ...(headerMenuDisabled ? disabledStyle : {}) }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ color: '#fff', fontWeight: 600, marginBottom: 6 }}>Filter: {header}</div>
                    {(() => {
                      // Distinct values: use server when serverMode is enabled; fallback to client sampling otherwise
                      let distinct = [];
                      if (serverMode) {
                        distinct = headerDistincts[header] || [];
                      } else {
                        const maxScanRaw = perfOptions && perfOptions.maxScan;
                        const maxDistinctRaw2 = perfOptions && perfOptions.maxDistinct;
                        const unlimitedScan = (maxScanRaw === 'full') || (Number(maxScanRaw) < 0);
                        const unlimitedDistinct = (maxDistinctRaw2 === 'full') || (Number(maxDistinctRaw2) < 0);
                        const maxScan = unlimitedScan ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(5000, Number(maxScanRaw) || 5000));
                        const maxDistinct = unlimitedDistinct ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(50, Number(maxDistinctRaw2) || 50));
                        const src = filteredData.length > maxScan ? filteredData.slice(0, maxScan) : filteredData;
                        const set = new Set();
                        for (let i = 0; i < src.length; i++) {
                          const v = String(src[i]?.[header] ?? '');
                          set.add(v);
                          if (set.size >= maxDistinct) break;
                        }
                        distinct = Array.from(set).sort((a,b) => a.localeCompare(b));
                      }

                      const selected = (headerFilterDraft && headerFilterDraft.col === header)
                        ? headerFilterDraft.selected
                        : (valueFilters[header] ?? null);
                      const isAll = (selected == null); // null/undefined => all selected (no filter)
                      const isChecked = (v) => isAll ? true : (selected || []).includes(v);
                      const updateDraft = (nextSelected) => {
                        const draft = { col: header, selected: nextSelected };
                        headerFilterDraftRef.current = draft;
                        setHeaderFilterDraft(draft);
                      };
                      const toggle = (v) => {
                        if (selected == null) {
                          // from all selected -> remove one
                          updateDraft(distinct.filter(x => x !== v));
                        } else {
                          const set = new Set(selected);
                          if (set.has(v)) set.delete(v); else set.add(v);
                          updateDraft(Array.from(set));
                        }
                      };
                      const selectAll = () => updateDraft(null);
                      const deselectAll = () => updateDraft([]);
                      const clearFilter = () => updateDraft(null);
                      return (
                        <div>
                          {serverMode && headerDistinctLoading && (
                            <div style={{ color: '#aaa', marginBottom: 6 }}>Loading values…</div>
                          )}
                          <div style={{ marginBottom: 6 }}>
                            <input
                              type="text"
                              value={headerDistinctTerm}
                              onChange={(e) => setHeaderDistinctTerm(e.target.value)}
                              placeholder="Search values…"
                              style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #444', background: '#1e1e1e', color: '#ddd' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                            <button type="button" onClick={selectAll} style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Select All</button>
                            <button type="button" onClick={deselectAll} style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Deselect All</button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(serverMode ? distinct : (headerDistinctTerm ? distinct.filter(v => String(v).toLowerCase().includes(headerDistinctTerm.toLowerCase())) : distinct)).map((v) => (
                              <label key={v} style={{ color: '#ddd', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={isChecked(v)} onChange={() => toggle(v)} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                              </label>
                            ))}
                            {distinct.length === 0 && !headerDistinctLoading && (
                              <div style={{ color: '#888', fontSize: '0.9rem' }}>No values</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                            <button type="button" onClick={clearFilter} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Clear</button>
                            <button type="button" onClick={() => setHeaderFilterOpenCol(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#0e639c', color: '#fff', cursor: 'pointer' }}>Close</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isVirtualized && !isPivotView ? null : (() => {
            // Determine headers and rows to render (apply pivot collapse/hide)
            const measuresH = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
            const funcsH = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
            const labelsH = [];
            for (const m of measuresH) for (const f of funcsH) labelsH.push(`${m} (${f})`);
            if (isPivotView && labelsH.length === 0) return null;
            const extraH = [];
            if (pivotConfig.calcPctTotal) extraH.push(...labelsH.map(l => `${l} (% total)`));
            if (pivotConfig.calcPctParent) extraH.push(...labelsH.map(l => `${l} (% parent)`));
            if (pivotConfig.calcRank) extraH.push(`${labelsH[0]} (Rank)`);
            if (pivotConfig.calcRunning) extraH.push(`${labelsH[0]} (Running)`);
            const calcUserH = (pivotCalcMeasures || []).filter(cm => cm && cm.enabled !== false && cm.name).map(cm => cm.name);
            const colAxis = Array.isArray(pivotConfig.colAxis) ? pivotConfig.colAxis.filter(Boolean) : [];
            let rowHeaders;
            if (!isPivotView) {
              rowHeaders = displayColumns;
            } else if (colAxis.length === 0) {
              const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
              rowHeaders = [...rowCols, ...labelsH, ...extraH, ...calcUserH];
            } else {
              // Build per-column headers based on keys present in the data (not a specific row)
              const measureKeys = [...labelsH, ...calcUserH];
              let colKeyLabels = (() => {
                const set = new Set();
                const rowsScan = paginatedData.length ? paginatedData : pivotedData;
                rowsScan.forEach(r => {
                  Object.keys(r).forEach(k => {
                    if (k.includes(' | ') && !pivotConfig.columns.includes(k)) set.add(k.split(' | ')[0]);
                  });
                });
                const arr = Array.from(set);
                arr.sort((a,b) => a.localeCompare(b));
                return arr;
              })();
              const perCol = [];
              if (pivotSparkline && (labelsH.length + calcUserH.length) > 0) perCol.push('__sparkline__');
              colKeyLabels.forEach(colLabel => {
                measureKeys.forEach(m => perCol.push(`${colLabel} | ${m}`));
                if (pivotConfig.percentRow) measureKeys.forEach(m => perCol.push(`${colLabel} | ${m} (% row)`));
              });
              const rowCols = (pivotConfig.rowLabelsMode === 'single') ? ['Row Labels'] : [...pivotConfig.columns];
              rowHeaders = [...rowCols, ...perCol];
            }

            const collapsedKeys = pivotCollapsed;
            const shouldHide = (r) => {
              if (!isPivotView) return false;
              if (!r || !r._isSubtotal) return false;
              if (pivotConfig.showSubtotals === false && !r._isGrandTotal) return true;
              for (const key of Array.from(collapsedKeys)) {
                try {
                  const obj = JSON.parse(key);
                  const lv = obj.level;
                  const gk = obj.gk || {};
                  if (r._level != null && r._level > lv) {
                    let match = true;
                    for (const k of Object.keys(gk)) {
                      if (String(r._groupKey?.[k] ?? '') !== String(gk[k] ?? '')) { match = false; break; }
                    }
                    if (match) return true;
                  }
                } catch {}
              }
              return false;
            };
            const rowsToRender = isPivotView ? paginatedData.filter(r => !shouldHide(r)) : paginatedData;

            return rowsToRender.map((row, rowIndex) => {
            const measuresH = (pivotConfig.measures && pivotConfig.measures.length) ? pivotConfig.measures : (pivotConfig.aggColumn ? [pivotConfig.aggColumn] : []);
            const funcsH = (pivotConfig.funcs && pivotConfig.funcs.length) ? pivotConfig.funcs : (pivotConfig.aggFunc ? [pivotConfig.aggFunc] : ['sum']);
            const labelsH = [];
            for (const m of measuresH) for (const f of funcsH) labelsH.push(`${m} (${f})`);
            if (isPivotView && labelsH.length === 0) return null;
            const extraH = [];
            if (pivotConfig.calcPctTotal) extraH.push(...labelsH.map(l => `${l} (% total)`));
            if (pivotConfig.calcPctParent) extraH.push(...labelsH.map(l => `${l} (% parent)`));
            if (pivotConfig.calcRank) extraH.push(`${labelsH[0]} (Rank)`);
            if (pivotConfig.calcRunning) extraH.push(`${labelsH[0]} (Running)`);
            // Use headers computed above for this body render
            const rowHeadersLocal = rowHeaders;
            const isSubtotal = row._isSubtotal;
            const isGrandTotal = row._isGrandTotal;
            return (
              <tr role="row"
                key={rowIndex}
                style={{
                  fontWeight: isGrandTotal ? 'bold' : isSubtotal ? 600 : 'normal',
                  backgroundColor: isGrandTotal ? (pivotStyle.grandBg || '#1f1f1f') : isSubtotal ? (pivotStyle.subtotalBg || '#2d2d2d') : 'inherit',
                  color: isGrandTotal ? (pivotStyle.grandText || '#fff') : isSubtotal ? (pivotStyle.subtotalText || 'inherit') : 'inherit',
                }}
                onClick={() => {
                  if (!isPivotView) return;
                  if (!(isSubtotal || isGrandTotal)) return;
                  // Drill-through rows
                  const match = (r) => {
                    if (!row._groupKey) return true;
                    for (const k of Object.keys(row._groupKey)) {
                      if (String(r[k] ?? '') !== String(row._groupKey[k] ?? '')) return false;
                    }
                    return true;
                  };
                  setDrillRows(withDerivedAndBuckets.filter(match));
                  setShowDrill(true);
                }}
              >
                {/* selection checkbox cell removed */}
                {rowHeadersLocal.map((header, i) => (
                  <td role="gridcell"
                    key={`${rowIndex}-${header}`}
                    style={{
                      border: '1px solid #ddd',
                      padding: '5px',
                      paddingLeft: (isPivotView && isSubtotal && ((pivotConfig.rowLabelsMode === 'single' && i === 0) || (pivotConfig.rowLabelsMode !== 'single' && i === row._level))) ? `${(row._level + 1) * 16}px` : '5px',
                      textAlign: isPivotView ? (((pivotConfig.rowLabelsMode === 'single' && i === 0) || pivotConfig.columns.includes(header)) ? 'left' : 'right') : (numericCols.has(header) ? 'right' : 'left'),
                      whiteSpace: 'nowrap',
                      ...(isPivotView ? {} : (getConditionalStyle(header === 'Row Labels' ? '__row_label__' : header, row[header === 'Row Labels' ? '__row_label__' : header]) || {})),
                      width: colWidths[header] ? `${colWidths[header]}px` : undefined,
                      minWidth: colWidths[header] ? `${colWidths[header]}px` : undefined,
                      ...(i < freezeCount && !isPivotView ? { position: 'sticky', left: `${freezeLeft[header] || 0}px`, zIndex: isGrandTotal || isSubtotal ? 2 : 1, background: isGrandTotal ? '#1f1f1f' : isSubtotal ? '#2d2d2d' : (getConditionalStyle(header, row[header])?.backgroundColor ? undefined : '#111') } : {}),
                    }}
                    title={!isPivotView ? 'Ctrl/Cmd+Click to filter by this value' : 'Ctrl/Cmd+Click to multi-select'}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        const raw = row[header];
                        setSelectedValuesByCol(prev => { const p = { ...prev }; const key = String(header); const set = new Set(p[key] ? Array.from(p[key]) : []); const v = String(raw ?? ''); if (set.has(v)) set.delete(v); else set.add(v); p[key] = set; return p; });
                        return;
                      }
                      if (!isPivotView) {
                        const raw = row[header];
                        const isNum = numericCols.has(header);
                        const op = isNum ? '=' : 'equals';
                        setColFilters(prev => ({ ...prev, [header]: { op, value: raw } }));
                        setCurrentPage(1);
                      }
                    }}
                    onDoubleClick={() => {
                      const cellVal = row[header];
                      const groupKey = isPivotView ? (row._groupKey || null) : null;
                      openDrillForCell({ column: header, value: cellVal, groupKey });
                    }}
                  >
                    {(() => {
                      const keyFor = (h) => (h === 'Row Labels' ? '__row_label__' : h);
                      let cellVal = row[keyFor(header)];
                      // For grand/subtotal rows, ensure row labels appear in the Row Labels column
                      if (cellVal === undefined && isPivotView && isSubtotal && pivotConfig.rowLabelsMode === 'single' && header === 'Row Labels') {
                        cellVal = row['__row_label__'];
                      }
                      if (cellVal === undefined && isPivotView && isSubtotal) {
                        // Fallback to original key if mapping didn't hit
                        cellVal = row[header];
                      }
                      const rawText = (typeof cellVal === 'object') ? renderCell(cellVal) : String(formatValue(header, cellVal));
                      const text = rawText.length > maxClob ? rawText.slice(0, maxClob) + '…' : rawText;
                      if (isPivotView && isSubtotal && ((pivotConfig.rowLabelsMode === 'single' && i === 0) || (pivotConfig.rowLabelsMode !== 'single' && i === row._level)) && !isGrandTotal) {
                        const keyObj = { level: row._level, gk: row._groupKey || {} };
                        const k = JSON.stringify(keyObj);
                        const collapsed = pivotCollapsed.has(k);
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              aria-expanded={!collapsed}
                              title={collapsed ? 'Expand' : 'Collapse'}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPivotCollapsed(prev => { const s = new Set(prev); if (s.has(k)) s.delete(k); else s.add(k); return s; });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowLeft' && !pivotCollapsed.has(k)) setPivotCollapsed(prev => { const s = new Set(prev); s.add(k); return s; });
                                if (e.key === 'ArrowRight' && pivotCollapsed.has(k)) setPivotCollapsed(prev => { const s = new Set(prev); s.delete(k); return s; });
                              }}
                              style={{ padding: '0 6px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}
                            >{collapsed ? '▸' : '▾'}</button>
                            <span>{text}</span>
                          </span>
                        );
                      }
                      if (isPivotView && isSubtotal && i === row._level && pivotStyle.subtotalNewline) {
                        // Split 'Value (Subtotal)' into two lines if present
                        const m = text.match(/^(.*) \(Subtotal\)$/);
                        if (m) {
                          return (
                            <span>
                              <div>{m[1]}</div>
                              <div style={{ fontSize: Math.max(10, fontSize - 2), opacity: 0.9 }}>Subtotal</div>
                            </span>
                          );
                        }
                      }
                      return (
                        <CollapsibleCell text={rawText} collapseChars={collapseChars} isVirtualized={false} fontSize={fontSize} />
                      );
                    })()}
                  </td>
                ))}
              </tr>
            );
          }); })()}
        </tbody>
        {!isPivotView && showSummary && (
          <tfoot>
            <tr style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
              {displayColumns.map((h) => {
                if (!numericCols.has(h)) return (
                  <td key={`sum-${h}`} style={{ border: '1px solid #ddd', padding: '5px', background: '#1f1f1f', color: '#ddd' }} />
                );
                const rows = sortedData; // summarize over all filtered rows, not just page
                const nums = rows.map(r => Number(r[h])).filter((v) => isFinite(v));
                const count = nums.length;
                const sum = nums.reduce((a, b) => a + b, 0);
                const avg = count ? sum / count : 0;
                const fmt = (n) => {
                  if (!isFinite(n)) return '';
                  const abs = Math.abs(n);
                  if (abs >= 1e6) return (n/1e6).toFixed(2) + 'M';
                  if (abs >= 1e3) return (n/1e3).toFixed(2) + 'k';
                  return Number(n.toFixed(2)).toString();
                };
                return (
                  <td key={`sum-${h}`} style={{ border: '1px solid #ddd', padding: '5px', background: '#1f1f1f', color: '#fff', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    Σ {fmt(sum)} · μ {fmt(avg)} · n {count}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
      {isVirtualized && !isPivotView && (
        <div style={{
          marginTop: 0,
          border: '1px solid #333',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          overflow: 'visible',
          background: '#111',
          width: '100%'
        }}>
          {(() => {
            const rows = serverMode ? ((serverAllRows && Array.isArray(serverAllRows)) ? serverAllRows : (serverRowsWithDerived || [])) : sortedData;
            const rowH = Math.max(18, Math.min(80, Number(virtualRowHeight) || 28));
            const viewportH = Math.max(200, Math.min((typeof window !== 'undefined' ? window.innerHeight - 260 : 600), rows.length * rowH));
            const contentWidth = viewportWidth ? Math.max(viewportWidth, vTotalWidth + indexColWidth) : null;
            return (
              <div style={{ width: contentWidth ? `${contentWidth}px` : '100%', overflow: 'visible' }}>
                <style>
                  {`
                  /* Hide inner horizontal scrollbar from react-window list; parent handles it */
                  .veda-virtual-list { overflow-x: hidden !important; }
                  .veda-virtual-list::-webkit-scrollbar:horizontal { display: none; }
                  `}
                </style>
                {/* Virtualized body */}
                <VList
                  ref={vlistRef}
                  className="veda-virtual-list"
                  height={viewportH}
                  itemCount={rows.length}
                  itemSize={rowH}
                  width={contentWidth || '100%'}
                  overscanCount={8}
                >
                  {({ index, style }) => {
                    const row = rows[index];
                    const isFirstRow = index === 0;
                    return (
                      <div
                        key={index}
                        style={{ ...style, display: 'grid', gridTemplateColumns: (viewportWidth ? vGridTemplateScaledWithIndex : vGridTemplateWithIndex), borderBottom: '1px solid #ddd', alignItems: 'stretch' }}
                      >
                        {/* Index column */}
                        <div
                          style={{
                            borderRight: '1px solid #ddd',
                            borderBottom: '1px solid #ddd',
                            ...(isFirstRow ? { borderTop: '1px solid #ddd' } : {}),
                            padding: '5px',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            textAlign: 'right',
                            background: '#111',
                            color: '#ddd',
                            boxSizing: 'border-box',
                            position: 'sticky',
                            left: 0,
                            zIndex: 2
                          }}
                        >{index + 1}</div>
                        {vCols.map((header, i) => {
                          const val = row[header];
                          const align = numericCols.has(header) ? 'right' : 'left';
                          const baseStyle = {
                            borderRight: '1px solid #ddd',
                            padding: '5px',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            textAlign: align,
                            background: '#111',
                            color: '#ddd',
                            boxSizing: 'border-box'
                          };
                          const cond = getConditionalStyle(header, val) || {};
                          return (
                            <div
                              key={`${index}-${header}`}
                              style={{
                                ...baseStyle,
                                ...cond,
                                ...(i < freezeCount ? { position: 'sticky', left: `${(indexColWidthScaled + (vFreezeLeftScaled[header] || 0))}px`, zIndex: 1, background: (cond.backgroundColor ? cond.backgroundColor : '#111') } : {})
                              }}
                              title={String(val ?? '')}
                              onClick={(e) => {
                                if (!(e.ctrlKey || e.metaKey)) return;
                                const raw = row[header];
                                const isNum = numericCols.has(header);
                                const op = isNum ? '=' : 'equals';
                                setColFilters(prev => ({ ...prev, [header]: { op, value: raw } }));
                                setCurrentPage(1);
                              }}
                              onDoubleClick={() => {
                                const cellVal = row[header];
                                openDrillForCell({ column: header, value: cellVal });
                              }}
                            >
                              {(() => {
                                const rawText = (typeof val === 'object') ? renderCell(val) : String(formatValue(header, val));
                                return (
                                  <CollapsibleCell text={rawText} collapseChars={collapseChars} isVirtualized={true} fontSize={fontSize} />
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                </VList>
              </div>
            );
          })()}
        </div>
      )}
      </div>
      )}

      {/* Pagination + Footer */}
      <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", ...((paginationDisabled && !dashboardMode) ? disabledStyle : {}), ...(isVirtualized && !dashboardMode ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}>
        <button type="button" style={linkButtonStyle} onClick={() => goToPage(1)} disabled={paginationDisabled || currentPage === 1}>First</button>
        <button type="button" style={linkButtonStyle} onClick={() => goToPage(currentPage - 1)} disabled={paginationDisabled || currentPage === 1}>Prev</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button type="button" style={linkButtonStyle} onClick={() => goToPage(currentPage + 1)} disabled={paginationDisabled || currentPage === totalPages}>Next</button>
        <button type="button" style={linkButtonStyle} onClick={() => goToPage(totalPages)} disabled={paginationDisabled || currentPage === totalPages}>Last</button>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          Rows per page:
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            disabled={dashboardMode || paginationDisabled}
            style={{ padding: "2px 4px", borderRadius: 4, fontSize: `${fontSize}px`, ...((dashboardMode || paginationDisabled) ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
          >
            {[5, 10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      {(() => {
        const baseCount = Array.isArray(data) ? data.length : 0; // rows loaded in UI before table filters/search
        const filteredCount = sourceRows.length; // after filters/search
        const effectiveTotal = Number.isFinite(totalRows) && totalRows > 0 ? totalRows : filteredCount;
        const reduced = Math.max(0, baseCount - filteredCount);
        const reducedPct = baseCount > 0 ? Math.round((reduced / baseCount) * 100) : 0;

        const parts = [];
        if (isVirtualized && !isPivotView) {
          parts.push(`Showing ${filteredCount} of ${effectiveTotal} rows`);
        } else {
          parts.push(`Showing ${paginatedData.length} of ${effectiveTotal} rows`);
          parts.push(`page ${currentPage}/${totalPages}`);
        }
        if (effectiveTotal > baseCount) parts.push(`loaded ${baseCount} in UI. Use Maximise button to see full dataset`);
        if (serverMode && serverCached != null) parts.push(serverCached ? 'Cached' : 'Fresh');
        const summary = parts.join(' • ');

        // Count active filters/search for clarity
        const colFilterCount = Object.keys(colFilters || {}).filter((c) => {
          const f = colFilters[c];
          if (!f || !f.op) return false;
          return (f.op === 'isEmpty' || f.op === 'notEmpty' || (f.value != null && String(f.value).length > 0));
        }).length;
        const valueFilterCount = Object.keys(valueFilters || {}).filter((c) => Array.isArray(valueFilters[c]) && valueFilters[c].length > 0).length;
        const advFilterCount = (advFilters || []).length;
        const searchActive = !!searchQuery;
        const totalFilters = colFilterCount + valueFilterCount + advFilterCount + (searchActive ? 1 : 0);

        return (
          <div style={{ marginTop: 6 }}>
            <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0 }}>{summary}</p>
            {totalFilters > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#bbb', marginTop: 2 }}>
                Filters: {totalFilters} • From {baseCount} to {filteredCount}{baseCount > 0 ? ` (−${reducedPct}%)` : ''}{searchActive ? ` • search: "${searchQuery}"` : ''}
              </div>
            )}
            {effectiveTotal > baseCount && (
              <div style={{ fontSize: '0.85rem', color: '#bbb', marginTop: 2 }}>
                {/* UI shows a capped subset for performance. Use Export to download the full dataset. */}
              </div>
            )}
          </div>
        );
      })()}
      {!dashboardMode && perm.export && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={() => exportData('csv')} style={{ padding: '4px 8px', borderRadius: 4, border: "1px solid #444", background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Export CSV</button>
          <button type="button" onClick={() => exportData('json')} style={{ padding: '4px 8px', borderRadius: 4, border: "1px solid #444", background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Export JSON</button>
          <button type="button" onClick={exportXlsx} style={{ padding: '4px 8px', borderRadius: 4, border: "1px solid #444", background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Export XLSX</button>
          <button type="button" onClick={exportPdf} style={{ padding: '4px 8px', borderRadius: 4, border: "1px solid #444", background: '#2d2d2d', color: '#fff', cursor: 'pointer' }}>Export PDF</button>
        </div>
      )}
    </div>
  );
});

export default TableComponent;
