// A failed status load must reach the screen as an error (it used to leave a blank
// screen forever, because the stored snapshot never changed on failure).
const mockStatus = jest.fn();
jest.mock('../api', () => ({ api: { status: () => mockStatus() } }));

import { clearStatus, refreshStatus, statusSnapshot, subscribeStatus } from '../status';

beforeEach(() => {
  mockStatus.mockReset();
  clearStatus();
});

it('publishes a new snapshot with the error when the status call fails', async () => {
  mockStatus.mockRejectedValue(new Error('cannot execute INSERT in a read-only transaction'));
  const before = statusSnapshot();
  const listener = jest.fn();
  const unsub = subscribeStatus(listener);
  await refreshStatus();
  unsub();
  expect(listener).toHaveBeenCalled();
  expect(statusSnapshot()).not.toBe(before); // a new object, so React re-renders
  expect(statusSnapshot().status).toBeNull();
  expect(String(statusSnapshot().error)).toContain('read-only');
});

it('clears the error once a retry succeeds', async () => {
  mockStatus.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ onboarded: true });
  await refreshStatus();
  expect(statusSnapshot().error).toBeTruthy();
  await refreshStatus();
  expect(statusSnapshot().error).toBeNull();
  expect(statusSnapshot().status).toEqual({ onboarded: true });
});

it('gives up on a request that never answers', async () => {
  jest.useFakeTimers();
  mockStatus.mockReturnValue(new Promise(() => {}));
  const p = refreshStatus();
  jest.advanceTimersByTime(15_000);
  await expect(p).resolves.toBeNull();
  expect(String(statusSnapshot().error)).toContain("Couldn't reach");
  jest.useRealTimers();
});
