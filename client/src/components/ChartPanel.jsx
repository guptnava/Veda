import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bar, Line, Pie, Chart as ReactChart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import * as htmlToImage from 'html-to-image';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, MatrixController, MatrixElement);

const ChartPanel = ({
  headers = [],
  rows = [],
  disabled = false,
  initialVisible = false,
  controlsInParent = false,
  showPicker,
  setShowPicker,
  visible,
  setVisible,
  onCrossFilter,
}) => {
  const [localShowChartPicker, setLocalShowChartPicker] = useState(false);
  const [localIsChartVisible, setLocalIsChartVisible] = useState(initialVisible);
  const effectiveShowPicker =
    controlsInParent && typeof showPicker === 'boolean' ? showPicker : localShowChartPicker;
  const effectiveVisible =
    controlsInParent && typeof visible === 'boolean' ? visible : localIsChartVisible;
  const [chartType, setChartType] = useState('bar');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState(''); // used for pie
  const [yColumns, setYColumns] = useState([]); // multiple series for bar/line
  const [chartAgg, setChartAgg] = useState('sum'); // sum | avg | count
  const [stacked, setStacked] = useState(false); // for bar charts
  const [sortBy, setSortBy] = useState('label'); // 'label' | 'total'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [topN, setTopN] = useState(''); // '' or number
  const [legendPos, setLegendPos] = useState('top');
  // Advanced options
  const [dateBucket, setDateBucket] = useState('none'); // none|day|week|month|quarter|year
  const [trendline, setTrendline] = useState(false);
  const [movingAvg, setMovingAvg] = useState(false);
  const [maWindow, setMaWindow] = useState(7);
  const [yRight, setYRight] = useState([]); // which series go to right axis
  const [histCol, setHistCol] = useState('');
  const [histBins, setHistBins] = useState(10);
  const [yFormat, setYFormat] = useState('default'); // default|number|thousands|percent|currency|compact
  const [y1Format, setY1Format] = useState('default');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [yPrecision, setYPrecision] = useState(2);
  // Heatmap and Box/Violin specific
  const [heatYCat, setHeatYCat] = useState('');

  const chartDropdownRef = useRef(null);
  const chartPanelRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (chartDropdownRef.current && !chartDropdownRef.current.contains(e.target)) {
        if (controlsInParent && setShowPicker) setShowPicker(false);
        else setLocalShowChartPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [controlsInParent, setShowPicker]);

  const effectiveHeaders = useMemo(() => {
    if (headers && headers.length) return headers;
    if (rows && rows.length) return Object.keys(rows[0]);
    return [];
  }, [headers, rows]);

  const numericCols = useMemo(() => {
    const set = new Set();
    const sample = rows.slice(0, 50);
    effectiveHeaders.forEach((h) => {
      const vals = sample.map(r => r?.[h]).filter(v => v !== undefined && v !== null && v !== '');
      if (vals.length && vals.every(v => typeof v === 'number' || (!isNaN(Number(v)) && isFinite(Number(v))))) {
        set.add(h);
      }
    });
    return set;
  }, [effectiveHeaders, rows]);

  const isDateLike = (val) => {
    if (val == null) return false;
    const t = typeof val === 'number' ? new Date(val) : new Date(String(val));
    return !isNaN(t.getTime());
  };
  const bucketDate = (val) => {
    const d = new Date(val);
    if (dateBucket === 'day') return d.toISOString().slice(0,10);
    if (dateBucket === 'week') {
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const day = dt.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day; // Monday-start
      dt.setUTCDate(dt.getUTCDate() + diff);
      return dt.toISOString().slice(0,10) + ' (wk)';
    }
    if (dateBucket === 'month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    if (dateBucket === 'quarter') return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth()/3)+1}`;
    if (dateBucket === 'year') return String(d.getUTCFullYear());
    return String(val);
  };

  const chartConfig = useMemo(() => {
    if (disabled) return null;
    if (!xColumn && chartType !== 'hist') return null;

    const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab'];

    if (chartType === 'pie') {
      // Single-series pie
      const groups = new Map();
      for (const r of rows) {
        const raw = r?.[xColumn];
        const key = (dateBucket !== 'none' && isDateLike(raw)) ? bucketDate(raw) : String(raw ?? '');
        const agg = groups.get(key) || { count: 0, sum: 0, values: [] };
        const yVal = Number(r?.[yColumn]);
        if (!isNaN(yVal)) {
          agg.sum += yVal;
          agg.values.push(yVal);
        }
        agg.count += 1;
        groups.set(key, agg);
      }
      let labels = Array.from(groups.keys());
      let dataValues;
      if (!yColumn) {
        dataValues = labels.map(k => groups.get(k).count);
      } else if (chartAgg === 'sum') {
        dataValues = labels.map(k => groups.get(k).sum);
      } else if (chartAgg === 'avg') {
        dataValues = labels.map(k => {
          const g = groups.get(k);
          return g.values.length ? g.sum / g.values.length : 0;
        });
      } else {
        dataValues = labels.map(k => groups.get(k).count);
      }
      // sort and topN (use values)
      const idx = labels.map((_, i) => i);
      idx.sort((a,b) => sortDir === 'asc' ? (dataValues[a] - dataValues[b]) : (dataValues[b] - dataValues[a]));
      if (sortBy === 'label') {
        idx.sort((a,b) => sortDir === 'asc' ? String(labels[a]).localeCompare(String(labels[b])) : String(labels[b]).localeCompare(String(labels[a])));
      }
      let sortedLabels = idx.map(i => labels[i]);
      let sortedValues = idx.map(i => dataValues[i]);
      const n = Number(topN) || 0;
      if (n > 0) {
        sortedLabels = sortedLabels.slice(0, n);
        sortedValues = sortedValues.slice(0, n);
      }
      const data = {
        labels: sortedLabels,
        datasets: [{
          label: `${yColumn || 'Count'} (${chartAgg}) by ${xColumn}`,
          data: sortedValues,
          backgroundColor: sortedLabels.map((_, i) => palette[i % palette.length]),
          borderColor: '#444',
        }],
      };
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: legendPos }, tooltip: { enabled: true } },
      };
      return { data, options };
    }

    // Histogram
    if (chartType === 'hist') {
      const col = histCol || (yColumns[0] || Array.from(numericCols)[0]);
      if (!col) return null;
      const vals = rows.map(r => Number(r?.[col])).filter(v => isFinite(v));
      if (!vals.length) return null;
      const min = Math.min(...vals), max = Math.max(...vals);
      const bins = Math.max(1, Number(histBins) || 10);
      const width = (max - min) / bins || 1;
      const edges = Array.from({ length: bins+1 }, (_, i) => min + i*width);
      const counts = Array.from({ length: bins }, () => 0);
      for (const v of vals) {
        let idx = Math.floor((v - min) / width);
        if (idx >= bins) idx = bins - 1;
        if (idx < 0) idx = 0;
        counts[idx]++;
      }
      const labels = counts.map((_, i) => `${edges[i].toFixed(2)}–${edges[i+1].toFixed(2)}`);
      const data = { labels, datasets: [{ label: `${col} histogram`, data: counts, backgroundColor: palette[0] }] };
      const options = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true, position: legendPos } } };
      return { data, options };
    }

    // Heatmap (matrix)
    if (chartType === 'heatmap') {
      const xCol = xColumn;
      const yCol = heatYCat || effectiveHeaders.find(h => !numericCols.has(h) && h !== xCol) || '';
      const meas = yColumn || Array.from(numericCols)[0];
      if (!xCol || !yCol || !meas) return null;
      const xCats = Array.from(new Set(rows.map(r => {
        const raw = r?.[xCol];
        return (dateBucket !== 'none' && isDateLike(raw)) ? bucketDate(raw) : String(raw ?? '');
      })));
      const yCats = Array.from(new Set(rows.map(r => String(r?.[yCol] ?? ''))));
      const idxX = new Map(xCats.map((c, i) => [c, i]));
      const idxY = new Map(yCats.map((c, i) => [c, i]));
      const grid = Array.from({ length: yCats.length }, () => Array(xCats.length).fill(0));
      const counts = Array.from({ length: yCats.length }, () => Array(xCats.length).fill(0));
      for (const r of rows) {
        const rawX = r?.[xCol];
        const xx = (dateBucket !== 'none' && isDateLike(rawX)) ? bucketDate(rawX) : String(rawX ?? '');
        const yy = String(r?.[yCol] ?? '');
        const xi = idxX.get(xx); const yi = idxY.get(yy);
        if (xi == null || yi == null) continue;
        const v = Number(r?.[meas]);
        if (!isNaN(v)) { grid[yi][xi] += v; counts[yi][xi] += 1; }
        else { counts[yi][xi] += 1; }
      }
      const values = [];
      for (let yi = 0; yi < yCats.length; yi++) {
        for (let xi = 0; xi < xCats.length; xi++) {
          const sum = grid[yi][xi];
          const cnt = counts[yi][xi];
          const val = chartAgg === 'avg' ? (cnt ? sum / cnt : 0) : (chartAgg === 'count' ? cnt : sum);
          values.push(val);
        }
      }
      const vMin = Math.min(...values), vMax = Math.max(...values);
      const colorFor = (v) => {
        const t = (vMax === vMin) ? 0 : (v - vMin) / (vMax - vMin);
        const r = Math.round(30 + t * 170);
        const g = Math.round(60 + t * 0);
        const b = Math.round(160 - t * 110);
        return `rgb(${r},${g},${b})`;
      };
      const dataPoints = [];
      for (let yi = 0; yi < yCats.length; yi++) {
        for (let xi = 0; xi < xCats.length; xi++) {
          const sum = grid[yi][xi];
          const cnt = counts[yi][xi];
          const v = chartAgg === 'avg' ? (cnt ? sum / cnt : 0) : (chartAgg === 'count' ? cnt : sum);
          dataPoints.push({ x: xCats[xi], y: yCats[yi], v });
        }
      }
      const data = { datasets: [{ label: `${meas} (${chartAgg})`, data: dataPoints, backgroundColor: (ctx) => colorFor(ctx.raw.v), width: ({ chart }) => (chart.chartArea ? (chart.chartArea.width / Math.max(1, xCats.length)) - 2 : 18), height: ({ chart }) => (chart.chartArea ? (chart.chartArea.height / Math.max(1, yCats.length)) - 2 : 18) }] };
      const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: legendPos } }, scales: { x: { type: 'category', labels: xCats }, y: { type: 'category', labels: yCats, reverse: true } } };
      return { data, options, meta: { type: 'matrix', heat: { xCol, yCol } } };
    }

    // Scatter: use raw points
    if (chartType === 'scatter') {
      const y = (yColumns && yColumns.length) ? yColumns[0] : (Array.from(numericCols)[0]);
      if (!xColumn || !y) return null;
      const pts = rows.map(r => ({ x: Number(r?.[xColumn]), y: Number(r?.[y]) })).filter(p => isFinite(p.x) && isFinite(p.y));
      if (!pts.length) return null;
      const data = { datasets: [{ label: `${y} vs ${xColumn}`, data: pts, showLine: false, pointBackgroundColor: '#4e79a7', borderColor: '#4e79a7' }] };
      // Trendline for scatter
      if (trendline && pts.length > 1) {
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const n = xs.length;
        const sx = xs.reduce((a,b)=>a+b,0);
        const sy = ys.reduce((a,b)=>a+b,0);
        const sxy = xs.reduce((a,_,i)=>a+xs[i]*ys[i],0);
        const sxx = xs.reduce((a,x)=>a+x*x,0);
        const m = (n*sxy - sx*sy) / Math.max(1,(n*sxx - sx*sx));
        const b = (sy - m*sx) / n;
        const xMin = Math.min(...xs), xMax = Math.max(...xs);
        const trend = [{ x: xMin, y: m*xMin + b }, { x: xMax, y: m*xMax + b }];
        data.datasets.push({ label: `${y} (trend)`, data: trend, borderColor: '#aaa', pointRadius: 0, showLine: true });
      }
      const options = { responsive: true, maintainAspectRatio: false, parsing: { xAxisKey: 'x', yAxisKey: 'y' }, scales: { x: { type: 'linear' }, y: { beginAtZero: true } }, plugins: { legend: { display: true, position: legendPos } } };
      return { data, options };
    }

    // Bar/Line/Area with multiple series
    const series = (yColumns && yColumns.length) ? yColumns : (numericCols.size ? [Array.from(numericCols)[0]] : []);
    if (!series.length) return null;

    // Build groups per series
    const labelSet = new Set(rows.map(r => {
      const raw = r?.[xColumn];
      return (dateBucket !== 'none' && isDateLike(raw)) ? bucketDate(raw) : String(raw ?? '');
    }));
    let labels = Array.from(labelSet);

    const seriesAgg = series.map(y => {
      const gmap = new Map();
      for (const r of rows) {
        const raw = r?.[xColumn];
        const key = (dateBucket !== 'none' && isDateLike(raw)) ? bucketDate(raw) : String(raw ?? '');
        const prev = gmap.get(key) || { sum: 0, count: 0 };
        const val = Number(r?.[y]);
        if (!isNaN(val)) {
          prev.sum += val;
          prev.count += 1;
        } else if (chartAgg === 'count') {
          // count rows regardless of numeric, if desired
          prev.count += 1;
        }
        gmap.set(key, prev);
      }
      return { y, gmap };
    });

    // Build values matrices aligned to labels
    let datasets = seriesAgg.map((s, idx) => {
      const data = labels.map(l => {
        const g = s.gmap.get(l) || { sum: 0, count: 0 };
        if (chartAgg === 'sum') return g.sum;
        if (chartAgg === 'avg') return g.count ? g.sum / g.count : 0;
        return g.count;
      });
      return {
        label: `${s.y} (${chartAgg})`,
        data,
        backgroundColor: palette[idx % palette.length],
        borderColor: palette[idx % palette.length],
        fill: chartType === 'area',
        yAxisID: yRight.includes(s.y) ? 'y1' : 'y',
      };
    });

    // Sort labels and data
    const totals = labels.map((_, i) => datasets.reduce((acc, ds) => acc + (Number(ds.data[i]) || 0), 0));
    let order = labels.map((_, i) => i);
    if (sortBy === 'label') {
      order.sort((a,b) => sortDir === 'asc' ? String(labels[a]).localeCompare(String(labels[b])) : String(labels[b]).localeCompare(String(labels[a])));
    } else {
      order.sort((a,b) => sortDir === 'asc' ? (totals[a] - totals[b]) : (totals[b] - totals[a]));
    }
    const n = Number(topN) || 0;
    if (n > 0) order = order.slice(0, n);
    labels = order.map(i => labels[i]);
    datasets = datasets.map(ds => ({ ...ds, data: order.map(i => ds.data[i]) }));

    // Trendline / Moving average for first series (line/area) or scatter (handled later)
    if ((chartType === 'line' || chartType === 'area') && datasets.length) {
      const base = datasets[0];
      const toNum = (x) => {
        if (dateBucket !== 'none') return (new Date(x)).getTime();
        const n = Number(x); return isFinite(n) ? n : labels.indexOf(x);
      };
      const xs = labels.map(l => toNum(l));
      const ys = base.data.map(v => Number(v) || 0);
      if (trendline && xs.length > 1) {
        const n = xs.length;
        const sx = xs.reduce((a,b)=>a+b,0);
        const sy = ys.reduce((a,b)=>a+b,0);
        const sxy = xs.reduce((a,_,i)=>a+xs[i]*ys[i],0);
        const sxx = xs.reduce((a,x)=>a+x*x,0);
        const m = (n*sxy - sx*sy) / Math.max(1,(n*sxx - sx*sx));
        const b = (sy - m*sx) / n;
        const trend = xs.map(x => m*x + b);
        datasets.push({ label: `${base.label} (trend)`, data: trend, borderColor: '#aaa', backgroundColor: 'transparent', borderDash: [6,4], pointRadius: 0, fill: false, yAxisID: base.yAxisID });
      }
      if (movingAvg && maWindow > 1) {
        const w = Math.max(1, Math.floor(maWindow));
        const ma = ys.map((_, i) => {
          const start = Math.max(0, i - w + 1);
          const slice = ys.slice(start, i+1);
          return slice.reduce((a,b)=>a+b,0) / slice.length;
        });
        datasets.push({ label: `${base.label} (MA${w})`, data: ma, borderColor: '#ccc', backgroundColor: 'transparent', pointRadius: 0, fill: false, yAxisID: base.yAxisID });
      }
    }

    const data = { labels, datasets };
    const formatTick = (v, fmt) => {
      const num = Number(v);
      if (!isFinite(num)) return v;
      const prec = Math.max(0, Math.min(6, Number(yPrecision) || 0));
      switch (fmt) {
        case 'number': return new Intl.NumberFormat(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
        case 'thousands': return new Intl.NumberFormat(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec, useGrouping: true }).format(num);
        case 'compact': return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: prec }).format(num);
        case 'percent': return new Intl.NumberFormat(undefined, { style: 'percent', minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
        case 'currency': return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode || 'USD', minimumFractionDigits: prec, maximumFractionDigits: prec }).format(num);
        default: return num;
      }
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: legendPos }, tooltip: { enabled: true } },
      scales: chartType === 'bar'
        ? {
            x: { stacked },
            y: { stacked, beginAtZero: true, ticks: { callback: (v) => formatTick(v, yFormat) } },
            y1: { stacked, beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: (v) => formatTick(v, y1Format) } },
          }
        : {
            y: { beginAtZero: true, ticks: { callback: (v) => formatTick(v, yFormat) } },
            y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: (v) => formatTick(v, y1Format) } },
          },
    };
    return { data, options };
  }, [disabled, rows, xColumn, yColumn, yColumns, chartAgg, chartType, stacked, sortBy, sortDir, topN, legendPos, numericCols, dateBucket, trendline, movingAvg, maWindow, yRight, histCol, histBins]);

  // Auto-pick sensible defaults so the chart isn't empty
  useEffect(() => {
    if (!effectiveHeaders.length || !rows.length) return;
    if (!xColumn && chartType !== 'hist') {
      // Prefer first non-numeric column for X; fallback to first header
      const firstNonNumeric = effectiveHeaders.find(h => !numericCols.has(h));
      setXColumn(firstNonNumeric || effectiveHeaders[0]);
    }
    if (chartType !== 'pie' && chartType !== 'hist') {
      // ensure at least one y series selected
      if (!yColumns.length) {
        const firstNumeric = effectiveHeaders.find(h => numericCols.has(h));
        if (firstNumeric) setYColumns([firstNumeric]);
      }
    } else {
      if (!yColumn) {
        const firstNumeric = effectiveHeaders.find(h => numericCols.has(h));
        if (firstNumeric) setYColumn(firstNumeric);
      }
    }
    if (chartType === 'hist' && !histCol) {
      const firstNumeric = effectiveHeaders.find(h => numericCols.has(h));
      if (firstNumeric) setHistCol(firstNumeric);
    }
  }, [effectiveHeaders, rows, numericCols, xColumn, yColumn, chartType]);

  const downloadChartAsJpg = async () => {
    try {
      const chart = chartInstanceRef.current;
      if (chart && chart.canvas) {
        const dataUrl = chart.canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'chart.jpg';
        link.click();
        return;
      }
      if (chartPanelRef.current) {
        const dataUrl = await htmlToImage.toJpeg(chartPanelRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'chart.jpg';
        link.click();
      }
    } catch (e) {
      console.error('Failed to export chart as JPG', e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div ref={chartDropdownRef}>
          {!controlsInParent && (
            <button onClick={() => setLocalShowChartPicker(s => !s)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: effectiveShowPicker ? '#0e639c' : '#2d2d2d', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Chart ▾</button>
          )}
          {effectiveShowPicker && (
            <div style={{ marginTop: 8, background: '#1e1e1e', border: '1px solid #444', borderRadius: 6, padding: 8, minWidth: 320 }}>
              {disabled && (
                <div style={{ color: '#e0a', marginBottom: 6 }}>Charts use non-pivot view.</div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <label style={{ color: '#aaa' }}>Type:</label>
                <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                  <option value="scatter">Scatter</option>
                  <option value="hist">Histogram</option>
                  <option value="pie">Pie</option>
                  <option value="heatmap">Heatmap</option>
                </select>
                <label style={{ color: '#aaa' }}>X:</label>
                <select value={xColumn} onChange={(e) => setXColumn(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="">Select…</option>
                  {effectiveHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {chartType === 'pie' && (
                  <>
                    <label style={{ color: '#aaa' }}>Measure:</label>
                    <select value={yColumn} onChange={(e) => setYColumn(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="">(count rows)</option>
                      {effectiveHeaders.filter(h => numericCols.has(h)).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </>
                )}
                {chartType !== 'pie' && chartType !== 'hist' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#aaa' }}>Y Series:</span>
                    <div style={{ maxHeight: 130, overflow: 'auto', border: '1px solid #333', borderRadius: 4, padding: 6, minWidth: 200 }}>
                      {effectiveHeaders.filter(h => numericCols.has(h)).map(h => (
                        <label key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10, marginBottom: 6 }}>
                          <input
                            type="checkbox"
                            checked={yColumns.includes(h)}
                            onChange={() => setYColumns(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])}
                          />
                          <span>{h}</span>
                          <label title="Right axis" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                            <input type="checkbox" checked={yRight.includes(h)} onChange={(e) => setYRight(prev => e.target.checked ? [...new Set([...prev, h])] : prev.filter(x => x !== h))} />
                            y₂
                          </label>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {chartType === 'hist' && (
                  <>
                    <label style={{ color: '#aaa' }}>Column:</label>
                    <select value={histCol} onChange={(e) => setHistCol(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      {effectiveHeaders.filter(h => numericCols.has(h)).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <label style={{ color: '#aaa' }}>Bins:</label>
                    <input type="number" min={1} max={100} value={histBins} onChange={(e) => setHistBins(Number(e.target.value))} style={{ width: 70, padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }} />
                  </>
                )}
                <label style={{ color: '#aaa' }}>Agg:</label>
                <select value={chartAgg} onChange={(e) => setChartAgg(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="sum">sum</option>
                  <option value="avg">avg</option>
                  <option value="count">count</option>
                </select>
                {chartType === 'bar' && (
                  <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={stacked} onChange={(e) => setStacked(e.target.checked)} /> Stacked
                  </label>
                )}
                {(xColumn && rows.some(r => isDateLike(r?.[xColumn]))) && (
                  <>
                    <label style={{ color: '#aaa' }}>Bucket:</label>
                    <select value={dateBucket} onChange={(e) => setDateBucket(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="none">none</option>
                      <option value="day">day</option>
                      <option value="week">week</option>
                      <option value="month">month</option>
                      <option value="quarter">quarter</option>
                      <option value="year">year</option>
                    </select>
                  </>
                )}
                <label style={{ color: '#aaa' }}>Sort:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="label">label</option>
                  <option value="total">total</option>
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
                <label style={{ color: '#aaa' }}>Top N:</label>
                <input type="number" min="" placeholder="All" value={topN} onChange={(e) => setTopN(e.target.value)} style={{ width: 72, padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }} />
                {/* Heatmap specific inputs */}
                {chartType === 'heatmap' && (
                  <>
                    <label style={{ color: '#aaa' }}>Y Cat:</label>
                    <select value={heatYCat} onChange={(e) => setHeatYCat(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="">Select…</option>
                      {effectiveHeaders.filter(h => !numericCols.has(h)).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <label style={{ color: '#aaa' }}>Measure:</label>
                    <select value={yColumn} onChange={(e) => setYColumn(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="">Select…</option>
                      {effectiveHeaders.filter(h => numericCols.has(h)).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </>
                )}
                {(chartType === 'box' || chartType === 'violin') && (
                  <>
                    <label style={{ color: '#aaa' }}>Group by:</label>
                    <select value={boxGroup} onChange={(e) => setBoxGroup(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="">Select…</option>
                      {effectiveHeaders.filter(h => !numericCols.has(h)).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <label style={{ color: '#aaa' }}>Measure:</label>
                    <select value={boxMeasure} onChange={(e) => setBoxMeasure(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                      <option value="">Select…</option>
                      {effectiveHeaders.filter(h => numericCols.has(h)).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </>
                )}
                <label style={{ color: '#aaa' }}>Legend:</label>
                <select value={legendPos} onChange={(e) => setLegendPos(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="top">top</option>
                  <option value="bottom">bottom</option>
                  <option value="left">left</option>
                  <option value="right">right</option>
                </select>
                {/* Axis formatting */}
                <label style={{ color: '#aaa' }}>Y fmt:</label>
                <select value={yFormat} onChange={(e) => setYFormat(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="default">default</option>
                  <option value="number">number</option>
                  <option value="thousands">thousands</option>
                  <option value="compact">compact</option>
                  <option value="percent">percent</option>
                  <option value="currency">currency</option>
                </select>
                <label style={{ color: '#aaa' }}>Y₂ fmt:</label>
                <select value={y1Format} onChange={(e) => setY1Format(e.target.value)} style={{ padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }}>
                  <option value="default">default</option>
                  <option value="number">number</option>
                  <option value="thousands">thousands</option>
                  <option value="compact">compact</option>
                  <option value="percent">percent</option>
                  <option value="currency">currency</option>
                </select>
                {(yFormat === 'currency' || y1Format === 'currency') && (
                  <>
                    <label style={{ color: '#aaa' }}>Curr:</label>
                    <input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} style={{ width: 70, padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }} />
                  </>
                )}
                <label style={{ color: '#aaa' }}>Prec:</label>
                <input type="number" min={0} max={6} value={yPrecision} onChange={(e) => setYPrecision(Number(e.target.value))} style={{ width: 56, padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }} />
                {(chartType === 'line' || chartType === 'area' || chartType === 'scatter') && (
                  <>
                    <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={trendline} onChange={(e) => setTrendline(e.target.checked)} /> Trendline
                    </label>
                    <label style={{ color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={movingAvg} onChange={(e) => setMovingAvg(e.target.checked)} /> MA
                    </label>
                    {movingAvg && (
                      <input type="number" min={2} max={60} value={maWindow} onChange={(e) => setMaWindow(Number(e.target.value))} style={{ width: 56, padding: '2px 4px', background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 4 }} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {!controlsInParent && (
          <button onClick={() => setLocalIsChartVisible(v => !v)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: effectiveVisible ? '#0e639c' : '#2d2d2d', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>{effectiveVisible ? 'Hide Chart' : 'Show Chart'}</button>
        )}
      </div>

      {effectiveShowPicker && controlsInParent && (
        <div style={{ marginBottom: 8 }} />
      )}

      {effectiveVisible && (
        <div style={{ marginBottom: 12, border: '1px solid #333', borderRadius: 8, padding: 8, background: '#151515' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ color: '#ddd' }}>
              {disabled
                ? 'Charts are disabled in pivot view. Switch to normal view.'
                : chartConfig
                  ? `${chartType.toUpperCase()} — ${yColumn || 'Count'} (${chartAgg}) by ${xColumn}`
                  : 'Configure chart (Chart ▾) and click Show Chart'}
            </div>
            <button onClick={downloadChartAsJpg} disabled={!chartConfig} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #444', background: '#2d2d2d', color: '#fff', cursor: chartConfig ? 'pointer' : 'not-allowed' }}>Download JPG</button>
          </div>
          <div ref={chartPanelRef} style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0b', border: '1px solid #222', borderRadius: 6 }}>
            {disabled ? (
              <div style={{ color: '#aaa' }}>Charts disabled in pivot view.</div>
            ) : chartConfig ? (
              chartType === 'bar' ? <Bar ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const label = chart.data.labels[idx];
                  onCrossFilter({ column: xColumn, values: [label], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
              : chartType === 'line' || chartType === 'area' ? <Line ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const label = chart.data.labels[idx];
                  onCrossFilter({ column: xColumn, values: [label], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
              : chartType === 'scatter' ? <Line ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const label = chart.data.labels ? chart.data.labels[idx] : idx;
                  onCrossFilter({ column: xColumn, values: [label], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
              : chartType === 'heatmap' ? <ReactChart type='matrix' ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const meta = chartConfig.meta && chartConfig.meta.heat;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const d = chart.data.datasets[0].data[idx];
                  onCrossFilter({ column: (e.shiftKey && meta) ? meta.yCol : (meta ? meta.xCol : xColumn), values: [(e.shiftKey && meta) ? d.y : d.x], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
              : chartType === 'box' || chartType === 'violin' ? <ReactChart type={chartType === 'box' ? 'boxplot' : 'violin'} ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const meta = chartConfig.meta;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const label = chart.data.labels[idx];
                  onCrossFilter({ column: (meta && meta.groupCol) || xColumn, values: [label], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
              : <Pie ref={chartInstanceRef} data={chartConfig.data} options={chartConfig.options} onClick={(e) => {
                try {
                  if (!onCrossFilter) return;
                  const chart = chartInstanceRef.current;
                  if (!chart) return;
                  const pts = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                  if (!pts || !pts.length) return;
                  const idx = pts[0].index;
                  const label = chart.data.labels[idx];
                  onCrossFilter({ column: xColumn, values: [label], append: e.ctrlKey || e.metaKey });
                } catch {}
              }} />
            ) : (
              <div style={{ color: '#aaa' }}>Select X{chartType !== 'pie' ? ' and Y' : ''} in Chart ▾ to render.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartPanel;
