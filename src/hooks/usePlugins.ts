import { useState, useCallback } from "react";

export const usePlugins = () => {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPlugins = useCallback(async () => {
    if (window.electronAPI) {
      setLoading(true);
      try {
        const list = await window.electronAPI.listPlugins();
        setPlugins(list);
      } catch (error) {
        console.error("Failed to list plugins:", error);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const search = useCallback(async (query: string, page = 1, type = "music") => {
    if (window.electronAPI) {
      setLoading(true);
      try {
        return await window.electronAPI.searchPlugins(query, page, type);
      } catch (error) {
        console.error("Search failed:", error);
        return [];
      } finally {
        setLoading(false);
      }
    }
    return [];
  }, []);

  const getMediaSource = useCallback(async (musicItem: any, quality = "standard") => {
    if (window.electronAPI) {
      try {
        return await window.electronAPI.getMediaSource(musicItem, quality);
      } catch (error) {
        console.error("Failed to get media source:", error);
        return null;
      }
    }
    return null;
  }, []);

  const getLyric = useCallback(async (musicItem: any) => {
    if (window.electronAPI) {
      try {
        return await window.electronAPI.getLyric(musicItem);
      } catch (error) {
        console.error("Failed to get lyric:", error);
        return null;
      }
    }
    return null;
  }, []);

  return {
    plugins,
    loading,
    loadPlugins,
    search,
    getMediaSource,
    getLyric,
  };
};
