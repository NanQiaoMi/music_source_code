// Owner -> live store bindings (S6-11 matrix). Mirrors the private map in src/lib/bootstrapStores.ts;
// the matrix asserts this map covers the registry exactly, so a store cannot silently drop out.
import { useAIStore } from "@/store/aiStore";
import { useAudioEffectsStore } from "@/store/audioEffectsStore";
import { useAudioProcessingStore } from "@/store/audioProcessingStore";
import { useAudioSourceStore } from "@/store/audioSourceStore";
import { useAudioStore } from "@/store/audioStore";
import { useBackupRestoreStore } from "@/store/backupRestoreStore";
import { useCrossfadeStore } from "@/store/crossfadeStore";
import { useDSDProcessingStore } from "@/store/dsdProcessingStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useEQStore } from "@/store/eqStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useFingerprintStore } from "@/store/fingerprintStore";
import { useFormatConversionStore } from "@/store/formatConversionStore";
import { useGestureSettingsStore } from "@/store/gestureSettingsStore";
import { useHiResStore } from "@/store/hiresStore";
import { useKeyboardShortcutsStore } from "@/store/keyboardShortcutsStore";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useLibraryHealthStore } from "@/store/libraryHealthStore";
import { useLibraryManagerStore } from "@/store/libraryManagerStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useListeningJournalStore } from "@/store/listeningJournalStore";
import { useLyricSettingsStore } from "@/store/lyricSettingsStore";
import { useLyricsCoverStore } from "@/store/lyricsCoverStore";
import { useLyricsSearchStore } from "@/store/lyricsSearchStore";
import { useMetadataEditorStore } from "@/store/metadataEditorStore";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { usePlayerSkinStore } from "@/store/playerSkinStore";
import { usePlayerStore } from "@/store/playerStore";
import { usePlaylistGroupStore } from "@/store/playlistGroupStore";
import { useProfessionalModeStore } from "@/store/professionalModeStore";
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useSmartPlaylistStore } from "@/store/smartPlaylistStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { useSpectrumStore } from "@/store/spectrumStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useTrackCuttingStore } from "@/store/trackCuttingStore";
import { useUIStore } from "@/store/uiStore";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useDataManagerStore } from "@/store/useDataManagerStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import { useWaveformStore } from "@/store/waveformStore";

export const STORE_BINDINGS = {
  aiStore: useAIStore,
  audioEffectsStore: useAudioEffectsStore,
  audioProcessingStore: useAudioProcessingStore,
  audioSourceStore: useAudioSourceStore,
  audioStore: useAudioStore,
  backupRestoreStore: useBackupRestoreStore,
  crossfadeStore: useCrossfadeStore,
  dsdProcessingStore: useDSDProcessingStore,
  emotionStore: useEmotionStore,
  eqStore: useEQStore,
  favoritesStore: useFavoritesStore,
  fingerprintStore: useFingerprintStore,
  formatConversionStore: useFormatConversionStore,
  gestureSettingsStore: useGestureSettingsStore,
  hiresStore: useHiResStore,
  keyboardShortcutsStore: useKeyboardShortcutsStore,
  knowledgeStore: useKnowledgeStore,
  libraryHealthStore: useLibraryHealthStore,
  libraryManagerStore: useLibraryManagerStore,
  linerNotesStore: useLinerNotesStore,
  listeningJournalStore: useListeningJournalStore,
  lyricSettingsStore: useLyricSettingsStore,
  lyricsCoverStore: useLyricsCoverStore,
  lyricsSearchStore: useLyricsSearchStore,
  metadataEditorStore: useMetadataEditorStore,
  performanceV8Store: usePerformanceV8Store,
  playerSkinStore: usePlayerSkinStore,
  playerStore: usePlayerStore,
  playlistGroupStore: usePlaylistGroupStore,
  professionalModeStore: useProfessionalModeStore,
  queueStore: useQueueStore,
  recommendationStore: useRecommendationStore,
  smartPlaylistStore: useSmartPlaylistStore,
  sourceConfigStore: useSourceConfigStore,
  spectrumStore: useSpectrumStore,
  statsAchievementsStore: useStatsAchievementsStore,
  trackCuttingStore: useTrackCuttingStore,
  uiStore: useUIStore,
  useAIAgentStore: useAIAgentStore,
  useDataManagerStore: useDataManagerStore,
  userAccountStore: useUserAccountStore,
  visualSettingsStore: useVisualSettingsStore,
  waveformStore: useWaveformStore,
} as const;
