"use client";

import { useEffect } from "react";
import { useMusicLibrarySync } from "@/hooks/useMusicLibrarySync";
import { usePlaylistStore } from "@/store/playlistStore";

export const MusicLibrarySyncProvider: React.FC = () => {
  const { songs } = usePlaylistStore();
  const { syncAllData, hasInvalidData } = useMusicLibrarySync();

  useEffect(() => {
    if (songs.length > 0) {
      if (hasInvalidData()) {
        console.log("🔍 发现无效数据，开始同步清理...");
        syncAllData();
      }
    }
  }, [songs.length > 0]);

  return null;
};
