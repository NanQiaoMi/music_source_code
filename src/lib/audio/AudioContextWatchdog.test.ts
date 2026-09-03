import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioContextWatchdog } from "./AudioContextWatchdog";
import { AudioEngine } from "./AudioEngine";
import { useAudioStore } from "@/store/audioStore";

describe("AudioContextWatchdog", () => {
  let mockAudioContext: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockAudioContext = {
      state: "suspended",
      resume: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.spyOn(AudioEngine.getInstance(), "getAudioContext").mockReturnValue(mockAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    AudioContextWatchdog.getInstance().stop();
  });

  it("automatically resumes AudioContext when state becomes suspended while playing", () => {
    useAudioStore.setState({ isPlaying: true });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.attachAudioContextWatchdog();

    expect(mockAudioContext.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function)
    );

    const stateChangeHandler = mockAudioContext.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === "statechange"
    )[1];

    mockAudioContext.state = "suspended";
    stateChangeHandler();

    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it("does not resume AudioContext if not playing", () => {
    useAudioStore.setState({ isPlaying: false });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.attachAudioContextWatchdog();

    const stateChangeHandler = mockAudioContext.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === "statechange"
    )[1];

    mockAudioContext.state = "suspended";
    stateChangeHandler();

    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });

  it("runs periodic health inspection on heartbeat tick", () => {
    useAudioStore.setState({ isPlaying: true });
    mockAudioContext.state = "suspended";

    const watchdog = AudioContextWatchdog.getInstance();
    const inspectSpy = vi.spyOn(watchdog, "runPeriodicHealthInspection");

    watchdog.start(1000); // 1s interval for test
    vi.advanceTimersByTime(1050);

    expect(inspectSpy).toHaveBeenCalled();
    expect(mockAudioContext.resume).toHaveBeenCalled();

    watchdog.stop();
  });
});
