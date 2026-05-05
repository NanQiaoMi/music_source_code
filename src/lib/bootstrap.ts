import { usePlaylistStore } from "@/store/playlistStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useUIStore } from "@/store/uiStore";

/**
 * bootstrapApp - Orchestrates the startup sequence of the application.
 * 
 * Ensures core services (Playlist, Audio) are initialized before 
 * secondary features (Emotions, Recommendations).
 */
export async function bootstrapApp() {
  console.log("[Bootstrap] Starting mimimusic initialization...");
  
  try {
    // 1. Core initialization (Crucial for playback)
    await usePlaylistStore.getState().initializePlaylist();
    console.log("[Bootstrap] Playlist initialized.");

    // 2. Data & Intelligence (Can be async/background)
    useEmotionStore.getState().initializeEmotions();
    console.log("[Bootstrap] Emotion engine ready.");

    // 3. UI Readiness
    // Any extra logic before showing the main UI
    
    console.log("[Bootstrap] Application successfully bootstrapped.");
    return true;
  } catch (error) {
    console.error("[Bootstrap] Critical failure during startup:", error);
    // You could trigger a global error state here if needed
    return false;
  }
}
