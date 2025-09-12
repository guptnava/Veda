# Frontend (Vite + React)

Entry: `client/src/main.jsx`, root components under `client/src/components/`.

## Notable Components

- `HeaderBar.jsx`
  - Brand block, model/agent selectors, settings popover, training manager link.
  - Exposes performance and table control toggles.
  - Opens Streamlit Training Manager in a new tab (configurable URL).

- `LeftPanel.jsx`
  - Collapsible panel for sliders (temperature, top‑K/P, cosine threshold).
  - Command history (search, export/import JSON).

- `TableComponent.jsx`
  - High‑volume table rendering with optional virtualization (react‑window).
  - Toolbar for columns, filters, pivot, conditional formatting, charts.
  - Collapsible cell for long values; modal expansion preserved for virtualized lists.

- `ChartPanel.jsx`
  - Lazy‑loaded panel to render charts for selected data.

## Streaming

The UI consumes `application/x-ndjson` for DB modes via the Node proxy. Each line is parsed into a row and appended to the current result set; narration to LLM can be toggled.

## Theming/Assets

Icons live in `client/src/icons/`. Styles in `client/src/Veda.css`. Many icons can be overridden by passing custom URLs/paths as props.

