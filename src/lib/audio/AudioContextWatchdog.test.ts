/* eslint-disable @typescript-eslint/no-explicit-any */
// 测试桩（React/Store mock、部分状态对象）用宽松类型是刻意的，收紧只会引入与被测逻辑无关的噪音
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioContextWatchdog } from "./AudioContextWatchdog";
import { AudioEngine } from "./AudioEngine";
import { useAudioStore } from "@/store/audioStore";

describe("AudioContextWatchdog", () => {
  let mockAudioContext: any;
  let engineContextSpy: any;

  function stateChangeHandler(): () => void {
    const call = mockAudioContext.addEventListener.mock.calls.find(
      (entry: any[]) => entry[0] === "statechange"
    );
    return call?.[1];
  }

  beforeEach(() => {
    vi.useFakeTimers();

    mockAudioContext = {
      state: "suspended",
      resume: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    engineContextSpy = vi
      .spyOn(AudioEngine.getInstance(), "getAudioContext")
      .mockReturnValue(mockAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    AudioContextWatchdog.getInstance().stop();
    delete (navigator as any).mediaDevices;
  });

  it("automatically resumes AudioContext when state becomes suspended while playing", () => {
    useAudioStore.setState({ isPlaying: true });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.attachAudioContextWatchdog();

    expect(mockAudioContext.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function)
    );

    mockAudioContext.state = "suspended";
    stateChangeHandler()();

    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume AudioContext if not playing", () => {
    useAudioStore.setState({ isPlaying: false });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.attachAudioContextWatchdog();

    mockAudioContext.state = "suspended";
    stateChangeHandler()();

    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });

  it("start before context creation attaches once context is created", () => {
    useAudioStore.setState({ isPlaying: true });
    const engine = AudioEngine.getInstance();
    engineContextSpy.mockReturnValue(null);

    let createdListener: ((ctx: any) => void) | null = null;
    const detachSpy = vi.fn();
    vi.spyOn(engine, "onContextCreated").mockImplementation((listener: any) => {
      createdListener = listener;
      return detachSpy;
    });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.start();

    expect(createdListener).not.toBeNull();
    expect(mockAudioContext.addEventListener).not.toHaveBeenCalled();

    createdListener!(mockAudioContext);

    expect(mockAudioContext.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function)
    );

    mockAudioContext.state = "suspended";
    stateChangeHandler()();
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
  });

  it("start twice registers only one statechange listener", () => {
    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.start();
    watchdog.start();

    const stateChangeCalls = mockAudioContext.addEventListener.mock.calls.filter(
      (entry: any[]) => entry[0] === "statechange"
    );
    expect(stateChangeCalls).toHaveLength(1);
  });

  it("stop removes statechange and devicechange listeners", () => {
    const addDeviceChange = vi.fn();
    const removeDeviceChange = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        addEventListener: addDeviceChange,
        removeEventListener: removeDeviceChange,
      },
    });

    const watchdog = AudioContextWatchdog.getInstance();
    watchdog.start();

    expect(addDeviceChange).toHaveBeenCalledWith("devicechange", expect.any(Function));

    watchdog.stop();

    expect(mockAudioContext.removeEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function)
    );
    expect(removeDeviceChange).toHaveBeenCalledWith("devicechange", expect.any(Function));
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
