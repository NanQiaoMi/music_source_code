import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getHaloSkin, type HaloSkin, type HaloSkinId } from "@/lib/skins/halo/haloSkins";

export const PLAYER_SKIN_STORE_KEY = "player-skin-store-v1";

interface PlayerSkinState {
  activeHaloId: HaloSkinId;
  setActiveHaloId: (id: HaloSkinId) => void;
  getActiveHalo: () => HaloSkin;
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
    activeHaloId: normalizeHaloId(maybeState.activeHaloId),
  };
}

export const usePlayerSkinStore = create<PlayerSkinState>()(
  persist(
    (set, get) => ({
      activeHaloId: "aurora",
      setActiveHaloId: (id) => set({ activeHaloId: normalizeHaloId(id) }),
      getActiveHalo: () => getHaloSkin(get().activeHaloId),
    }),
    {
      name: PLAYER_SKIN_STORE_KEY,
      partialize: (state) => ({ activeHaloId: state.activeHaloId }),
      merge: mergePersistedState,
    }
  )
);
