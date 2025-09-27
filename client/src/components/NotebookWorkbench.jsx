import React, { useState, useCallback, useEffect } from 'react';
import StandaloneChrome from './StandaloneChrome';
import Editor from '@monaco-editor/react';
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
    content: 'Summarize regional performance and highlight outliers.',
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
    placeholder: 'import pandas as pd\nimport numpy as np',
    content: 'import pandas as pd\nimport numpy as np\n\nsummary = df.assign(target=lambda d: d["revenue"] * 0.12)\nsummary',
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

export default function NotebookWorkbench() {
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

        setResults((prev) => ({
          ...prev,
          logs: [...prev.logs, `📡 [${stamp}] Sending NLP prompt using model ${model || 'default'} and agent ${agent}.`],
        }));

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt,
              mode: agent,
              stream: false,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`${res.status} ${res.statusText}: ${errorText}`);
          }

          const contentType = res.headers.get('content-type') || '';
          let payload;
          if (contentType.includes('application/json')) {
            payload = await res.json();
          } else {
            payload = await res.text();
          }

          let outputText = '';
          let nextTable = null;

          if (Array.isArray(payload)) {
            if (payload.length && typeof payload[0] !== 'object') {
              nextTable = payload.map((value, idx) => ({ index: idx, value }));
            } else {
              nextTable = payload;
            }
            outputText = `Received ${payload.length} rows.`;
          } else if (payload && typeof payload === 'object') {
            if (Array.isArray(payload.rows)) nextTable = payload.rows;
            else if (Array.isArray(payload.tableData)) nextTable = payload.tableData;
            else if (Array.isArray(payload.data)) nextTable = payload.data;

            if (typeof payload.response === 'string') outputText = payload.response;
            else if (typeof payload.answer === 'string') outputText = payload.answer;
            else outputText = JSON.stringify(payload, null, 2);
          } else {
            outputText = String(payload ?? '');
          }

          if (!nextTable || nextTable.length === 0) {
            nextTable = outputText
              ? [
                  {
                    response: outputText,
                  },
                ]
              : [];
          }

          setResults((prev) => {
            const dataFrames = { ...prev.dataFrames, [dfName]: nextTable };
            const logs = [
              ...prev.logs,
              `🤖 [${stamp}] NLP completed (${nextTable.length} rows captured).`,
              `📦 [${stamp}] Output stored as ${dfName}.`,
            ];
            return {
              ...prev,
              table: prev.table,
              dataFrame: nextTable.length ? nextTable : prev.dataFrame,
              dataFrames,
              activeDataFrameName: dfName,
              logs,
            };
          });
          setCells((prev) =>
            prev.map((c) => {
              if (c.id !== cell.id) return c;
              if (c.showOutput) {
                return { ...c, dfName, outputData: nextTable, outputCollapsed: false };
              }
              return { ...c, dfName, outputData: null };
            }),
          );
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            logs: [...prev.logs, `⚠️ [${stamp}] NLP error: ${err.message}`],
          }));
        } finally {
          if (!silent) setRunningCellId(null);
        }
        return;
      }

      setResults((prev) => {
        const next = { ...prev };
        const activeName = prev.activeDataFrameName;
        const sourceTable = (activeName && Array.isArray(prev.dataFrames?.[activeName]) && prev.dataFrames[activeName].length)
          ? prev.dataFrames[activeName]
          : baseTable;
        let nextData = sourceTable.map((row) => ({ ...row }));

        if (cell.type === 'sql') {
          let filtered = nextData;
          if (cell.content?.toLowerCase().includes('where')) {
            filtered = filtered.filter((row) => {
              if (typeof row.growth === 'number') return row.growth >= 12;
              return true;
            });
          }
          nextData = filtered;
          next.logs = [...prev.logs, `🗃️ [${stamp}] SQL cell executed (${filtered.length} rows).`];
        } else if (cell.type === 'python') {
          const scale = cell.content?.includes('target') ? 0.15 : 0.12;
          const transformed = sourceTable.map((row) => ({
            ...row,
            revenueForecast:
              typeof row.revenue === 'number'
                ? Math.round(row.revenue * (1 + scale))
                : row.revenue,
          }));
          nextData = transformed;
          next.logs = [...prev.logs, `🐍 [${stamp}] Python cell executed. Updated revenue targets (+${Math.round(scale * 100)}%).`];
        }

        const dataFrames = { ...prev.dataFrames, [dfName]: nextData };
        next.dataFrame = nextData;
        next.dataFrames = dataFrames;
        next.activeDataFrameName = dfName;
        next.logs = [...next.logs, `📦 [${stamp}] Output stored as ${dfName}.`];
        next.table = prev.table;

        if (!silent) {
          next.logs = [...next.logs, `✅ [${stamp}] ${cell.title} finished.`];
        }
        return next;
      });
      setCells((prev) =>
        prev.map((c) => {
          if (c.id !== cell.id) return c;
          if (c.showOutput) {
            return { ...c, dfName, outputData: nextData, outputCollapsed: false };
          }
          return { ...c, dfName, outputData: null };
        }),
      );
      if (!silent) setRunningCellId(null);
    },
    [agent, model, cells],
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

  const renderOutputPreview = (data) => {
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
        return (
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid rgba(52,82,120,0.6)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ecf3ff', fontSize: '0.85rem' }}>
              <thead style={{ background: 'rgba(32,54,92,0.55)' }}>
                <tr>
                  {columns.map((col) => (
                    <th key={col} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #2d3e5a' }}>
                      {col.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((row, idx) => (
                  <tr key={`row-${idx}`} style={{ background: idx % 2 === 0 ? 'rgba(22,27,36,0.65)' : 'rgba(18,24,32,0.65)' }}>
                    {columns.map((col) => (
                      <td key={`${col}-${idx}`} style={{ padding: '8px 10px', borderBottom: '1px solid #222d40' }}>
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > slice.length && (
              <div style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#8ca4cb' }}>
                Showing first {slice.length} of {data.length} rows.
              </div>
            )}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', paddingRight: 4, flex: 1 }}>
          {cells.map((cell) => {
            const height = cell.type === 'text' ? 160 : 220;
            const isCollapsed = !!cell.collapsed;
            const dfLabel = cell.dfName ? `DataFrame: ${cell.dfName}` : 'No dataframe yet';

            return (
              <section key={cell.id} style={{ ...cardStyle, border: '1px solid #2c3b58', overflow: 'hidden' }}>
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

                {!isCollapsed ? (
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
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 4px', color: '#7f96b5', fontSize: '0.85rem' }}>
                    Cell collapsed. Expand to edit or review contents.
                  </div>
                )}

                {cell.showOutput && (
                  <div style={{ marginTop: 12, border: '1px solid rgba(56,74,104,0.6)', borderRadius: 10, padding: '10px 12px', background: 'rgba(18,24,36,0.85)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      <div>{renderOutputPreview(cell.outputData)}</div>
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
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>DataFrames & Logs</h2>
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

          <div style={{ border: '1px solid #26324a', borderRadius: 10, padding: 12, background: 'rgba(18,24,36,0.9)', maxHeight: 160, overflow: 'auto' }}>
            <div style={{ fontSize: '0.8rem', color: '#7fa2d1', marginBottom: 6 }}>Execution Log</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#d5e4ff', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.logs.map((line, idx) => (
                <li key={`${line}-${idx}`}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </StandaloneChrome>
  );
}
