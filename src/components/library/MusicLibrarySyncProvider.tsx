"use client";

import { useEffect } from "react";
import { useMusicLibrarySync } from "@/hooks/useMusicLibrarySync";
import { usePlaylistStore } from "@/store/playlistStore";

export const MusicLibrarySyncProvider: React.FC = () => {
  const { songs } = usePlaylistStore();
  const { syncAllData, hasInvalidData } = useMusicLibrarySync();
  const hasSongs = songs.length > 0;

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
