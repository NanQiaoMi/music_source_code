import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistStore } from "@/store/playlistStore";

// Clear persisted playback state on load to prevent auto-restore
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("queue-store-v5");
    localStorage.removeItem("player-store");
  } catch { /* ignore */ }
}

/**
 * bootstrapApp - Orchestrates the startup sequence of the application.
 */
export async function bootstrapApp() {
  console.log("[Bootstrap] Starting mimimusic initialization...");

  try {
    await usePlaylistStore.getState().initializePlaylist();
    console.log("[Bootstrap] Playlist initialized.");

    useEmotionStore.getState().initializeEmotions();
    console.log("[Bootstrap] Emotion engine ready.");

    console.log("[Bootstrap] Application successfully bootstrapped.");
    return true;
  } catch (error) {
    console.error("[Bootstrap] Critical failure during startup:", error);
    return false;
  }
}
