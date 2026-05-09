import { create } from "zustand";

type RecordingStatus = "idle" | "recording" | "processing" | "ready";

interface RecordingState {
  status: RecordingStatus;
  recordingTime: number;
  videoBlob: Blob | null;
  videoUrl: string | null;

  startRecording: () => void;
  stopRecording: () => void;
  setRecordingTime: (time: number | ((prev: number) => number)) => void;
  setVideoBlob: (blob: Blob | null) => void;
  clearRecording: () => void;
  downloadRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: "idle",
  recordingTime: 0,
  videoBlob: null,
  videoUrl: null,

  startRecording: () => set({ status: "recording", recordingTime: 0 }),

  stopRecording: () => set({ status: "processing" }),

  setRecordingTime: (time) =>
    set((state) => ({
      recordingTime: typeof time === "function" ? time(state.recordingTime) : time,
    })),

  setVideoBlob: (blob) => {
    let videoUrl = null;
    if (blob) {
      videoUrl = URL.createObjectURL(blob);
    }
    set({ videoBlob: blob, videoUrl, status: blob ? "ready" : "idle" });
  },

  clearRecording: () => {
    const { videoUrl } = get();
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    set({ status: "idle", recordingTime: 0, videoBlob: null, videoUrl: null });
  },

  downloadRecording: () => {
    const { videoBlob } = get();
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vibe-recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  },
}));
