import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "./playlistStore";

export interface MetadataField {
  name: string;
  label: string;
  value: string | number | null;
  editable: boolean;
}

export interface BatchEditOperation {
  id: string;
  type: "set" | "clear" | "replace" | "append";
  field: string;
  value: string;
  searchValue?: string;
  applyToSelected: boolean;
  selectedSongIds: string[];
  createdAt: number;
}

export interface RegexPreset {
  name: string;
  pattern: string;
  fields: {
    field: string;
    group: number;
  }[];
}

export interface MetadataEditorState {
  selectedSongs: Song[];
  operations: BatchEditOperation[];

  regexPresets: RegexPreset[];
  customPatterns: Map<string, string>;

  previewMode: boolean;
  previewChanges: Map<string, Partial<Song>>;

  lastOperation: number | null;

  setSelectedSongs: (songs: Song[]) => void;
  addOperation: (operation: BatchEditOperation) => void;
  removeOperation: (operationId: string) => void;
  clearOperations: () => void;

  addRegexPreset: (preset: RegexPreset) => void;
  removeRegexPreset: (presetName: string) => void;
  saveCustomPattern: (name: string, pattern: string) => void;
  getCustomPattern: (name: string) => string | undefined;

  setPreviewMode: (preview: boolean) => void;
  generatePreview: () => void;
  applyChanges: () => void;

  setLastOperation: (timestamp: number | null) => void;
}

export const useMetadataEditorStore = create<MetadataEditorState>()(
  persist(
    (set, get) => ({
      selectedSongs: [],
      operations: [],

      regexPresets: [
        {
          name: "曲目号 - 歌曲名",
          pattern: "^(\\d+)\\s*[-–—]\\s*(.+)$",
          fields: [
            { field: "trackNumber", group: 1 },
            { field: "title", group: 2 },
          ],
        },
        {
          name: "艺术家 - 歌曲名",
          pattern: "^(.+?)\\s*[-–—]\\s*(.+)$",
          fields: [
            { field: "artist", group: 1 },
            { field: "title", group: 2 },
          ],
        },
        {
          name: "艺术家 - 专辑 - 歌曲名",
          pattern: "^(.+?)\\s*[-–—]\\s*(.+?)\\s*[-–—]\\s*(.+)$",
          fields: [
            { field: "artist", group: 1 },
            { field: "album", group: 2 },
            { field: "title", group: 3 },
          ],
        },
      ],

      customPatterns: new Map(),
      previewMode: true,
      previewChanges: new Map(),
      lastOperation: null,

      setSelectedSongs: (songs: Song[]) => {
        set({ selectedSongs: songs });
      },

      addOperation: (operation: BatchEditOperation) => {
        set((state: MetadataEditorState) => ({
          operations: [...state.operations, operation],
        }));
      },

      removeOperation: (operationId: string) => {
        set((state: MetadataEditorState) => ({
          operations: state.operations.filter((op: BatchEditOperation) => op.id !== operationId),
        }));
      },

      clearOperations: () => {
        set({ operations: [] });
      },

      addRegexPreset: (preset: RegexPreset) => {
        set((state: MetadataEditorState) => ({
          regexPresets: [...state.regexPresets, preset],
        }));
      },

      removeRegexPreset: (presetName: string) => {
        set((state: MetadataEditorState) => ({
          regexPresets: state.regexPresets.filter((p: RegexPreset) => p.name !== presetName),
        }));
      },

      saveCustomPattern: (name: string, pattern: string) => {
        set((state: MetadataEditorState) => {
          const newMap = new Map(state.customPatterns);
          newMap.set(name, pattern);
          return { customPatterns: newMap };
        });
      },

      getCustomPattern: (name: string) => {
        return get().customPatterns.get(name);
      },

      setPreviewMode: (preview: boolean) => {
        set({ previewMode: preview });
      },

      generatePreview: () => {
        const state = get();
        const changes = new Map<string, Partial<Song>>();

        state.selectedSongs.forEach((song: Song) => {
          const songChanges: Partial<Song> = {};

          state.operations.forEach((op: BatchEditOperation) => {
            if (op.applyToSelected || op.selectedSongIds.includes(song.id)) {
              switch (op.type) {
                case "set":
                  (songChanges as any)[op.field] = op.value;
                  break;
                case "clear":
                  (songChanges as any)[op.field] = null;
                  break;
                case "replace":
                  if (op.searchValue && (song as any)[op.field]) {
                    (songChanges as any)[op.field] = (song as any)[op.field].replace(
                      new RegExp(op.searchValue, "g"),
                      op.value
                    );
                  }
                  break;
                case "append":
                  if ((song as any)[op.field]) {
                    (songChanges as any)[op.field] = (song as any)[op.field] + op.value;
                  } else {
                    (songChanges as any)[op.field] = op.value;
                  }
                  break;
              }
            }
          });

          if (Object.keys(songChanges).length > 0) {
            changes.set(song.id, songChanges);
          }
        });

        set({ previewChanges: changes });
      },

      applyChanges: () => {
        const state = get();

        state.selectedSongs.forEach((song: Song) => {
          const changes = state.previewChanges.get(song.id);
          if (changes) {
            Object.assign(song, changes);
          }
        });

        set({
          operations: [],
          previewChanges: new Map(),
          lastOperation: Date.now(),
        });
      },

      setLastOperation: (timestamp: number | null) => {
        set({ lastOperation: timestamp });
      },
    }),
    {
      name: "metadata-editor-store-v5",
      partialize: (state) => ({
        regexPresets: state.regexPresets,
        customPatterns: Object.fromEntries(state.customPatterns),
        previewMode: state.previewMode,
      }),
      merge: (persistedState: any) => ({
        ...persistedState,
        customPatterns: new Map(Object.entries(persistedState.customPatterns || {})),
      }),
    }
  )
);

export function extractMetadataFromFilename(
  filename: string,
  pattern: string,
  fields: { field: string; group: number }[]
): { [key: string]: string } {
  const regex = new RegExp(pattern);
  const match = filename.match(regex);

  if (!match) {
    return {};
  }

  const result: { [key: string]: string } = {};

  fields.forEach(({ field, group }) => {
    if (match[group]) {
      result[field] = match[group].trim();
    }
  });

  return result;
}
