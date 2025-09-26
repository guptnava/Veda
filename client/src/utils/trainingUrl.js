export function resolveTrainingUrl() {
  try {
    const stored = localStorage.getItem('veda.trainingUrl');
    if (stored) return stored;
  } catch {}

  try {
    const { protocol, hostname } = window.location || {};
    const proto = protocol || 'http:';
    const host = hostname || 'localhost';
    return `${proto}//${host}:8501`;
  } catch {}

  return 'http://localhost:8501';
}

export function openTrainingManager(url) {
  const target = url || resolveTrainingUrl();
  try {
    window.open(target, '_blank', 'noopener');
  } catch {}
}

