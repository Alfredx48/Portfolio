import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareResult } from './share';
import { toast } from './toast';

vi.mock('./toast', () => ({ toast: vi.fn() }));

// jsdom has neither, so each test installs what it needs
const setNavigator = (props) => {
	for (const key of ['share', 'clipboard']) Object.defineProperty(navigator, key, { value: props[key], configurable: true });
};

afterEach(() => {
	setNavigator({});
	vi.clearAllMocks();
});

describe('shareResult', () => {
	it('uses the share sheet when there is one', async () => {
		const share = vi.fn().mockResolvedValue();
		const writeText = vi.fn();
		setNavigator({ share, clipboard: { writeText } });
		await shareResult('I won');
		expect(share).toHaveBeenCalledWith({ text: 'I won' });
		expect(writeText).not.toHaveBeenCalled();
		expect(toast).not.toHaveBeenCalled();
	});

	it('falls back to copying and says so', async () => {
		const writeText = vi.fn().mockResolvedValue();
		setNavigator({ clipboard: { writeText } });
		await shareResult('I won');
		expect(writeText).toHaveBeenCalledWith('I won');
		expect(toast).toHaveBeenCalledWith('Copied to clipboard', 'info');
	});

	it('ignores a cancelled share sheet', async () => {
		setNavigator({ share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) });
		await expect(shareResult('I won')).resolves.toBeUndefined();
		expect(toast).not.toHaveBeenCalled();
	});

	it('reports other failures without throwing', async () => {
		setNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
		await expect(shareResult('I won')).resolves.toBeUndefined();
		expect(toast).toHaveBeenCalledWith("Couldn't copy that", 'error');
	});

	it('reports a missing clipboard too', async () => {
		await expect(shareResult('I won')).resolves.toBeUndefined();
		expect(toast).toHaveBeenCalledWith("Couldn't copy that", 'error');
	});
});
