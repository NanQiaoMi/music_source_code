import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDSDProcessingStore,
  getDSDRateFromFormat,
  getSampleRateFromDSDRate,
} from "./dsdProcessingStore";
import { useFingerprintStore, type AudioFingerprint } from "./fingerprintStore";
import { useFormatConversionStore } from "./formatConversionStore";
import { analyzeAudioQuality, useHiResStore } from "./hiresStore";
import { useProfessionalModeStore } from "./professionalModeStore";
import { useRecordingStore } from "./recordingStore";
import { useSpectrumStore, type SpectrumData } from "./spectrumStore";
import { useTrackCuttingStore } from "./trackCuttingStore";
import { useWaveformStore, type WaveformData, type WaveformMarker } from "./waveformStore";
import type { ParsedCUE } from "@/lib/audio/cueParser";

function resetAllStores() {
  localStorage.clear();
  useDSDProcessingStore.setState(useDSDProcessingStore.getInitialState(), true);
  useFingerprintStore.setState(useFingerprintStore.getInitialState(), true);
  useFormatConversionStore.setState(useFormatConversionStore.getInitialState(), true);
  useHiResStore.setState(useHiResStore.getInitialState(), true);
  useProfessionalModeStore.setState(useProfessionalModeStore.getInitialState(), true);
  useRecordingStore.setState(useRecordingStore.getInitialState(), true);
  useSpectrumStore.setState(useSpectrumStore.getInitialState(), true);
  useTrackCuttingStore.setState(useTrackCuttingStore.getInitialState(), true);
  useWaveformStore.setState(useWaveformStore.getInitialState(), true);
}

function createParsedCue(): ParsedCUE {
  return {
    title: "Album",
    performer: "Artist",
    file: "album.flac",
    totalDuration: 420,
    tracks: [
      {
        number: 1,
        type: "AUDIO",
        title: "Intro",
        performer: "Artist",
        indices: [{ number: 1, minutes: 0, seconds: 0, frames: 0 }],
      },
      {
        number: 2,
        type: "AUDIO",
        title: "Main",
        performer: "Guest",
        indices: [{ number: 1, minutes: 3, seconds: 15, frames: 0 }],
      },
    ],
  };
}

function createWaveform(songId = "song-1"): WaveformData {
  return {
    songId,
    totalDuration: 120,
    generatedAt: 123,
    zoomLevel: 1,
    channels: [
      {
        channelIndex: 0,
        duration: 120,
        sampleRate: 44100,
        points: [{ time: 0, min: -0.5, max: 0.5, avg: 0 }],
      },
    ],
  };
}

function createSpectrum(timestamp: number): SpectrumData {
  return {
    frequencies: new Float32Array([60, 120]),
    magnitudes: new Float32Array([-12, -24]),
    peaks: [{ value: 0.7, timestamp }],
    rms: 0.4,
    peak: 0.8,
    timestamp,
  };
}

