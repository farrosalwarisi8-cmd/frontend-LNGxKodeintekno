// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT_MS, startIdleTimer } from "../use-idle-timeout";

/**
 * PRD 19.1 — session timeout simulasi.
 * Timer dipercepat dengan fake timers; tidak ada penantian nyata.
 */
describe("startIdleTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("memanggil onTimeout setelah batas idle tercapai", () => {
    const onTimeout = vi.fn();
    const stop = startIdleTimer({ onTimeout, timeoutMs: 1_000 });

    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    stop();
  });

  it("aktivitas pengguna mengulang timer", () => {
    const onTimeout = vi.fn();
    const stop = startIdleTimer({ onTimeout, timeoutMs: 2_000 });

    // Lewati jendela debounce 1 detik sebelum event dihitung sebagai aktivitas.
    vi.advanceTimersByTime(1_100);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(1_500);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    stop();
  });

  it("cleanup membatalkan timer", () => {
    const onTimeout = vi.fn();
    const stop = startIdleTimer({ onTimeout, timeoutMs: 1_000 });
    stop();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
