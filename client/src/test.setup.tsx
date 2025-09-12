import '@testing-library/jest-dom';

// Polyfills/mocks for tests
if (!window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    media: ''
  });
}

if (!window.open) {
  window.open = () => null as unknown as Window;
}