describe("processing and professional stores", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetAllStores();
  });

  it("tracks DSD conversion task state, bounds progress, and persists settings only", () => {
    const store = useDSDProcessingStore.getState();

    store.setEnabled(true);
    store.setSettings({ outputMode: "dop", dsdQuality: "ultra" });
    store.addTask("song-1", "DSD Song", "dsd64");

    const task = useDSDProcessingStore.getState().tasks[0];
    expect(task.targetRate).toBe("dsd128");

    store.updateTaskProgress(task.id, 120);
    store.updateTaskStatus(task.id, "error", undefined, "decode failed");

    expect(useDSDProcessingStore.getState().tasks[0]).toMatchObject({
      progress: 100,
      status: "error",
      error: "decode failed",
    });
    expect(getDSDRateFromFormat("album.dsf128")).toBe("dsd128");
    expect(getSampleRateFromDSDRate("dsd256")).toBe(11289600);

    const persisted = localStorage.getItem("dsd-processing-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.settings.outputMode).toBe("dop");
    expect(parsed.state.tasks).toBeUndefined();
  });

  it("manages format conversion queues, task filters, stats, and persisted summary fields", () => {
    const store = useFormatConversionStore.getState();

    store.setSettings({ targetFormat: "flac", bitrate: 1411 });
    store.addConversionTask("song-1", "Song One", "Artist", "C:/song.wav", "wav");
    store.addConversionTasks(
      [{ id: "song-2", title: "Song Two", artist: "Artist", path: "C:/song2.mp3", format: "mp3" }],
      "aac"
    );

    const [first, second] = useFormatConversionStore.getState().tasks;
    expect(first.targetFormat).toBe("flac");
    expect(second.targetFormat).toBe("aac");

    store.updateTaskProgress(first.id, 150);
    store.updateTaskStatus(first.id, "completed", undefined, new Blob(["ok"]));
    store.updateTaskStatus(second.id, "error", "unsupported format");
    store.incrementConverted();
    store.incrementFailed();

    expect(store.getCompletedTasks()).toHaveLength(1);
    expect(store.getFailedTasks()).toHaveLength(1);
    expect(useFormatConversionStore.getState().tasks[0].progress).toBe(100);

    const persisted = localStorage.getItem("format-conversion-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.totalConverted).toBe(1);
    expect(parsed.state.tasks).toBeUndefined();
  });

  it("drives recording lifecycle and revokes object URLs on cleanup", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob://recording");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const blob = new Blob(["video"], { type: "video/webm" });

    const store = useRecordingStore.getState();
    store.startRecording();
    store.setRecordingTime((previous) => previous + 7);
    store.stopRecording();
    store.setVideoBlob(blob);

    expect(useRecordingStore.getState()).toMatchObject({
      status: "ready",
      recordingTime: 7,
      videoUrl: "blob://recording",
    });

    store.clearRecording();

    expect(revokeUrl).toHaveBeenCalledWith("blob://recording");
    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(useRecordingStore.getState().status).toBe("idle");
  });

  it("creates CUE cutting tasks, derives track durations, and returns selected tracks", () => {
    const store = useTrackCuttingStore.getState();
    const taskId = store.createTask("album.flac", "CUE content");

    store.setParsedCUE(taskId, createParsedCue());
    store.toggleTrackSelection(taskId, 2);
    store.updateTrackProgress(taskId, 1, 150);
    store.updateTrackStatus(taskId, 1, "completed", new Blob(["cut"]));
    store.updateTaskStatus(taskId, "completed");
    store.setCurrentTask(taskId);

    const task = store.getCurrentTask();
    expect(
      task?.tracks.map((track) => [track.trackNumber, track.duration, track.selected])
    ).toEqual([
      [1, 195, true],
      [2, 180, false],
    ]);
    expect(task?.tracks[0].progress).toBe(100);
    expect(store.getSelectedTracks(taskId)).toHaveLength(1);

    store.clearCompletedTasks();
    expect(useTrackCuttingStore.getState().tasks).toHaveLength(0);
  });

  it("caches waveform data, clamps timeline controls, and persists display settings", () => {
    const store = useWaveformStore.getState();
    const waveform = createWaveform();
    const marker: WaveformMarker = {
      id: "marker-1",
      songId: "song-1",
      time: 12,
      label: "Chorus",
      color: "#fff",
      createdAt: 123,
    };

    store.addWaveformToCache("song-1", waveform);
    store.setCurrentWaveform(waveform);
    store.addMarker(marker);
    store.updateMarker("marker-1", { label: "Hook" });
    store.setGenerationProgress(150);
    store.setZoomLevel(0);
    store.setScrollPosition(-20);
    store.setCurrentTime(-5);
    store.setShowRMS(true);

    expect(store.getWaveformFromCache("song-1")).toBe(waveform);
    expect(store.getMarkersForSong("song-1")[0].label).toBe("Hook");
    expect(useWaveformStore.getState()).toMatchObject({
      generationProgress: 100,
      zoomLevel: 1,
      scrollPosition: 0,
      currentTime: 0,
      showRMS: true,
    });

    const persisted = localStorage.getItem("waveform-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.markers).toHaveLength(1);
    expect(parsed.state.waveformCache).toBeUndefined();
  });

  it("detects hi-res quality and persists only UI preferences", () => {
    const store = useHiResStore.getState();

    expect(store.detectQuality(44100, 16, 2)).toBe("CD");
    expect(store.detectQuality(96000, 24, 2)).toBe("Hi-Res");
    expect(store.detectQuality(352800, 24, 2)).toBe("DXD");
    expect(store.detectQuality(2822400, 1, 2)).toBe("DSD");

    const quality = analyzeAudioQuality(96000, 24, 2, "flac");
    store.setAudioQuality(quality);
    store.setShowDetailedInfo(true);

    expect(quality).toMatchObject({ quality: "Hi-Res", isLossless: true, isHighRes: true });
    const persisted = localStorage.getItem("hires-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.showDetailedInfo).toBe(true);
    expect(parsed.state.currentQuality).toBeUndefined();
  });

  it("matches fingerprints by threshold and serializes Map-backed data", () => {
    const store = useFingerprintStore.getState();
    const fingerprint: AudioFingerprint = {
      songId: "song-1",
      fingerprint: [1, 0, 1, 1],
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      createdAt: 123,
    };

    store.setFingerprint("song-1", fingerprint);
    store.setMatchThreshold(0.75);
    store.setScanProgress(-10);

    expect(store.hasFingerprint("song-1")).toBe(true);
    expect(store.matchFingerprint([1, 0, 0, 1])).toEqual([
      { songId: "song-1", confidence: 0.75, offset: 0 },
    ]);
    expect(useFingerprintStore.getState().scanProgress).toBe(0);

    const persisted = localStorage.getItem("fingerprint-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(parsed.state.fingerprints["song-1"].duration).toBe(180);
  });

  it("bounds spectrum settings, keeps history capped, and resets meter peaks", () => {
    const store = useSpectrumStore.getState();

    store.setFFTSize(64);
    store.setSmoothingTimeConstant(5);
    store.setMinDecibels(-999);
    store.setMaxDecibels(0);
    store.setVUMeterLevel(1.5);
    store.setPPMMeterLevel(-1);
    for (let i = 0; i < 105; i++) {
      store.addSpectrumToHistory(createSpectrum(i));
    }

    expect(useSpectrumStore.getState()).toMatchObject({
      fftSize: 512,
      smoothingTimeConstant: 0.99,
      minDecibels: -150,
      maxDecibels: -10,
      vuMeterLevel: 1,
      ppmMeterLevel: 0,
    });
    expect(useSpectrumStore.getState().spectrumHistory).toHaveLength(100);

    store.resetMeters();
    expect(useSpectrumStore.getState()).toMatchObject({
      vuMeterLevel: 0,
      ppmMeterLevel: 0,
      vuMeterPeak: 0,
      ppmMeterPeak: 0,
    });
  });

  it("switches professional mode feature sets and serializes Set-backed state", () => {
    vi.useFakeTimers();
    const store = useProfessionalModeStore.getState();

    store.setProfessionalMode(false);

    expect(useProfessionalModeStore.getState().isFeatureEnabled("waveform")).toBe(false);
    expect(useProfessionalModeStore.getState().enabledFeatures.has("waveform")).toBe(true);
    expect(useProfessionalModeStore.getState().enabledFeatures.has("metadata-editor")).toBe(false);
    expect(useProfessionalModeStore.getState().showModeSwitchAnimation).toBe(true);

    vi.advanceTimersByTime(500);
    expect(useProfessionalModeStore.getState().showModeSwitchAnimation).toBe(false);

    store.setProfessionalMode(true);
    store.toggleFeature("metadata-editor");
    expect(useProfessionalModeStore.getState().isFeatureEnabled("metadata-editor")).toBe(false);

    const persisted = localStorage.getItem("professional-mode-store-v5");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!);
    expect(Array.isArray(parsed.state.enabledFeatures)).toBe(true);
  });
});
