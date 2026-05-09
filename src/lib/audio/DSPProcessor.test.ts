import { describe, it, expect, vi, beforeEach } from "vitest";
import { DSPProcessor, DSPProcessorConfig, DSPChain } from "./DSPProcessor";

// Simple AudioContext Mock
const createAudioParam = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});

const createAudioNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const mockAudioContext = {
  createGain: vi.fn(() => ({
    ...createAudioNode(),
    gain: createAudioParam(),
  })),
  createBiquadFilter: vi.fn(() => ({
    ...createAudioNode(),
    type: "lowpass",
    frequency: createAudioParam(),
    gain: createAudioParam(),
    Q: createAudioParam(),
  })),
  createDynamicsCompressor: vi.fn(() => ({
    ...createAudioNode(),
    threshold: createAudioParam(),
    knee: createAudioParam(),
    ratio: createAudioParam(),
    attack: createAudioParam(),
    release: createAudioParam(),
  })),
  createDelay: vi.fn(() => ({
    ...createAudioNode(),
    delayTime: createAudioParam(),
  })),
  createConvolver: vi.fn(() => ({
    ...createAudioNode(),
  })),
  createOscillator: vi.fn(() => ({
    ...createAudioNode(),
    frequency: createAudioParam(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createWaveShaper: vi.fn(() => ({
    ...createAudioNode(),
    curve: null,
    oversample: "none",
  })),
} as unknown as AudioContext;

describe("DSPProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize an EQ processor correctly", () => {
    const config: DSPProcessorConfig = {
      type: "eq",
      enabled: true,
      params: {
        bands: [
          { frequency: 100, gain: 5, Q: 1, type: "peaking" },
          { frequency: 1000, gain: -3, Q: 1, type: "peaking" },
        ],
      },
    };

    const processor = new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(2);
    expect(processor.getInputNode()).toBeDefined();
    expect(processor.getOutputNode()).toBeDefined();
  });

  it("should initialize a compressor correctly", () => {
    const config: DSPProcessorConfig = {
      type: "compressor",
      enabled: true,
      params: { threshold: -20, ratio: 4 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createDynamicsCompressor).toHaveBeenCalled();
  });

  it("should initialize a limiter correctly", () => {
    const config: DSPProcessorConfig = {
      type: "limiter",
      enabled: true,
      params: {},
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createDynamicsCompressor).toHaveBeenCalled();
  });

  it("should initialize a reverb correctly", () => {
    const config: DSPProcessorConfig = {
      type: "reverb",
      enabled: true,
      params: { mix: 0.5 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createConvolver).toHaveBeenCalled();
  });

  it("should initialize a delay correctly", () => {
    const config: DSPProcessorConfig = {
      type: "delay",
      enabled: true,
      params: { time: 0.5, feedback: 0.3, mix: 0.5 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createDelay).toHaveBeenCalled();
  });

  it("should initialize a chorus correctly", () => {
    const config: DSPProcessorConfig = {
      type: "chorus",
      enabled: true,
      params: { rate: 1.5, depth: 0.002, mix: 0.5 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("should initialize a phaser correctly", () => {
    const config: DSPProcessorConfig = {
      type: "phaser",
      enabled: true,
      params: { rate: 0.5, depth: 1000, stages: 4, mix: 0.5 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(4);
  });

  it("should initialize distortion correctly", () => {
    const config: DSPProcessorConfig = {
      type: "distortion",
      enabled: true,
      params: { amount: 50 },
    };
    new DSPProcessor(mockAudioContext, config);
    expect(mockAudioContext.createWaveShaper).toHaveBeenCalled();
  });

  it("should update parameters correctly", () => {
    const config: DSPProcessorConfig = {
      type: "delay",
      enabled: true,
      params: { time: 0.5, feedback: 0.3, mix: 0.5 },
    };

    const processor = new DSPProcessor(mockAudioContext, config);
    processor.updateParam("time", 0.8);
    processor.updateParam("feedback", 0.5);
    processor.updateParam("mix", 0.2);

    const eqConfig: DSPProcessorConfig = {
      type: "eq",
      enabled: true,
      params: {
        bands: [{ frequency: 100, gain: 5, Q: 1, type: "peaking" }],
      },
    };
    const eqProcessor = new DSPProcessor(mockAudioContext, eqConfig);
    eqProcessor.updateParam("band_0_gain", 10);
    eqProcessor.updateParam("band_0_frequency", 200);
    eqProcessor.updateParam("band_0_Q", 2);
  });

  it("should enable and disable correctly", () => {
    const config: DSPProcessorConfig = {
      type: "limiter",
      enabled: true,
      params: {},
    };

    const processor = new DSPProcessor(mockAudioContext, config);
    processor.setEnabled(false);
    expect(processor.getInputNode().gain.value).toBe(0);
    processor.setEnabled(true);
    expect(processor.getInputNode().gain.value).toBe(1);
  });

  it("should disconnect correctly", () => {
    const config: DSPProcessorConfig = { type: "eq", enabled: true, params: { bands: [] } };
    const processor = new DSPProcessor(mockAudioContext, config);
    processor.disconnect();
  });
});

describe("DSPChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add and remove processors correctly", () => {
    const chain = new DSPChain(mockAudioContext);
    const config: DSPProcessorConfig = { type: "eq", enabled: true, params: { bands: [] } };

    chain.addProcessor("eq1", config);
    expect(chain.getProcessor("eq1")).toBeDefined();

    chain.removeProcessor("eq1");
    expect(chain.getProcessor("eq1")).toBeUndefined();
  });

  it("should disconnect all processors", () => {
    const chain = new DSPChain(mockAudioContext);
    chain.addProcessor("eq1", { type: "eq", enabled: true, params: { bands: [] } });
    chain.disconnect();
    expect(chain.getProcessor("eq1")).toBeUndefined();
  });
});
