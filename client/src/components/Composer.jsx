import React from 'react';

const Composer = ({ inputRef, loading, onSubmit, onKeyDown, onStop }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.();
  };
  return (
    <form onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        placeholder="Ask me........."
        onKeyDown={onKeyDown}
        disabled={loading}
        rows={3}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" className="button-primary" style={{ minWidth: '100px' }} disabled={loading}>
          {loading ? 'Loading...' : 'Send'}
        </button>
        {loading && (
          <button type="button" className="button-primary" onClick={onStop} aria-label="Stop response" title="Stop response">
            Stop
          </button>
        )}
      </div>
    </form>
  );
};

export default Composer;
