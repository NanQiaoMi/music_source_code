import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from './favoritesStore';

const mockSong = {
  id: 'song-1',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 240,
  cover: '/default-cover.svg',
  source: 'local' as const,
};

describe('favoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ favorites: [] });
  });

  it('添加歌曲到收藏', () => {
    useFavoritesStore.getState().addToFavorites(mockSong);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('不会重复添加同一首歌', () => {
    useFavoritesStore.getState().addToFavorites(mockSong);
    useFavoritesStore.getState().addToFavorites(mockSong);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('从收藏移除', () => {
    useFavoritesStore.getState().addToFavorites(mockSong);
    useFavoritesStore.getState().removeFromFavorites('song-1');
    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
  });

  it('检查是否已收藏', () => {
    useFavoritesStore.getState().addToFavorites(mockSong);
    expect(useFavoritesStore.getState().isFavorite('song-1')).toBe(true);
    expect(useFavoritesStore.getState().isFavorite('song-2')).toBe(false);
  });

  it('toggleFavorite 切换收藏状态', () => {
    useFavoritesStore.getState().toggleFavorite(mockSong);
    expect(useFavoritesStore.getState().isFavorite('song-1')).toBe(true);
    useFavoritesStore.getState().toggleFavorite(mockSong);
    expect(useFavoritesStore.getState().isFavorite('song-1')).toBe(false);
  });

  it('刷新后数据保留（通过 persist）', () => {
    useFavoritesStore.getState().addToFavorites(mockSong);
    const saved = localStorage.getItem('favorites-store');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.state.favorites).toHaveLength(1);
  });
});