import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StandaloneChrome from './StandaloneChrome';
import Editor from '@monaco-editor/react';
import TableComponent, { TABLE_COMPONENT_DEFAULT_PAGE_SIZE } from './TableComponent';
import runIcon from '../icons/run.svg';
import copyIcon from '../icons/copy.svg';
import addCellIcon from '../icons/add_cell.svg';
import removeCellIcon from '../icons/remove_cell.svg';
import worksheetIcon from '../icons/worksheet_viewer.svg';

const baseTable = [
  { region: 'North', revenue: 125000, growth: 12 },
  { region: 'South', revenue: 98000, growth: 9 },
  { region: 'East', revenue: 143500, growth: 15 },
  { region: 'West', revenue: 112300, growth: 11 },
];

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const cellTemplates = {
  text: {
    title: 'NLP Prompt',
    language: 'markdown',
    placeholder: 'Describe the goal of this analysis…',
    content: 'Hello LLaMA3.2:1b. Are you there?',
    autoRun: false,
  },
  sql: {
    title: 'SQL Exploration',
    language: 'sql',
    placeholder: 'SELECT region, revenue, growth FROM sales_performance',
    content: 'SELECT region, revenue, growth FROM sales_performance ORDER BY revenue DESC;',
    autoRun: false,
  },
  python: {
    title: 'Python Transform',
    language: 'python',
    placeholder: `import pandas as pd
    import numpy as np`,
    content: `import json
import pandas as pd
from pprint import pprint

# Simulated input: list of JSON-like dictionaries
data = [
    {"_base_sql": "SELECT * FROM sales"},
    {
        "_column_types": {
            "sale_id": "number",
            "customer_id": "number",
            "product_id": "number",
            "sale_date": "date",
            "quantity": "number",
            "unit_price": "number",
            "total_amount": "number",
            "region": "string"
        },
        "_search_columns": [
            "sale_id", "customer_id", "product_id", "sale_date",
            "quantity", "unit_price", "total_amount", "region"
        ]
    },
    {
        "sale_id": 448467,
        "customer_id": 4,
        "product_id": 102,
        "sale_date": "2025-07-04T00:00:00",
        "quantity": 1.0,
        "unit_price": 900.0,
        "total_amount": 900,
        "region": "North America"
    },
    {
        "sale_id": 448468,
        "customer_id": 5,
        "product_id": 105,
        "sale_date": "2025-07-05T00:00:00",
        "quantity": 2.0,
        "unit_price": 350.0,
        "total_amount": 700,
        "region": "Europe"
    }
]

# Output 1: Base SQL
base_sql = data[0]["_base_sql"]
print("🔹 Base SQL:")
print(base_sql)

# Output 2: Column Types and Searchable Columns
column_types = data[1]["_column_types"]
search_columns = data[1]["_search_columns"]
print("🔹 Column Types:")
pprint(column_types)
print("🔹 Searchable Columns:")
print(search_columns)

# Output 3: DataFrame from records
records = data[2:]
df = pd.DataFrame(records)
print("🔹 DataFrame Preview:")
print(df)

# Output 4: Schema Summary
print("🔹 Schema Summary:")
print(df.dtypes)`,
    autoRun: false,
  },
};





const createCell = (type = 'text') => {
  const template = cellTemplates[type] || cellTemplates.text;
  return {
    id: makeId('cell'),
    type,
    collapsed: false,
    dfName: null,
    showOutput: false,
    outputCollapsed: false,
    outputData: null,
    outputActiveColumn: null,
    outputRaw: '',
    outputTableProps: null,
    ...template,
  };
};

const initialCells = () => [createCell('text')];

const cardStyle = {
  borderRadius: 12,
  border: '1px solid #253248',
  background: 'linear-gradient(160deg, rgba(26,31,44,0.98) 0%, rgba(11,14,24,0.98) 100%)',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: '0 18px 36px rgba(0,0,0,0.35)',
};

const IGNORED_META_KEYS = new Set(['_base_sql', '_column_types', '_search_columns']);
const DB_AGENTS = ['database', 'langchainprompt', 'restful', 'embedded', 'embedded_narrated', 'generic_rag', 'database1'];

const appendObjectRecord = (target, obj, limit = Infinity) => {
  if (!obj || typeof obj !== 'object') return;
  const sanitized = {};
  let hasData = false;
  for (const [key, value] of Object.entries(obj)) {
    if (IGNORED_META_KEYS.has(key) || key.startsWith('_')) continue;
    if (['columns', 'rows', 'data', 'tableData', 'records', 'outputs'].includes(key)) continue;
    sanitized[key] = value;
    hasData = true;
  }
  if (hasData && Object.keys(sanitized).length && target.length < limit) {
    target.push(sanitized);
    return true;
  }
  return false;
};

const normalizeRecords = (rows) => {
  if (!Array.isArray(rows)) return [];
  const result = [];
  for (const row of rows) {
    if (Array.isArray(row?.columns) && Array.isArray(row?.rows)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      for (const values of row.rows) {
        if (Array.isArray(values)) {
          const obj = {};
          keys.forEach((key, idx) => {
            obj[key] = values[idx];
          });
          if (Object.keys(obj).length > 0) result.push(obj);
        } else if (values && typeof values === 'object') {
          const sanitized = {};
          for (const key of keys) sanitized[key] = values[key];
          if (Object.keys(sanitized).length > 0) result.push(sanitized);
        }
      }
      continue;
    }
    if (Array.isArray(row?.columns) && Array.isArray(row?.data)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      for (const values of row.data) {
        if (Array.isArray(values)) {
          const obj = {};
          keys.forEach((key, idx) => {
            obj[key] = values[idx];
          });
          if (Object.keys(obj).length > 0) result.push(obj);
        } else if (values && typeof values === 'object') {
          const sanitized = {};
          for (const key of keys) sanitized[key] = values[key];
          if (Object.keys(sanitized).length > 0) result.push(sanitized);
        }
      }
      continue;
    }
    if (Array.isArray(row?.columns) && Array.isArray(row?.values)) {
      const keys = row.columns.filter((key) => !IGNORED_META_KEYS.has(key));
      const obj = {};
      keys.forEach((key, idx) => {
        obj[key] = row.values[idx];
      });
      if (Object.keys(obj).length > 0) {
        result.push(obj);
        continue;
      }
    }
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const sanitized = {};
      for (const [key, value] of Object.entries(row)) {
        if (!IGNORED_META_KEYS.has(key)) sanitized[key] = value;
      }
      if (Object.keys(sanitized).length > 0) {
        result.push(sanitized);
      }
    } else if (row != null && row !== undefined) {
      result.push({ value: row });
    }
  }
  return result;
};

