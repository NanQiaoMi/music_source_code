"use client";

import { useEffect } from "react";
import { useMusicLibrarySync } from "@/hooks/useMusicLibrarySync";
import { usePlaylistStore } from "@/store/playlistStore";
import { selectHasSongs } from "@/store/selectors/playlistSelectors";

export const MusicLibrarySyncProvider: React.FC = () => {
  const hasSongs = usePlaylistStore(selectHasSongs);
  const { syncAllData, hasInvalidData } = useMusicLibrarySync();

  useEffect(() => {
    if (hasSongs) {
      if (hasInvalidData()) {
        console.log("🔍 发现无效数据，开始同步清理...");
        syncAllData();
      }
    }
  }, [hasSongs, hasInvalidData, syncAllData]);

  return null;
};
