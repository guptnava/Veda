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
  background: 'linear-gradient(180deg, rgba(32,35,45,0.96) 0%, rgba(16,18,24,0.98) 100%)',
  border: '1px solid rgba(84,108,138,0.4)',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 18px 42px rgba(3,6,12,0.35)',
};

const timelineRowStyle = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: 16,
  alignItems: 'flex-start',
};

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(80,136,255,0.18)',
  border: '1px solid rgba(132,178,255,0.4)',
  color: '#bed5ff',
  fontSize: '0.78rem',
  fontWeight: 500,
};

function TimeStudioInner({ onFooterMetricsChange = () => {}, refreshHeapUsage = () => {} }) {
  useEffect(() => {
    onFooterMetricsChange({ rowsFetchedTotal: 0, avgResponseTime: NaN });
    refreshHeapUsage();
  }, [onFooterMetricsChange, refreshHeapUsage]);

  const demoTimeline = [
    { label: '08:00', title: 'Daily Market Sync', detail: 'Review overnight market movement and update positioning checklist.' },
    { label: '09:30', title: 'Data Pipeline QA', detail: 'Verify ingestion jobs, reconcile exceptions, and confirm dashboard freshness.' },
    { label: '11:00', title: 'Experiment Window', detail: 'Run scheduled experiments and monitor guardrail metrics in near-real-time.' },
    { label: '14:30', title: 'Stakeholder Review', detail: 'Share insights packages and capture follow-up tasks directly from the session.' },
    { label: '16:00', title: 'Automation Backfill', detail: 'Trigger catch-up tasks for workflows that missed their SLA earlier in the day.' },
  ];

  return (
    <div style={containerStyle}>
      <header style={sectionStyle}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 600, letterSpacing: '0.01em' }}>Time Studio</h1>
        <p style={{ marginTop: 10, maxWidth: 720, lineHeight: 1.5, color: '#9fb6d9' }}>
          Visualize scheduled work, recurring rituals, and automation cadences. Balance real-time
          insights with batch processes by mapping analytics commitments to a single, shared timeline.
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={pillStyle}>Team Rituals</span>
          <span style={pillStyle}>Automation Windows</span>
          <span style={pillStyle}>Service Levels</span>
        </div>
      </header>

      <section style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#bed5ff' }}>Sample Timeline</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {demoTimeline.map(({ label, title, detail }) => (
            <div key={label} style={{ ...timelineRowStyle, borderLeft: '2px solid rgba(126,162,255,0.55)', paddingLeft: 18 }}>
              <div style={{ color: '#8fa6c4', fontWeight: 600, letterSpacing: '0.06em' }}>{label}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
                <p style={{ margin: '6px 0 0', lineHeight: 1.45, color: '#9fb6d9' }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.05rem', fontWeight: 600, color: '#bed5ff' }}>Planned Features</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: '#9fb6d9' }}>
          <li>Overlay Worksheet Studio refresh jobs to spot workload conflicts.</li>
          <li>Stream dashboard alerting windows directly from Veda automations.</li>
          <li>Export shared runbooks from Workflow Studio as scheduled steps.</li>
        </ul>
      </section>
    </div>
  );
}

export default function TimeStudio() {
  return (
    <StandaloneChrome title="Time Studio">
      <TimeStudioInner />
    </StandaloneChrome>
  );
}
