import React, { useEffect } from 'react';
import StandaloneChrome from './StandaloneChrome';

const containerStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '24px 32px',
  gap: 24,
  color: '#d9e6f5',
};

const sectionStyle = {
  background: 'linear-gradient(180deg, rgba(30,36,45,0.96) 0%, rgba(18,22,28,0.98) 100%)',
  border: '1px solid rgba(82,104,132,0.4)',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 18px 42px rgba(3,6,12,0.35)',
};

const gridStyle = {
  display: 'grid',
  gap: 18,
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
};

const cardStyle = {
  borderRadius: 10,
  padding: '16px 18px',
  background: 'rgba(15,20,26,0.92)',
  border: '1px solid rgba(82,104,132,0.42)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
};

function WorkflowStudioInner({ onFooterMetricsChange = () => {}, refreshHeapUsage = () => {} }) {
  useEffect(() => {
    onFooterMetricsChange({ rowsFetchedTotal: 0, avgResponseTime: NaN });
    refreshHeapUsage();
  }, [onFooterMetricsChange, refreshHeapUsage]);

  return (
    <div style={containerStyle}>
      <header style={sectionStyle}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 600, letterSpacing: '0.01em' }}>Workflow Studio</h1>
        <p style={{ marginTop: 10, maxWidth: 720, lineHeight: 1.5, color: '#9fb6d9' }}>
          Prototype workspace to blueprint and automate analytics workflows. Add pipeline stages,
          capture data source requirements, and assign ownership before handing off to delivery teams.
        </p>
      </header>

      <section style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#bed5ff' }}>Quick Starters</h2>
        <div style={gridStyle}>
          {[
            { title: 'New Workflow', description: 'Spin up a blank workflow canvas with swimlanes for analysts, engineers, and reviewers.' },
            { title: 'Data Quality Runbook', description: 'Draft validation checkpoints, escalation paths, and automated alerts for mission-critical datasets.' },
            { title: 'Experiment Tracker', description: 'Track hypotheses, metrics, and rollout plans for experimentation programs.' },
          ].map(({ title, description }) => (
            <article key={title} style={cardStyle}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
              <p style={{ margin: 0, lineHeight: 1.45, color: '#9fb6d9' }}>{description}</p>
              <button
                type="button"
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(109,167,255,0.55)',
                  background: 'rgba(38,76,122,0.35)',
                  color: '#cfe4ff',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                }}
              >
                Launch Template
              </button>
            </article>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.05rem', fontWeight: 600, color: '#bed5ff' }}>Upcoming Integrations</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: '#9fb6d9' }}>
          <li>Create workflow milestones</li>
          <li>Embed widgets from Worksheet Studio.</li>
          <li>Push runbooks and playbooks directly to the Time Studio timeline.</li>
        </ul>
      </section>
    </div>
  );
}

export default function WorkflowStudio() {
  return (
    <StandaloneChrome title="Workflow Studio">
      <WorkflowStudioInner />
    </StandaloneChrome>
  );
}
