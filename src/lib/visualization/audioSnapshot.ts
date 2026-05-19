export interface VisualizationAudioSnapshot {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

function normalizeTime(value: number | undefined): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

export function createAudioSnapshot(
  input: Partial<VisualizationAudioSnapshot>
): VisualizationAudioSnapshot {
  return {
    currentTime: normalizeTime(input.currentTime),
    duration: normalizeTime(input.duration),
    isPlaying: Boolean(input.isPlaying),
  };
}
