import '@testing-library/jest-dom';

// Browser-only stubs. Server/API tests opt into the node environment
// (`@jest-environment node`), where `window` is absent — guard so this shared
// setup runs cleanly in both environments.
if (typeof window !== 'undefined') {
  // Ant Design components (and its responsive observer) call matchMedia and
  // ResizeObserver, which jsdom does not implement. Provide minimal stubs.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });

  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (global as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}

// jsdom lacks getComputedStyle transitions used by antd's wave effect; silence
// the noisy "not implemented" warnings without hiding real errors.
const originalError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('Not implemented: HTMLCanvasElement') || msg.includes('scrollTo')) return;
    originalError(...(args as []));
  });
});
afterAll(() => {
  (console.error as jest.Mock).mockRestore?.();
});
