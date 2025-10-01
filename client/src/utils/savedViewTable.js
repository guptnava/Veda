// Helper utilities to hydrate saved view metadata into TableComponent props
// Used by WorksheetViewer and DashboardViewer to render saved table previews.

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const getFieldValue = (source, candidates) => {
  if (!source || !Array.isArray(candidates)) return undefined;
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

export const getPinnedIdFromSavedView = (view) => {
  const direct = getFieldValue(view, ['pinId', 'pin_id', 'pinnedId', 'pinned_id', 'PIN_ID', 'PINID']);
  if (direct) return String(direct).trim();
  const rawContent = getFieldValue(view, ['content', 'CONTENT', 'viewState', 'view_state']);
  if (rawContent && typeof rawContent === 'object') {
    const inner = getFieldValue(rawContent, ['pinId', 'pin_id', 'pinnedId', 'pinned_id', 'PIN_ID', 'PINID']);
    if (inner) return String(inner).trim();
  }
  return '';
};

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

export const parseSavedViewContent = (view) => {
  const rawContent = getFieldValue(view, ['content', 'CONTENT', 'viewState', 'view_state']);
  if (rawContent === undefined || rawContent === null) return null;

  const topLevel = parseMaybeJson(rawContent);
  if (!isObject(topLevel)) return null;

  const nestedState = parseMaybeJson(getFieldValue(topLevel, ['viewState', 'view_state', 'state', 'STATE']));
  if (isObject(nestedState)) {
    return { state: nestedState, root: topLevel };
  }

  return { state: topLevel, root: topLevel };
};

const ensureHeaders = (schema, state, topLevel) => {
  const cascadeHeaders = (candidate) => {
    if (!Array.isArray(candidate) || candidate.length === 0) return null;
    return candidate;
  };

  if (!schema.headers) {
    const fromState = cascadeHeaders(state?.headers);
    if (fromState) {
      schema.headers = fromState;
    } else {
      const fromTop = cascadeHeaders(topLevel?.headers);
      if (fromTop) schema.headers = fromTop;
    }
  }

  return schema;
};

const normalizeRows = (rows, headers) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: [], headers: Array.isArray(headers) ? headers : [] };
  }

  const headerNames = Array.isArray(headers)
    ? headers.map((header, idx) => {
        if (typeof header === 'string') return header;
        if (header && typeof header === 'object') {
          return header.name || header.field || header.title || header.label || `col_${idx}`;
        }
        return `col_${idx}`;
      })
    : [];

  if (!headerNames.length) {
    const filtered = rows.filter((row) => row && typeof row === 'object');
    return { rows: filtered, headers: headerNames };
  }

  const normalized = rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return row;
    }
    if (!Array.isArray(row)) return {};
    const obj = {};
    headerNames.forEach((header, idx) => {
      obj[header] = row[idx];
    });
    return obj;
  });

  return { rows: normalized, headers: headerNames };
};

export const buildTablePropsForSavedView = (view) => {
  if (!view) return null;

  const parsed = parseSavedViewContent(view);
  const rawState = parsed?.state;
  const topLevel = parsed?.root;
  if (!isObject(rawState)) return null;

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

  if (isObject(topLevel)) {
    if (!state.exportContext && topLevel.exportContext) {
      state.exportContext = topLevel.exportContext;
    }
    if (!state.exportContext && isObject(topLevel.content)) {
      const contentExport = getFieldValue(topLevel.content, ['exportContext', 'export_context', 'EXPORT_CONTEXT']);
      if (contentExport) state.exportContext = contentExport;
    }
    if (!state.exportContext && isObject(topLevel.viewState)) {
      const nestedExport = getFieldValue(topLevel.viewState, ['exportContext', 'export_context', 'EXPORT_CONTEXT']);
      if (nestedExport) state.exportContext = nestedExport;
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
    ...((isObject(topLevel) && topLevel.options) || {}),
    ...(isObject(state.options) ? state.options : {}),
  };
  const schemaCandidate =
    (isObject(topLevel) && topLevel.schema)
    || (isObject(state.schema) ? state.schema : null)
    || state.initialSchema
    || {};
  const schema = ensureHeaders({ ...(schemaCandidate || {}) }, state, topLevel);
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
    ...((isObject(topLevel) && topLevel.query) || {}),
    ...(isObject(state.query) ? state.query : {}),
  };

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

  const rowsRaw = Array.isArray(state.rows)
    ? state.rows
    : (Array.isArray(state.data)
      ? state.data
      : (Array.isArray(state.previewRows)
        ? state.previewRows
        : (Array.isArray(state.preview?.rows) ? state.preview.rows : [])));
  const { rows: normalizedRows, headers: normalizedHeaders } = normalizeRows(rowsRaw, schema.headers || state.headers || topLevel?.headers || []);
  if (normalizedHeaders.length && (!schema.headers || schema.headers.length !== normalizedHeaders.length)) {
    schema.headers = normalizedHeaders;
  }
  const exportCtx = state.exportContext || options.exportContext || query.exportContext || null;
  const hasRows = normalizedRows.length > 0;
  const resolvedServerMode = state.serverMode !== undefined
    ? state.serverMode
    : (typeof options.serverMode === 'boolean' ? options.serverMode : true);
  const effectiveServerMode = exportCtx ? true : (hasRows ? false : resolvedServerMode);
  const tableData = exportCtx ? [] : normalizedRows;
  const totalRows = exportCtx
    ? (options.totalRows ?? state.totalRows ?? normalizedRows.length)
    : (normalizedRows.length || options.totalRows || state.totalRows || 0);

  return {
    datasetSig: datasetSig ? String(datasetSig) : '',
    owner: owner ? String(owner) : undefined,
    tableProps: {
      data: tableData,
      initialPageSize: options.initialPageSize ?? state.pageSize ?? 100,
      initialFontSize: options.initialFontSize ?? state.fontSize ?? 11,
      buttonPermissions: options.buttonPermissions,
      perfOptions: options.perfOptions,
      previewOptions: options.previewOptions,
      exportContext: exportCtx,
      totalRows,
      serverMode: effectiveServerMode,
      tableOpsMode: options.tableOpsMode ?? state.tableOpsMode ?? 'flask',
      pushDownDb: options.pushDownDb ?? state.pushDownDb ?? false,
      virtualizeOnMaximize: options.virtualizeOnMaximize ?? state.virtualizeOnMaximize ?? true,
      virtualRowHeight: options.virtualRowHeight ?? state.virtualRowHeight ?? 28,
      initialMaximized: false,
      showMaximizeControl: true,
      initialViewState: state,
      initialSchema: options.initialSchema || schema,
    },
  };
};

export const extractSavedViewDetails = (view) => {
  if (!view) return null;
  const viewName = getFieldValue(view, ['viewName', 'view_name', 'VIEW_NAME', 'name']) || '';
  const datasetSig = getFieldValue(view, ['datasetSig', 'dataset_sig', 'DATASET_SIG', 'dataset', 'DATASET']) || '';
  const ownerName = getFieldValue(view, ['ownerName', 'owner_name', 'OWNER_NAME', 'owner', 'OWNER']) || '';
  const rawCreated = getFieldValue(view, ['createdAt', 'created_at', 'CREATED_AT']) || '';
  const rawContent = getFieldValue(view, ['content', 'CONTENT', 'viewState', 'view_state']);

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
};