const cleanText = (value) => {
  try {
    return String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
};

const cleanStreamText = (value) => {
  try {
    const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
    const withoutTrailingSpaces = normalized.replace(/[ \t]+\n/g, '\n');
    return withoutTrailingSpaces.replace(/\n{3,}/g, '\n\n');
  } catch {
    return value;
  }
};

export default function NotebookWorkbench({
  tableButtonPermissions: _tableButtonPermissions = {},
  sendSqlToLlm: _sendSqlToLlm = false,
  perfMaxClientRows = 5000,
  perfMaxScan = 5000,
  perfMaxDistinct = 50,
  virtualizeOnMaximize = true,
  virtMaxClientRows: _virtMaxClientRows = 50000,
  virtRowHeight = 28,
  serverMode: globalServerMode = false,
  tableOpsMode: defaultTableOpsMode = 'flask',
  pushDownDb: defaultPushDownDb = false,
  logEnabled: _logEnabled = false,
  trainingUrl: _trainingUrl = '',
  updateIntervalMs = 200,
  minRowsPerUpdate = 100,
  clobPreview = 8192,
  blobPreview = 2048,
  maxVisibleMessages: _maxVisibleMessages = 5,
} = {}) {
  const [cells, setCells] = useState(() => initialCells());
  const [results, setResults] = useState({
    table: baseTable,
    dataFrame: baseTable,
    dataFrames: { base: baseTable },
    activeDataFrameName: 'base',
    logs: ['Notebook initialized.'],
  });
  const [savedViews, setSavedViews] = useState([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [viewsError, setViewsError] = useState(null);
  const [model, setModel] = useState('llama3.2:1b');
  const [agent, setAgent] = useState('direct');
  const [runningCellId, setRunningCellId] = useState(null);
  const [dragOverCellId, setDragOverCellId] = useState(null);

  const resolvedPerfMaxClientRows = Number(perfMaxClientRows);
  const maxClientRowsCap = resolvedPerfMaxClientRows < 0
    ? Number.POSITIVE_INFINITY
    : Math.max(1, Math.min(5000, resolvedPerfMaxClientRows || 5000));
  const resolvedPerfOptions = {
    maxScan: Number.isFinite(perfMaxScan) ? perfMaxScan : 5000,
    maxDistinct: Number.isFinite(perfMaxDistinct) ? perfMaxDistinct : 50,
  };
  const resolvedPreviewOptions = { maxClob: clobPreview, maxBlob: blobPreview };
  const effectiveTableOpsMode = defaultTableOpsMode || 'flask';
  const effectivePushDownDb = !!defaultPushDownDb;

  const runCell = useCallback(
    async (cell, silent = false) => {
      if (!cell) return;
      if (!silent) setRunningCellId(cell.id);
      const stamp = new Date().toLocaleTimeString();
      const cellIndex = cells.findIndex((c) => c.id === cell.id);
      const inferredName = `df_${cellIndex >= 0 ? cellIndex + 1 : cells.length + 1}`;
      const dfName = cell.dfName || inferredName;

      if (cell.type === 'text') {
        const prompt = cell.content?.trim();
        if (!prompt) {
          if (!silent) {
            setResults((prev) => ({
              ...prev,
              logs: [...prev.logs, `⚠️ [${stamp}] NLP cell skipped — no prompt provided.`],
            }));
          }
          if (!silent) setRunningCellId(null);
          return;
        }

        const isDbLike = DB_AGENTS.includes(agent);
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `📡 [${stamp}] Sending NLP prompt using model ${model || 'default'} and agent ${agent}.`],
        }));

        try {
          setCells((prev) =>
            prev.map((c) =>
              c.id === cell.id
                ? {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: [],
                    outputActiveColumn: null,
                    outputRaw: '',
                    outputTableProps: null,
                  }
                : c,
            ),
          );

          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              mode: agent,
              stream: true,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`${res.status} ${res.statusText}: ${errorText}`);
          }

          const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;

          if (!reader) {
            const raw = await res.text();
            const cleaned = cleanStreamText(raw);
            setCells((prev) =>
              prev.map((c) =>
                c.id === cell.id
                  ? {
                      ...c,
                      dfName,
                      showOutput: true,
                      outputCollapsed: false,
                      outputRaw: cleaned,
                      outputData: [],
                      outputActiveColumn: null,
                      outputTableProps: null,
                    }
                  : c,
              ),
            );
            setResults((prev) => ({
              ...prev,
              logs: [...prev.logs, `🤖 [${stamp}] NLP completed (text response).`],
            }));
          } else if (isDbLike) {
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            const aggregatedRows = [];
            let narrationText = '';
            let baseSql = null;
            let columnTypes = null;
            let searchColumns = null;
            const updateInterval = Math.max(50, Math.min(5000, Number(updateIntervalMs) || 200));
            const minRowsThreshold = Math.max(1, Math.min(500, Number(minRowsPerUpdate) || 100));
            let lastFlush = performance.now();
            let rowsSinceFlush = 0;
            const appendRecords = (records) => {
              const normalized = normalizeRecords(records);
              if (!normalized.length) return;
              const remaining = maxClientRowsCap - aggregatedRows.length;
              if (remaining <= 0) return;
              const slice = normalized.slice(0, remaining);
              aggregatedRows.push(...slice);
              rowsSinceFlush += slice.length;
            };

            const flushUpdate = () => {
              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cell.id) return c;
                  const rowsForOutput = aggregatedRows.slice();
                  const columns = rowsForOutput.length && typeof rowsForOutput[0] === 'object' ? Object.keys(rowsForOutput[0]) : [];
                  const activeColumn = columns.length ? columns[0] : null;
                  const tableProps = rowsForOutput.length
                    ? {
                        data: rowsForOutput,
                        exportContext: baseSql
                          ? {
                              prompt,
                              mode: agent,
                              model,
                              baseSql,
                              columnTypes: columnTypes || null,
                              searchColumns: searchColumns || null,
                            }
                          : null,
                        tableOpsMode: effectiveTableOpsMode,
                        pushDownDb: effectivePushDownDb && !!baseSql,
                        totalRows: rowsForOutput.length,
                        serverMode: globalServerMode,
                        initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                        initialFontSize: 11,
                        buttonsDisabled: false,
                        previewOptions: { ...resolvedPreviewOptions },
                        perfOptions: { ...resolvedPerfOptions },
                        initialViewState: null,
                        initialSchema: columnTypes ? { columnTypes } : null,
                        virtualizeOnMaximize,
                        virtualRowHeight: virtRowHeight,
                        initialMaximized: false,
                        showMaximizeControl: true,
                      }
                    : null;

                  return {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: rowsForOutput,
                    outputActiveColumn: activeColumn,
                    outputRaw: narrationText ? cleanStreamText(narrationText) : '',
                  outputTableProps: tableProps,
                };
              }),
            );
            };

            const updateRawOnly = () => {
              const formatted = narrationText ? cleanStreamText(narrationText) : '';
              setCells((prev) =>
                prev.map((c) => (c.id === cell.id ? { ...c, outputRaw: formatted } : c)),
              );
            };

            const maybeFlush = (force = false) => {
              const now = performance.now();
              const shouldFlush = force || rowsSinceFlush >= minRowsThreshold || now - lastFlush >= updateInterval;
              if (shouldFlush) {
                flushUpdate();
                lastFlush = now;
                rowsSinceFlush = 0;
              } else if (narrationText) {
                updateRawOnly();
              }
            };

            const handleLine = (line) => {
              if (typeof line !== 'string') return;
              const trimmed = line.trim();
              if (!trimmed) return;
              if (trimmed === '[DONE]') return;
              const withoutPrefix = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              let parsed = null;
              try {
                parsed = JSON.parse(withoutPrefix);
              } catch {
                parsed = null;
              }

              if (parsed && typeof parsed === 'object') {
                if (parsed._narration) narrationText = parsed._narration;
                if (parsed._base_sql) baseSql = String(parsed._base_sql);
                if (parsed._column_types && typeof parsed._column_types === 'object') columnTypes = parsed._column_types;
                if (Array.isArray(parsed._search_columns)) searchColumns = parsed._search_columns;
                if (Array.isArray(parsed.rows)) appendRecords(parsed.rows);
                if (Array.isArray(parsed.tableData)) appendRecords(parsed.tableData);
                if (Array.isArray(parsed.data)) appendRecords(parsed.data);
                if (Array.isArray(parsed.records)) appendRecords(parsed.records);
                if (Array.isArray(parsed.outputs)) appendRecords(parsed.outputs);
                if (parsed.response !== undefined && parsed.response !== null) {
                  narrationText += String(parsed.response);
                }
                if (appendObjectRecord(aggregatedRows, parsed, maxClientRowsCap)) rowsSinceFlush += 1;
              } else if (Array.isArray(parsed)) {
                appendRecords(parsed);
              } else if (parsed && typeof parsed === 'string') {
                narrationText += parsed;
              } else if (!parsed) {
                narrationText += withoutPrefix;
              }

              maybeFlush();
            };

            let doneReading = false;
            while (!doneReading) {
              const { value, done: doneChunk } = await reader.read();
              doneReading = doneChunk;
              const chunkText = value ? decoder.decode(value, { stream: !doneChunk }) : decoder.decode();
              if (chunkText) buffer += chunkText;

              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
                newlineIndex = buffer.indexOf('\n');
              }
            }

            const remainder = buffer.trim();
            if (remainder) handleLine(remainder);

            maybeFlush(true);

            const finalRows = aggregatedRows.slice();
            const finalNarration = narrationText ? cleanStreamText(narrationText) : '';
            const columns = finalRows.length && typeof finalRows[0] === 'object' ? Object.keys(finalRows[0]) : [];
            const activeColumnFinal = columns.length ? columns[0] : null;

            setCells((prev) =>
              prev.map((c) => {
                if (c.id !== cell.id) return c;
                const tableProps = finalRows.length
                  ? {
                      data: finalRows,
                      exportContext: baseSql
                        ? {
                            prompt,
                            mode: agent,
                            model,
                            baseSql,
                            columnTypes: columnTypes || null,
                            searchColumns: searchColumns || null,
                          }
                        : null,
                      tableOpsMode: effectiveTableOpsMode,
                      pushDownDb: effectivePushDownDb && !!baseSql,
                      totalRows: finalRows.length,
                      serverMode: globalServerMode,
                      initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                      initialFontSize: 11,
                      buttonsDisabled: false,
                      previewOptions: { ...resolvedPreviewOptions },
                      perfOptions: { ...resolvedPerfOptions },
                      initialViewState: null,
                      initialSchema: columnTypes ? { columnTypes } : null,
                      virtualizeOnMaximize,
                      virtualRowHeight: virtRowHeight,
                      initialMaximized: false,
                      showMaximizeControl: true,
                    }
                  : null;

                return {
                  ...c,
                  dfName,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: finalRows,
                  outputActiveColumn: finalRows.length ? activeColumnFinal : null,
                  outputRaw: finalNarration,
                  outputTableProps: tableProps,
                };
              }),
            );

            setResults((prev) => {
              const logs = [...prev.logs];
              if (finalRows.length) {
                const dataFrames = { ...prev.dataFrames, [dfName]: finalRows };
                logs.push(`🤖 [${stamp}] NLP completed (${finalRows.length} rows captured).`, `📦 [${stamp}] Output stored as ${dfName}.`);
                return {
                  ...prev,
                  table: finalRows,
                  dataFrame: finalRows,
                  dataFrames,
                  activeDataFrameName: dfName,
                  logs,
                };
              }
              logs.push(`ℹ️ [${stamp}] NLP response captured.`);
              return { ...prev, logs };
            });
          } else {
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let aggregatedText = '';
            let activeColumn = cell.outputActiveColumn || null;
            let baseSql = null;
            let columnTypes = null;
            let searchColumns = null;
            const aggregatedRows = [];

            const appendRecords = (records) => {
              const normalized = normalizeRecords(records);
              if (normalized.length) aggregatedRows.push(...normalized);
            };

            const flushUpdate = () => {
              const formatted = aggregatedText ? cleanStreamText(aggregatedText) : '';
              const rowsForOutput = aggregatedRows.length ? aggregatedRows.slice() : [];
              const columns = rowsForOutput.length && typeof rowsForOutput[0] === 'object' ? Object.keys(rowsForOutput[0]) : [];
              if (columns.length) {
                activeColumn = columns.includes(activeColumn) ? activeColumn : columns[0];
              } else {
                activeColumn = null;
              }

              setCells((prev) =>
                prev.map((c) => {
                  if (c.id !== cell.id) return c;
                  const tableProps = isDbLike && rowsForOutput.length
                    ? {
                        data: rowsForOutput,
                        exportContext: baseSql
                          ? {
                              prompt,
                              mode: agent,
                              model,
                              baseSql,
                              columnTypes: columnTypes || null,
                              searchColumns: searchColumns || null,
                            }
                          : null,
                        tableOpsMode: effectiveTableOpsMode,
                        pushDownDb: effectivePushDownDb && !!baseSql,
                        totalRows: rowsForOutput.length,
                        serverMode: globalServerMode,
                        initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                        initialFontSize: 11,
                        buttonsDisabled: false,
                        previewOptions: { ...resolvedPreviewOptions },
                        perfOptions: { ...resolvedPerfOptions },
                        initialViewState: null,
                        initialSchema: columnTypes ? { columnTypes } : null,
                        virtualizeOnMaximize,
                        virtualRowHeight: virtRowHeight,
                        initialMaximized: false,
                        showMaximizeControl: true,
                      }
                    : null;

                  return {
                    ...c,
                    dfName,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: rowsForOutput,
                    outputActiveColumn: activeColumn,
                    outputRaw: formatted,
                    outputTableProps: tableProps,
                  };
                }),
              );
            };

            const handleLine = (line) => {
              if (typeof line !== 'string') return;
              const trimmed = line.trim();
              if (!trimmed) return;
              if (trimmed === '[DONE]') return;
              const withoutPrefix = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              let parsed = null;
              try {
                parsed = JSON.parse(withoutPrefix);
              } catch {
                parsed = null;
              }

              if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed)) {
                  appendRecords(parsed);
                } else {
                  if (parsed._base_sql) baseSql = String(parsed._base_sql);
                  if (parsed._column_types && typeof parsed._column_types === 'object') columnTypes = parsed._column_types;
                  if (Array.isArray(parsed._search_columns)) searchColumns = parsed._search_columns;
                  if (Array.isArray(parsed.rows)) appendRecords(parsed.rows);
                  if (Array.isArray(parsed.tableData)) appendRecords(parsed.tableData);
                  if (Array.isArray(parsed.data)) appendRecords(parsed.data);
                  if (Array.isArray(parsed.records)) appendRecords(parsed.records);
                  if (Array.isArray(parsed.outputs)) appendRecords(parsed.outputs);
                  if (parsed.response !== undefined && parsed.response !== null) {
                    aggregatedText += String(parsed.response);
                  }
                  appendObjectRecord(aggregatedRows, parsed);
                }
              } else if (parsed && typeof parsed === 'string') {
                aggregatedText += parsed;
              } else if (!parsed) {
                aggregatedText += withoutPrefix;
              }

              flushUpdate();
            };

            let doneReading = false;
            while (!doneReading) {
              const { value, done: doneChunk } = await reader.read();
              doneReading = doneChunk;
              const chunkText = value ? decoder.decode(value, { stream: !doneChunk }) : decoder.decode();
              if (chunkText) buffer += chunkText;

              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                handleLine(line);
                newlineIndex = buffer.indexOf('\n');
              }
            }

            const remainder = buffer.trim();
            if (remainder) handleLine(remainder);

            const finalText = aggregatedText ? cleanStreamText(aggregatedText) : '';
            const finalRows = aggregatedRows.slice();
            const columns = finalRows.length && typeof finalRows[0] === 'object' ? Object.keys(finalRows[0]) : [];
            const activeColumnFinal = columns.length ? columns[0] : null;

            setCells((prev) =>
              prev.map((c) => {
                if (c.id !== cell.id) return c;
                const tableProps = finalRows.length
                  && isDbLike
                  ? {
                      data: finalRows,
                      exportContext: baseSql
                        ? {
                            prompt,
                            mode: agent,
                            model,
                            baseSql,
                            columnTypes: columnTypes || null,
                            searchColumns: searchColumns || null,
                          }
                        : null,
                      tableOpsMode: effectiveTableOpsMode,
                      pushDownDb: effectivePushDownDb && !!baseSql,
                      totalRows: finalRows.length,
                      serverMode: globalServerMode,
                      initialPageSize: TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
                      initialFontSize: 11,
                      buttonsDisabled: false,
                      previewOptions: { ...resolvedPreviewOptions },
                      perfOptions: { ...resolvedPerfOptions },
                      initialViewState: null,
                      initialSchema: columnTypes ? { columnTypes } : null,
                      virtualizeOnMaximize,
                      virtualRowHeight: virtRowHeight,
                      initialMaximized: false,
                      showMaximizeControl: true,
                    }
                  : null;

                return {
                  ...c,
                  dfName,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: finalRows,
                  outputActiveColumn: finalRows.length ? activeColumnFinal : null,
                  outputRaw: finalText,
                  outputTableProps: tableProps,
                };
              }),
            );

            setResults((prev) => {
              const logs = [...prev.logs];
              let next = { ...prev };
              if (finalRows.length) {
                const dataFrames = { ...prev.dataFrames, [dfName]: finalRows };
                logs.push(`🤖 [${stamp}] NLP completed (${finalRows.length} rows captured).`, `📦 [${stamp}] Output stored as ${dfName}.`);
                next = {
                  ...prev,
                  table: finalRows,
                  dataFrame: finalRows,
                  dataFrames,
                  activeDataFrameName: dfName,
                  logs,
                };
              } else if (finalText) {
                logs.push(`🤖 [${stamp}] NLP response captured.`);
                next = { ...prev, logs };
              } else {
                logs.push(`ℹ️ [${stamp}] NLP completed with no visible output.`);
                next = { ...prev, logs };
              }
              return next;
            });
          }
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${stamp}] NLP error: ${err.message}`],
          }));
          setCells((prev) =>
            prev.map((c) =>
              c.id === cell.id
                ? {
                    ...c,
                    showOutput: true,
                    outputCollapsed: false,
                    outputData: [],
                    outputActiveColumn: null,
                    outputRaw: `Failed to process prompt: ${err.message}`,
                    outputTableProps: null,
                  }
                : c,
            ),
          );
        } finally {
          if (!silent) setRunningCellId(null);
        }
        return;
      }

      if (cell.type === 'python') {
        try {
          const pyRes = await fetch('/api/python/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: cell.content || '',
            }),
          });

          if (!pyRes.ok) {
            const errJson = await pyRes.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${pyRes.status}`);
          }

          const payload = await pyRes.json();
          const tables = payload.tables || {};
          const sanitizedTables = {};
          for (const [name, rows] of Object.entries(tables)) {
            sanitizedTables[name] = normalizeRecords(rows);
          }

          let primaryKey = sanitizedTables[dfName] ? dfName : Object.keys(sanitizedTables)[0] || dfName;
          let primaryData = primaryKey && sanitizedTables[primaryKey] ? sanitizedTables[primaryKey] : [];
          const stdoutClean = cleanText(payload.stdout || '');
          const stderrClean = cleanText(payload.stderr || '');

          if (!primaryData.length && stdoutClean) {
            primaryData = [{ stdout: stdoutClean }];
            sanitizedTables[primaryKey] = primaryData;
          }

          setResults((prev) => {
            const dataFrames = { ...prev.dataFrames, ...sanitizedTables };
            const logs = [...prev.logs, `🐍 [${stamp}] Python cell executed (${primaryData.length} rows).`];
            if (stdoutClean) logs.push(`ℹ️ [${stamp}] stdout captured (${stdoutClean.length} chars hidden).`);
            if (stderrClean) logs.push(`ℹ️ [${stamp}] stderr captured (${stderrClean.length} chars hidden).`);
            if (primaryData.length) logs.push(`📦 [${stamp}] Output stored as ${primaryKey}.`);
            return {
              ...prev,
              table: primaryData.length ? primaryData : prev.table,
              dataFrame: primaryData.length ? primaryData : prev.dataFrame,
              dataFrames,
              activeDataFrameName: primaryData.length ? primaryKey : prev.activeDataFrameName,
              logs,
            };
          });

          const firstColumn = primaryData.length && typeof primaryData[0] === 'object'
            ? Object.keys(primaryData[0])[0] || null
            : null;

          setCells((prev) =>
            prev.map((c) => {
              if (c.id !== cell.id) return c;
              return {
                ...c,
                dfName: primaryKey,
                showOutput: true,
                outputData: primaryData,
                outputCollapsed: false,
                outputActiveColumn: firstColumn,
                outputRaw: '',
                outputTableProps: null,
              };
            }),
          );
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${stamp}] Python error: ${err.message}`],
          }));
        } finally {
          if (!silent) setRunningCellId(null);
        }
        return;
      }

      if (cell.type === 'sql') {
        setResults((prev) => {
          const next = { ...prev };
          const activeName = prev.activeDataFrameName;
          const sourceTable = (activeName && Array.isArray(prev.dataFrames?.[activeName]) && prev.dataFrames[activeName].length)
            ? prev.dataFrames[activeName]
            : baseTable;
          let workingData = sourceTable.map((row) => ({ ...row }));

          let filtered = workingData;
          if (cell.content?.toLowerCase().includes('where')) {
            filtered = filtered.filter((row) => {
              if (typeof row.growth === 'number') return row.growth >= 12;
              return true;
            });
          }
          workingData = filtered;
        const nextData = normalizeRecords(workingData);
        const columns = nextData.length && typeof nextData[0] === 'object' ? Object.keys(nextData[0]) : [];
        const activeColumn = columns[0] || null;
        const dataFrames = { ...prev.dataFrames, [dfName]: nextData };
          next.dataFrame = nextData;
          next.dataFrames = dataFrames;
          next.activeDataFrameName = dfName;
          next.table = nextData.length ? nextData : prev.table;
          next.logs = [...prev.logs, `🗃️ [${stamp}] SQL cell executed (${nextData.length} rows).`, `📦 [${stamp}] Output stored as ${dfName}.`];
          if (!silent) next.logs.push(`✅ [${stamp}] ${cell.title} finished.`);

          setCells((prevCells) =>
            prevCells.map((c) => {
              if (c.id !== cell.id) return c;
              if (c.showOutput) {
                return {
                  ...c,
                  dfName,
                  outputData: nextData,
                  outputCollapsed: false,
                  outputActiveColumn: activeColumn,
                  outputRaw: '',
                  outputTableProps: null,
                };
              }
              return { ...c, dfName, outputData: nextData, outputActiveColumn: activeColumn, outputRaw: '', outputTableProps: null };
            }),
          );

          return next;
        });
        if (!silent) setRunningCellId(null);
        return;
      }

      if (!silent) {
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${stamp}] Unsupported cell type ${cell.type}.`],
        }));
        setRunningCellId(null);
      }
    },
    [agent, model, cells, results],
  );

  const updateCellContent = useCallback(
    (id, nextContent) => {
      setCells((prev) => {
        const nextCells = prev.map((cell) =>
          cell.id === id
            ? {
                ...cell,
                content: nextContent,
              }
            : cell,
        );
        return nextCells;
      });
    },
    [],
  );

  const updateCellType = useCallback(
    (id, nextType) => {
      const template = cellTemplates[nextType] || cellTemplates.text;
      setCells((prev) =>
        prev.map((cell) => {
          if (cell.id !== id) return cell;
          const nextCell = {
            ...cell,
            type: nextType,
            title: template.title,
            language: template.language,
            placeholder: template.placeholder,
            autoRun: template.autoRun,
            content: template.content || '',
            outputData: null,
            dfName: cell.dfName,
            outputRaw: '',
            outputTableProps: null,
          };
          return nextCell;
        }),
      );
    },
    [],
  );

  const addCell = useCallback(() => {
    const next = createCell('text');
    setCells((prev) => [...prev, next]);
  }, []);

  const removeCell = useCallback((id) => {
    setCells((prev) => prev.filter((cell) => cell.id !== id));
  }, []);

  const toggleCollapse = useCallback((id) => {
    setCells((prev) => prev.map((cell) => (cell.id === id ? { ...cell, collapsed: !cell.collapsed } : cell)));
  }, []);

  const renderOutputPreview = (cell) => {
    if (cell?.outputTableProps) {
      const {
        data = [],
        exportContext = null,
        tableOpsMode = effectiveTableOpsMode,
        pushDownDb = effectivePushDownDb,
        totalRows = undefined,
        serverMode: tableServerMode = globalServerMode,
        initialPageSize = TABLE_COMPONENT_DEFAULT_PAGE_SIZE,
        initialFontSize = 11,
        buttonsDisabled = false,
        previewOptions = resolvedPreviewOptions,
        perfOptions = resolvedPerfOptions,
        initialViewState = null,
        initialSchema = null,
        virtualizeOnMaximize: tableVirtualize = virtualizeOnMaximize,
        virtualRowHeight: tableVirtualRowHeight = virtRowHeight,
      } = cell.outputTableProps;
      return (
        <div style={{ minHeight: 220 }}>
          <TableComponent
            data={Array.isArray(data) ? data : []}
            exportContext={exportContext}
            tableOpsMode={tableOpsMode}
            pushDownDb={!!pushDownDb}
            totalRows={totalRows}
            serverMode={!!tableServerMode}
            initialPageSize={initialPageSize}
            initialFontSize={initialFontSize}
            buttonsDisabled={buttonsDisabled}
            previewOptions={previewOptions}
            perfOptions={perfOptions}
            initialViewState={initialViewState}
            initialSchema={initialSchema}
            virtualizeOnMaximize={tableVirtualize}
            virtualRowHeight={tableVirtualRowHeight}
          />
        </div>
      );
    }
    if (cell?.outputRaw) {
      return (
        <div style={{ fontSize: '0.9rem', color: '#d7e4ff', lineHeight: 1.5 }}>
          <ReactMarkdown children={cell.outputRaw} remarkPlugins={[remarkGfm]} />
        </div>
      );
    }
    const data = cell?.outputData;
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return <div style={{ color: '#8ca4cb', fontSize: '0.82rem' }}>No output captured yet.</div>;
    }
    if (Array.isArray(data)) {
      if (!data.length) {
        return <div style={{ color: '#8ca4cb', fontSize: '0.82rem' }}>No output captured yet.</div>;
      }
      const slice = data.slice(0, 10);
      const first = slice[0];
      if (first && typeof first === 'object' && !Array.isArray(first)) {
        const columns = Object.keys(first);
        if (columns.length === 0) {
          return (
            <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(slice, null, 2)}
            </pre>
          );
        }
        const activeColumn = columns.includes(cell.outputActiveColumn) ? cell.outputActiveColumn : columns[0];
        const handleTabClick = (col) => {
          setCells((prev) =>
            prev.map((c) => (c.id === cell.id ? { ...c, outputActiveColumn: col } : c)),
          );
        };
        const rows = data.map((row, idx) => ({ index: idx, value: row[activeColumn] }));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {columns.map((col) => {
                const isActive = col === activeColumn;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleTabClick(col)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid rgba(90,120,165,0.8)',
                      background: isActive ? 'rgba(60,100,160,0.4)' : 'rgba(18,24,36,0.65)',
                      color: '#f0f6ff',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
            <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid rgba(52,82,120,0.6)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ecf3ff', fontSize: '0.85rem' }}>
                <thead style={{ background: 'rgba(32,54,92,0.55)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #2d3e5a', width: 80 }}>Row</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #2d3e5a' }}>{activeColumn.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row) => (
                    <tr key={`row-${row.index}`} style={{ background: row.index % 2 === 0 ? 'rgba(22,27,36,0.65)' : 'rgba(18,24,32,0.65)' }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #222d40', color: '#9db0d6' }}>{row.index + 1}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #222d40' }}>{String(row.value ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#8ca4cb' }}>
                  Showing first 50 of {rows.length} rows.
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(slice, null, 2)}
        </pre>
      );
    }
    if (typeof data === 'object') {
      return (
        <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return (
      <pre style={{ margin: 0, fontSize: '0.8rem', color: '#d7e4ff', whiteSpace: 'pre-wrap' }}>
        {String(data)}
      </pre>
    );
  };

  useEffect(() => {
    const fetchViews = async () => {
      try {
        setLoadingViews(true);
        setViewsError(null);
        const res = await fetch('/api/table/saved_views');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const views = Array.isArray(payload?.views) ? payload.views : [];
        setSavedViews(views);
      } catch (err) {
        setViewsError(err.message || 'Failed to load saved views');
        setSavedViews([]);
      } finally {
        setLoadingViews(false);
      }
    };
    fetchViews();
  }, []);

  const handleSavedViewDragStart = useCallback((event, view) => {
    if (!event?.dataTransfer || !view) return;
    try {
      const payload = JSON.stringify({
        kind: 'saved-view',
        viewName: view.viewName || view.name || '',
        datasetSig: view.datasetSig || view.dataset_sig || '',
        content: view.content || view.viewState || view.view_state || null,
      });
      event.dataTransfer.setData('application/json', payload);
      event.dataTransfer.setData('text/plain', payload);
      event.dataTransfer.effectAllowed = 'copy';
    } catch {}
  }, []);

  const handleCellDragEnter = useCallback((event, cell) => {
    if (!cell || cell.type !== 'text') return;
    event.preventDefault();
    event.stopPropagation();
    setDragOverCellId(cell.id);
  }, []);

  const handleCellDragOver = useCallback((event, cell) => {
    if (!cell || cell.type !== 'text') return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.dataTransfer.dropEffect = 'copy';
    } catch {}
  }, []);

  const handleCellDragLeave = useCallback((event, cell) => {
    if (!cell || cell.type !== 'text') return;
    try {
      const related = event.relatedTarget;
      if (related && event.currentTarget && event.currentTarget.contains(related)) return;
    } catch {}
    setDragOverCellId((prev) => (prev === cell.id ? null : prev));
  }, []);

  const handleSavedViewDrop = useCallback(
    async (event, cell) => {
      if (!cell || cell.type !== 'text') return;
      event.preventDefault();
      event.stopPropagation();
      setDragOverCellId(null);

      const transfer = event.dataTransfer;
      let rawPayload = '';
      if (transfer) {
        try {
          rawPayload = transfer.getData('application/json') || transfer.getData('text/plain') || '';
        } catch {
          rawPayload = '';
        }
      }

      if (!rawPayload) return;
      let payload = null;
      try {
        payload = JSON.parse(rawPayload);
      } catch {
        payload = null;
      }
      if (!payload || payload.kind !== 'saved-view') return;

      const viewName = payload.viewName || 'Saved view';
      const viewContent = payload.content || {};
      const exportContext = viewContent.exportContext || viewContent.export_context || null;
      if (!exportContext || !exportContext.prompt || !exportContext.mode || !exportContext.model) {
        const message = 'Saved view is missing query context; unable to preview.';
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                  showOutput: true,
                  outputCollapsed: false,
                  outputData: [],
                  outputRaw: message,
                  outputActiveColumn: null,
                  outputTableProps: null,
                }
              : c,
          ),
        );
        const warnStamp = new Date().toLocaleTimeString();
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${warnStamp}] Saved view ${viewName} is missing export context.`],
        }));
        return;
      }

      const startStamp = new Date().toLocaleTimeString();
      setRunningCellId(cell.id);
      setCells((prev) =>
        prev.map((c) =>
          c.id === cell.id
            ? {
                ...c,
                showOutput: true,
                outputCollapsed: false,
                outputData: [],
                outputRaw: 'Loading saved view…',
                outputActiveColumn: null,
                outputTableProps: null,
              }
            : c,
        ),
      );
      setResults((prev) => ({
        ...prev,
        logs: [...prev.logs, `📥 [${startStamp}] Loading saved view ${viewName}.`],
      }));

      const viewTableOpsMode = viewContent.tableOpsMode ?? viewContent.table_ops_mode ?? effectiveTableOpsMode;
      const viewPushDownSetting = viewContent.pushDownDb ?? viewContent.push_down_db;
      const pushDownDb = typeof viewPushDownSetting === 'boolean' ? viewPushDownSetting : effectivePushDownDb;
      const headers = Array.isArray(viewContent.headers)
        ? viewContent.headers
        : Array.isArray(viewContent.visibleColumns)
          ? viewContent.visibleColumns
          : undefined;
      const pageSize = Math.max(1, Number(viewContent.pageSize) || TABLE_COMPONENT_DEFAULT_PAGE_SIZE);

      const requestBody = {
        model: exportContext.model,
        mode: exportContext.mode,
        prompt: exportContext.prompt,
        page: 1,
        pageSize,
        tableOpsMode: viewTableOpsMode,
        pushDownDb,
      };
      if (exportContext.baseSql) requestBody.baseSql = exportContext.baseSql;
      if (exportContext.columnTypes) requestBody.columnTypes = exportContext.columnTypes;
      if (exportContext.searchColumns) requestBody.searchColumns = exportContext.searchColumns;
      else if (headers) requestBody.searchColumns = headers;

      try {
        const res = await fetch('/api/table/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `HTTP ${res.status}`);
        }
        const json = await res.json();
        const rawRows = Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.data)
            ? json.data
            : [];
        let nextRows = normalizeRecords(rawRows);
        if (!nextRows.length && rawRows.length) {
          nextRows = rawRows.map((row) => {
            if (row && typeof row === 'object') return row;
            return { value: row };
          });
        }
        if (!nextRows.length && json && typeof json === 'object') {
          nextRows = normalizeRecords([json]);
        }

        const sanitizeName = (value) =>
          (value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const defaultName = cell.dfName
          || (sanitizeName(viewName) ? `${sanitizeName(viewName)}_${cell.id.slice(-4)}` : `view_${cell.id.slice(-4)}`);
        const resolvedDfName = defaultName || `view_${cell.id.slice(-4)}`;
        const finishStamp = new Date().toLocaleTimeString();

        setResults((prev) => {
          const logs = [...prev.logs];
          if (nextRows.length) logs.push(`✅ [${finishStamp}] Saved view ${viewName} loaded (${nextRows.length} rows).`);
          else logs.push(`ℹ️ [${finishStamp}] Saved view ${viewName} returned no rows.`);
          const dataFrames = nextRows.length ? { ...prev.dataFrames, [resolvedDfName]: nextRows } : prev.dataFrames;
          return {
            ...prev,
            table: nextRows.length ? nextRows : prev.table,
            dataFrame: nextRows.length ? nextRows : prev.dataFrame,
            dataFrames,
            activeDataFrameName: nextRows.length ? resolvedDfName : prev.activeDataFrameName,
            logs,
          };
        });

        const columns = nextRows.length && typeof nextRows[0] === 'object' ? Object.keys(nextRows[0] || {}) : [];
        const activeColumn = columns.length ? columns[0] : null;
        const totalRows = Number(json?.total) || nextRows.length;
        const resolvedServerMode = (() => {
          if (viewContent.serverMode !== undefined) return !!viewContent.serverMode;
          if (json?.serverMode !== undefined) return !!json.serverMode;
          if (exportContext && totalRows > nextRows.length) return true;
          return globalServerMode;
        })();
        const initialPageSize = Math.max(1, Number(viewContent.pageSize) || TABLE_COMPONENT_DEFAULT_PAGE_SIZE);
        const initialFontSize = Number(viewContent.fontSize) || 11;
        const initialViewState = viewContent.viewState || viewContent.view_state || viewContent.initialViewState || viewContent || null;
        const initialSchema = viewContent.initialSchema || viewContent.schema || null;
        const perfOptions = viewContent.perfOptions || viewContent.perf_options || { ...resolvedPerfOptions };
        const previewOptions = viewContent.previewOptions || viewContent.preview_options || { ...resolvedPreviewOptions };
        setCells((prev) =>
          prev.map((c) => {
            if (c.id !== cell.id) return c;
            return {
              ...c,
              dfName: resolvedDfName,
              showOutput: true,
              outputCollapsed: false,
              outputData: nextRows,
              outputRaw: nextRows.length ? '' : 'Saved view returned no rows.',
              outputActiveColumn: nextRows.length ? activeColumn : null,
              outputTableProps: {
                data: nextRows,
                exportContext,
                tableOpsMode: viewTableOpsMode,
                pushDownDb,
                totalRows,
                serverMode: resolvedServerMode,
                initialPageSize,
                initialFontSize,
                buttonsDisabled: false,
                previewOptions,
                perfOptions,
                initialViewState,
                initialSchema,
                virtualizeOnMaximize,
                virtualRowHeight: virtRowHeight,
              },
            };
          }),
        );
      } catch (error) {
        const message = error?.message || 'Failed to load saved view.';
        const failStamp = new Date().toLocaleTimeString();
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? {
                  ...c,
                showOutput: true,
                outputCollapsed: false,
                outputData: [],
                outputRaw: `Failed to load saved view: ${message}`,
                outputActiveColumn: null,
                outputTableProps: null,
              }
            : c,
        ),
      );
        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `⚠️ [${failStamp}] Saved view ${viewName} failed: ${message}`],
        }));
      } finally {
        setRunningCellId((prev) => (prev === cell.id ? null : prev));
      }
    },
    [setCells, setResults, setRunningCellId, setDragOverCellId],
  );

  return (
    <StandaloneChrome title="Notebook Workbench">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 24,
          padding: 28,
          background: '#0d111a',
          color: '#f1f6ff',
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        <aside
          style={{
            width: 280,
            background: 'rgba(13,18,28,0.85)',
            border: '1px solid rgba(40,58,84,0.6)',
            borderRadius: 12,
            padding: '16px 14px',
            boxShadow: '0 18px 32px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="workbench-model-select" style={{ fontSize: '0.8rem', color: '#d4e2ff', fontWeight: 600 }}>Model</label>
              <select
                id="workbench-model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(60,88,130,0.8)',
                  background: 'rgba(18,24,32,0.9)',
                  color: '#f2f6ff',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }}
              >
                <option value="None">None</option>
                <option value="dbLLM">Deutsche Bank - dbLLM</option>
                <option value="llama3.2:1b">LLaMA3.2:1b</option>
                <option value="codellama:7b-instruct">CodeLLaMA:7b-instruct</option>
                <option value="sqlcoder">SQLCoder:7b</option>
                <option value="gemma">Gemma</option>
                <option value="llama3">LLaMA3</option>
                <option value="mistral">Mistral</option>
                <option value="phi3">Phi-3</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="workbench-agent-select" style={{ fontSize: '0.8rem', color: '#d4e2ff', fontWeight: 600 }}>Agent</label>
              <select
                id="workbench-agent-select"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(60,88,130,0.8)',
                  background: 'rgba(18,24,32,0.9)',
                  color: '#f2f6ff',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }}
              >
                <option value="direct">Developer Assistant</option>
                <option value="database">Database - Direct Intent Routes</option>
                <option value="database1">Database - Direct Intent embeded nomodel Routes</option>
                <option value="restful">API Assistant (Trained)</option>
                <option value="langchain">Database Assistant (Un-Trained)</option>
                <option value="langchainprompt">Database Assistant (Partially Trained)</option>
                <option value="embedded">Database Assistant (Fully Trained)</option>
                <option value="webscrape">Documentation Assistant</option>
                <option value="riskdata">Data Analysis Assistant</option>
                <option value="embedded_narrated">Database Assistant with Narration</option>
                <option value="generic_rag">Database Assistant - Generic RAG</option>
              </select>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(56,74,104,0.6)', margin: '4px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={worksheetIcon} alt="" aria-hidden="true" style={{ width: 20, height: 20 }} />
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#eef5ff' }}>Saved Views</h2>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#92a8c7' }}>
            Quickly reopen curated worksheets to feed the notebook.
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingViews ? (
              <div style={{ color: '#9db6d8', fontSize: '0.82rem' }}>Loading views…</div>
            ) : viewsError ? (
              <div style={{ color: '#e89aa9', fontSize: '0.82rem' }}>{viewsError}</div>
            ) : savedViews.length === 0 ? (
              <div style={{ color: '#8396b2', fontSize: '0.82rem' }}>No saved views yet.</div>
            ) : (
              savedViews.map((view) => {
                const title = view.viewName || view.name || 'Untitled view';
                const handleOpen = () => {
                  try {
                    const params = new URLSearchParams({ page: 'worksheet-viewer' });
                    if (view.viewName) params.set('pinnedId', view.viewName);
                    window.open(`${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
                  } catch {}
                };
                return (
                  <button
                    key={`${view.viewName || view.name || view.id}`}
                    type="button"
                    onClick={handleOpen}
                    draggable
                    onDragStart={(event) => handleSavedViewDragStart(event, view)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(48,66,98,0.6)',
                      background: 'rgba(18,28,44,0.55)',
                      color: '#f0f6ff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                    }}
                  >
                    <img src={worksheetIcon} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
                    <span style={{ flex: 1 }}>{title}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', paddingRight: 4, flex: 1 }}>
          {cells.map((cell) => {
            const height = cell.type === 'text' ? 160 : 220;
            const isCollapsed = !!cell.collapsed;
            const dfLabel = cell.dfName ? `DataFrame: ${cell.dfName}` : 'No dataframe yet';
            const isDragTarget = cell.type === 'text' && dragOverCellId === cell.id;
            const outputWrapperStyleBase = {
              marginTop: 12,
              border: '1px solid rgba(56,74,104,0.6)',
              borderRadius: 10,
              padding: '10px 12px',
              background: 'rgba(18,24,36,0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            };
            const outputWrapperStyle = cell.outputTableProps
              ? { ...outputWrapperStyleBase, maxHeight: 520, minHeight: 260, overflow: 'auto' }
              : { ...outputWrapperStyleBase, maxHeight: 260, overflow: 'auto' };
            const outputContainerStyle = cell.outputTableProps
              ? { height: 380, overflow: 'auto', paddingRight: 4 }
              : { maxHeight: 180, overflow: 'auto', paddingRight: 4 };

            if (isCollapsed) {
              return (
                <section
                  key={cell.id}
                  style={{
                    ...cardStyle,
                    border: '1px solid #2c3b58',
                    padding: '6px 10px',
                    gap: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...(isDragTarget
                      ? {
                          border: '1px solid #5a8cff',
                          boxShadow: '0 0 0 2px rgba(90,140,255,0.35)',
                        }
                      : {}),
                  }}
                  onDragEnter={(event) => handleCellDragEnter(event, cell)}
                  onDragOver={(event) => handleCellDragOver(event, cell)}
                  onDragLeave={(event) => handleCellDragLeave(event, cell)}
                  onDropCapture={(event) => handleSavedViewDrop(event, cell)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(cell.id)}
                      style={{ border: 'none', background: 'transparent', color: '#96b8ff', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 6px' }}
                    >
                      Expand
                    </button>
                    <span style={{ color: '#f1f6ff', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cell.title}
                    </span>
                    <span style={{ color: '#7ea2d8', fontSize: '0.75rem' }}>• {cell.type.toUpperCase()}</span>
                    <span style={{ color: '#5f7baf', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{dfLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => runCell(cell)}
                      disabled={runningCellId === cell.id}
                      style={{ border: 'none', background: 'transparent', padding: 4, opacity: runningCellId === cell.id ? 0.6 : 1, cursor: runningCellId === cell.id ? 'default' : 'pointer' }}
                      aria-label="Run cell"
                      title="Run cell"
                    >
                      {runningCellId === cell.id ? (
                        <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(120,170,255,0.35)', borderTopColor: 'rgba(120,170,255,0.85)', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <img src={runIcon} alt="Run" style={{ width: 20, height: 20 }} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={addCell}
                      style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                      aria-label="Add cell"
                      title="Add cell"
                    >
                      <img src={addCellIcon} alt="Add" style={{ width: 18, height: 18 }} />
                    </button>
                    {cells.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCell(cell.id)}
                        style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                        aria-label="Delete cell"
                        title="Delete cell"
                      >
                        <img src={removeCellIcon} alt="Remove" style={{ width: 18, height: 18 }} />
                      </button>
                    )}
                  </div>
                </section>
              );
            }

            return (
              <section
                key={cell.id}
                style={{
                  ...cardStyle,
                  border: '1px solid #2c3b58',
                  overflow: 'hidden',
                  ...(isDragTarget
                    ? {
                        border: '1px solid #5a8cff',
                        boxShadow: '0 0 0 2px rgba(90,140,255,0.35)',
                      }
                    : {}),
                }}
                onDragEnter={(event) => handleCellDragEnter(event, cell)}
                onDragOver={(event) => handleCellDragOver(event, cell)}
                onDragLeave={(event) => handleCellDragLeave(event, cell)}
                onDropCapture={(event) => handleSavedViewDrop(event, cell)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid rgba(45,66,94,0.65)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label htmlFor={`mode-select-${cell.id}`} style={{ fontSize: '0.8rem', color: '#8da8cc' }}>
                      Mode
                    </label>
                    <select
                      id={`mode-select-${cell.id}`}
                      value={cell.type}
                      onChange={(e) => updateCellType(cell.id, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(52,82,120,0.8)',
                        background: 'rgba(18,24,32,0.9)',
                        color: '#f2f6ff',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                      }}
                    >
                      <option value="text">NLP</option>
                      <option value="python">Python</option>
                      <option value="sql">SQL</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(cell.content || '')}
                      title="Copy cell contents"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                      }}
                      aria-label="Copy cell"
                    >
                      <img src={copyIcon} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
                    </button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#9bb8ff' }}>
                      <input
                        type="checkbox"
                        checked={!!cell.showOutput}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCells((prev) =>
                            prev.map((c) =>
                              c.id === cell.id
                                ? {
                                    ...c,
                                    showOutput: checked,
                                    outputCollapsed: false,
                                    outputData: checked ? c.outputData : null,
                                    outputActiveColumn: checked && Array.isArray(c.outputData) && c.outputData.length
                                      ? Object.keys(c.outputData[0] || {})[0] || null
                                      : null,
                                    outputTableProps: checked ? c.outputTableProps : null,
                                  }
                                : c,
                            ),
                          );
                        }}
                      />
                      Inline output
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(cell.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        color: '#96b8ff',
                        fontSize: '0.78rem',
                      }}
                    >
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#7ea2d8' }}>{dfLabel}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                  <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                    <div>
                      <h2 style={{ margin: '8px 0 4px', fontSize: '1.1rem', color: '#f5f9ff' }}>{cell.title}</h2>
                      <span style={{ fontSize: '0.8rem', color: '#8da8cc' }}>{cell.placeholder}</span>
                    </div>
                  </header>
                  <div style={{ border: '1px solid #202c44', borderRadius: 10, overflow: 'hidden' }}>
                    <Editor
                      height={height}
                      language={cell.language}
                      theme="vs-dark"
                      value={cell.content}
                      onChange={(value) => updateCellContent(cell.id, value ?? '')}
                      onMount={(editorInstance, monacoInstance) => {
                        try {
                          editorInstance.addCommand(
                            monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
                            () => runCell(cell),
                          );
                        } catch {}
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                {cell.showOutput && (
                  <div style={outputWrapperStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: '0.8rem', color: '#9db8e6' }}>Inline Output ({cell.dfName || dfLabel.replace('DataFrame: ', '')})</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCells((prev) =>
                            prev.map((c) =>
                              c.id === cell.id
                                ? { ...c, outputCollapsed: !c.outputCollapsed }
                                : c,
                            ),
                          )
                        }
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                          color: '#96b8ff',
                          fontSize: '0.78rem',
                        }}
                      >
                        {cell.outputCollapsed ? 'Expand Output' : 'Collapse Output'}
                      </button>
                    </div>
                    {cell.outputCollapsed ? (
                      <div style={{ fontSize: '0.78rem', color: '#859bbd' }}>Output hidden. Expand to review the last run.</div>
                    ) : (
                      <div style={outputContainerStyle}>{renderOutputPreview(cell)}</div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => runCell(cell)}
                    disabled={runningCellId === cell.id}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: runningCellId === cell.id ? 'default' : 'pointer',
                      padding: 4,
                      opacity: runningCellId === cell.id ? 0.6 : 1,
                    }}
                    aria-label="Run cell"
                    title="Run cell"
                  >
                    {runningCellId === cell.id ? (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: '2px solid rgba(120,170,255,0.35)',
                          borderTopColor: 'rgba(120,170,255,0.85)',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    ) : (
                      <img src={runIcon} alt="Run" style={{ width: 20, height: 20 }} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={addCell}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                    aria-label="Add cell"
                    title="Add cell"
                  >
                    <img src={addCellIcon} alt="Add" style={{ width: 18, height: 18 }} />
                  </button>
                  {cells.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCell(cell.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      aria-label="Delete cell"
                      title="Delete cell"
                    >
                      <img src={removeCellIcon} alt="Remove" style={{ width: 18, height: 18 }} />
                    </button>
                  )}
                </div>
              </section>
            );
          })}
    </div>

        <section style={{ ...cardStyle, border: '1px solid #2c3b58', marginBottom: 12 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>NotebookSLM</h2>
            <span style={{ fontSize: '0.75rem', color: '#8da8cc' }}>Use names in downstream scripts</span>
          </header>

          <div style={{ border: '1px solid #26324a', borderRadius: 10, padding: 12, background: 'rgba(18,24,36,0.9)', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto' }}>
            <div style={{ fontSize: '0.82rem', color: '#9db8e6' }}>Active dataframe: <span style={{ color: '#eef4ff', fontWeight: 600 }}>{results.activeDataFrameName || '—'}</span></div>
            <div style={{ fontSize: '0.78rem', color: '#7fa2d1' }}>Available:</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(results.dataFrames || {}).map(([name, data]) => (
                <li key={name} style={{ color: '#d5e4ff', fontSize: '0.82rem' }}>
                  {name} <span style={{ color: '#7fa2d1' }}>({Array.isArray(data) ? data.length : 0} rows)</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{
            border: '1px solid #26324a',
            borderRadius: 10,
            padding: 12,
            background: 'rgba(18,24,36,0.9)',
            height: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{
              fontSize: '0.8rem',
              color: '#7fa2d1',
            }}>
              Execution Log
            </div>
            <div style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', paddingRight: 6 }}>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#d5e4ff', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', width: '100%' }}>
                {results.logs.map((line, idx) => (
                  <li key={`${line}-${idx}`}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </StandaloneChrome>
  );
}
