import '@testing-library/jest-dom/vitest';

// jsdom has no canvas or ResizeObserver; the components handle a missing 2D context.
HTMLCanvasElement.prototype.getContext = () => null;

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
