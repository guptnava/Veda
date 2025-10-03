import React from 'react';
import StandaloneChrome from './StandaloneChrome';
import notebookIcon from '../icons/notebook.svg';
import dashboardViewerIcon from '../icons/dashboard_viewer.svg';
import worksheetIcon from '../icons/worksheet_viewer.svg';
import dashboardBuilderIcon from '../icons/dashboard_builder.svg';
import trainingIcon from '../icons/training.svg';
import dataQualityIcon from '../icons/dataquality.svg';
import dataCatalogIcon from '../icons/add_cell.svg';
import workflowStudioIcon from '../icons/workflow_studio.svg';
import timeStudioIcon from '../icons/time_studio.svg';
import vedaIcon from '../icons/aimesh.svg';
import menuIcon from '../icons/hamburger.png';
import dashboardTheme from '../theme/dashboardTheme';

const cardStyle = {
  flex: '1 1 240px',
  minHeight: 160,
  borderRadius: 12,
  border: '1px solid #243047',
  background: 'linear-gradient(160deg, #1b2230 0%, #121722 100%)',
  padding: '18px 20px',
  color: '#f0f4ff',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.35)'
};

const theme = dashboardTheme;

export default function DataScienceBench() {
  return (
    <StandaloneChrome title="ConBI Bench">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 28, gap: 28, background: '#0f1219', color: '#f0f4ff' }}>
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <img src={menuIcon} alt="" aria-hidden="true" style={{ width: 32, height: 32 }} />
            <img src={vedaIcon} alt="Veda" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <h1 style={{ margin: 0, fontSize: '1.0rem', fontWeight: 700 }}>
              <span style={{ color: theme.textPrimary }}>Con</span>
              <span style={{ color: theme.accent }}>BI</span>
              {' '}Bench
            </h1>
          </div>
          <p style={{ marginTop: 10, maxWidth: 620, color: '#9eb4d9' }}>
            Launch quick experiments, data exploration, and jump into dashboards from a single workspace. Use the cards below to
            navigate to the tools you need.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
            alignItems: 'stretch',
            paddingTop: 16,
          }}
        >
          {[
            {
              title: 'NotebookSLM Sessions',
              description:
                'Spin up an in-browser session connected to  SLM runtime. Perfect for quick exploratory analysis and prototyping.',
              buttonLabel: 'Open Notebook',
              icon: notebookIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=notebook-workbench`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'AI Model Training',
              description:
                'Manage datasets, monitor experiment runs, and trigger fine-tuning jobs without leaving the bench.',
              buttonLabel: 'Open Trainer',
              icon: trainingIcon,
              onClick: () => {
                try { window.open('http://localhost:8501', '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Worksheets Studio',
              description:
                'Browse curated worksheets shared by your team. Seamlessly pivot to dashboard mode when you are ready to publish.',
              buttonLabel: 'Go to Worksheets',
              icon: worksheetIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=worksheet-viewer`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Dashboard Studio',
              description:
                'Assemble interactive dashboards from saved worksheets with drag-and-drop precision, then publish to your viewers.',
              buttonLabel: 'Launch Builder',
              icon: dashboardBuilderIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?dashboard=1`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Dashboard Browser',
              description:
                'Launch the published dashboards your team maintains. Filter, interact, and inspect saved layouts with familiar controls.',
              buttonLabel: 'Open Viewer',
              icon: dashboardViewerIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=dashboard-viewer`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'WorkFlow Studio',
              description:
                'Prototype workspace to blueprint and automate analytics workflows. Add pipeline stages.',
              buttonLabel: 'Open Studio',
              icon: workflowStudioIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=workflow-studio`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Time Studio',
              description:
                'Visualize scheduled work, recurring workflows, and automation cadences.',
              buttonLabel: 'View Timeline',
              icon: timeStudioIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=time-studio`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Data Quality',
              description:
                'Review datasets quality, monitor KPIs and scores, and coordinate remediation tasks across teams.',
              buttonLabel: 'Launch Runbooks',
              icon: dataQualityIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=data-quality`, '_blank', 'noopener'); } catch {}
              },
            },
            {
              title: 'Meta Repository',
              description:
                'Browse governed datasets, inspect lineage, and much more without leaving the analytics workspace.',
              buttonLabel: 'Open Repository',
              icon: dataCatalogIcon,
              onClick: () => {
                try { window.open(`${window.location.pathname}?page=data-catalog`, '_blank', 'noopener'); } catch {}
              },
            },
          ].map(({ title, description, buttonLabel, icon, onClick }) => (
            <div key={title} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={icon} alt="" aria-hidden="true" style={{ width: 32, height: 32 }} />
                <div style={{ fontSize: '1.15rem', fontWeight: 600 }}>{title}</div>
              </div>
              <div style={{ color: '#b2c5e4', fontSize: '0.95rem' }}>{description}</div>
              <button
                type="button"
                onClick={onClick}
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #1e5b86',
                  background: '#0e639c',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {buttonLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </StandaloneChrome>
  );
}
