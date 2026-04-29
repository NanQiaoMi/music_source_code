import { create } from "zustand";
import { useAudioStore } from "./audioStore";

type SleepTimerOption = 15 | 30 | 45 | 60 | 90 | null;

interface SleepTimerState {
  minutes: SleepTimerOption;
  remainingSeconds: number;
  isActive: boolean;
  endTime: number | null;
  intervalId: NodeJS.Timeout | null;

  setTimer: (minutes: SleepTimerOption) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  cancelTimer: () => void;
  tick: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>((set, get) => ({
  minutes: null,
  remainingSeconds: 0,
  isActive: false,
  endTime: null,
  intervalId: null,

  setTimer: (minutes) => {
    const { cancelTimer } = get();
    cancelTimer();

    if (minutes) {
      set({
        minutes,
        remainingSeconds: minutes * 60,
        isActive: false,
        endTime: null,
      });
    } else {
      set({
        minutes: null,
        remainingSeconds: 0,
        isActive: false,
        endTime: null,
      });
    }
  },

  startTimer: () => {
    const { minutes, intervalId } = get();

    if (!minutes) return;

    if (intervalId) {
      clearInterval(intervalId);
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    const newIntervalId = setInterval(() => {
      const { tick } = get();
      tick();
    }, 1000);

    set({
      isActive: true,
      endTime,
      intervalId: newIntervalId,
    });
  },

  pauseTimer: () => {
    const { intervalId } = get();

    if (intervalId) {
      clearInterval(intervalId);
    }

    set({
      isActive: false,
      intervalId: null,
      endTime: null,
    });
  },

  resumeTimer: () => {
    const { remainingSeconds, startTimer } = get();

    if (remainingSeconds > 0) {
      const endTime = Date.now() + remainingSeconds * 1000;

      const newIntervalId = setInterval(() => {
        const { tick } = get();
        tick();
      }, 1000);

      set({
        isActive: true,
        endTime,
        intervalId: newIntervalId,
      });
    }
  },

  cancelTimer: () => {
    const { intervalId } = get();

    if (intervalId) {
      clearInterval(intervalId);
    }

    set({
      minutes: null,
      remainingSeconds: 0,
      isActive: false,
      endTime: null,
      intervalId: null,
    });
  },

  tick: () => {
    const { remainingSeconds, endTime, cancelTimer } = get();
    const { setIsPlaying } = useAudioStore.getState();

    if (endTime && Date.now() >= endTime) {
      setIsPlaying(false);
      cancelTimer();
      return;
    }

    const newRemaining = Math.max(0, remainingSeconds - 1);
    set({ remainingSeconds: newRemaining });

    if (newRemaining === 0) {
      setIsPlaying(false);
      cancelTimer();
    }
  },
}));

export function formatSleepTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
