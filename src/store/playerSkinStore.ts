import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getHaloSkin, type HaloSkin, type HaloSkinId } from "@/lib/skins/halo/haloSkins";

export const PLAYER_SKIN_STORE_KEY = "player-skin-store-v1";

interface PlayerSkinState {
  activeBaseSkinId: string;
  activeHaloId: HaloSkinId;
  setActiveBaseSkinId: (id: string) => void;
  setActiveHaloId: (id: HaloSkinId) => void;
  getActiveHalo: () => HaloSkin;
}

function normalizeBaseSkinId(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value : "default";
}

function normalizeHaloId(value: unknown): HaloSkinId {
  return getHaloSkin(typeof value === "string" ? value : null).id;
}

function mergePersistedState(
  persistedState: unknown,
  currentState: PlayerSkinState
): PlayerSkinState {
  if (typeof persistedState !== "object" || persistedState === null) return currentState;
  const maybeState = persistedState as Partial<PlayerSkinState>;

  return {
    ...currentState,
    activeBaseSkinId: normalizeBaseSkinId(maybeState.activeBaseSkinId),
    activeHaloId: normalizeHaloId(maybeState.activeHaloId),
  };
}

export const usePlayerSkinStore = create<PlayerSkinState>()(
  persist(
    (set, get) => ({
      activeBaseSkinId: "default",
      activeHaloId: "aurora",
      setActiveBaseSkinId: (id) => set({ activeBaseSkinId: normalizeBaseSkinId(id) }),
      setActiveHaloId: (id) => set({ activeHaloId: normalizeHaloId(id) }),
      getActiveHalo: () => getHaloSkin(get().activeHaloId),
    }),
    {
      name: PLAYER_SKIN_STORE_KEY,
      partialize: (state) => ({
        activeBaseSkinId: state.activeBaseSkinId,
        activeHaloId: state.activeHaloId,
      }),
      merge: mergePersistedState,
    }
  )
);
