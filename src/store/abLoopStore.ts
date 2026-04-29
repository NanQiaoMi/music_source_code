import { create } from "zustand";

interface ABLoopState {
  isEnabled: boolean;
  pointA: number | null;
  pointB: number | null;
  isSettingPointA: boolean;
  isSettingPointB: boolean;

  enableLoop: () => void;
  disableLoop: () => void;
  toggleLoop: () => void;
  setPointA: (time: number) => void;
  setPointB: (time: number) => void;
  clearPointA: () => void;
  clearPointB: () => void;
  clearBothPoints: () => void;
  startSettingPointA: () => void;
  startSettingPointB: () => void;
  stopSettingPoint: () => void;
}

export const useABLoopStore = create<ABLoopState>((set, get) => ({
  isEnabled: false,
  pointA: null,
  pointB: null,
  isSettingPointA: false,
  isSettingPointB: false,

  enableLoop: () => {
    const { pointA, pointB } = get();
    if (pointA !== null && pointB !== null && pointA < pointB) {
      set({ isEnabled: true });
    }
  },

  disableLoop: () => set({ isEnabled: false }),

  toggleLoop: () => {
    const { isEnabled, pointA, pointB } = get();
    if (isEnabled) {
      set({ isEnabled: false });
    } else {
      if (pointA !== null && pointB !== null && pointA < pointB) {
        set({ isEnabled: true });
      }
    }
  },

  setPointA: (time: number) =>
    set((state) => ({
      pointA: time,
      isSettingPointA: false,
      isEnabled: state.pointB !== null && time < state.pointB ? state.isEnabled : false,
    })),

  setPointB: (time: number) =>
    set((state) => ({
      pointB: time,
      isSettingPointB: false,
      isEnabled: state.pointA !== null && state.pointA < time ? state.isEnabled : false,
    })),

  clearPointA: () =>
    set((state) => ({
      pointA: null,
      isEnabled: false,
    })),

  clearPointB: () =>
    set((state) => ({
      pointB: null,
      isEnabled: false,
    })),

  clearBothPoints: () =>
    set({
      pointA: null,
      pointB: null,
      isEnabled: false,
    }),

  startSettingPointA: () =>
    set({
      isSettingPointA: true,
      isSettingPointB: false,
    }),

  startSettingPointB: () =>
    set({
      isSettingPointB: true,
      isSettingPointA: false,
    }),

  stopSettingPoint: () =>
    set({
      isSettingPointA: false,
      isSettingPointB: false,
    }),
}));
