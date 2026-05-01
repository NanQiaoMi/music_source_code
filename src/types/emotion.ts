export interface EmotionCoordinate {
  x: number; // Valence: -1 to 1
  y: number; // Arousal: -1 to 1
}

export interface EmotionPoint extends EmotionCoordinate {
  id: string; // Song ID
  title: string;
  artist: string;
  isTagged?: boolean;
}

export interface LassoSelection {
  points: { x: number; y: number }[];
  isClosed: boolean;
}

export interface CurvePoint extends EmotionCoordinate {
  id: string;
}

export interface EmotionMatrixState {
  points: EmotionPoint[];
  selectedIds: string[];
  viewMode: "matrix" | "heatmap";
  isLassoActive: boolean;
  isCurveActive: boolean;
  lassoPath: { x: number; y: number }[];
  curvePath: { x: number; y: number }[];
  globalEmotion: EmotionCoordinate;
}

