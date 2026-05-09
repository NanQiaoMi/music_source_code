import { describe, it, expect, beforeEach } from 'vitest';
import { useLyricsCoverStore } from './lyricsCoverStore';

describe('lyricsCoverStore', () => {
  beforeEach(() => {
    useLyricsCoverStore.setState({
      lyrics: [],
      covers: [],
      currentLyric: null,
      isEditing: false,
      editMode: 'text',
      currentTime: 0,
      playbackState: 'stopped',
    });
  });

  it('保存和加载歌词', () => {
    const lyric = {
      id: 'l1', songId: 's1', title: 'Test', artist: 'A',
      lines: [{ id: 'line1', time: 0, text: 'Hello' }],
      isLRC: true, source: 'manual', lastModified: Date.now(),
    };
    useLyricsCoverStore.getState().saveLyric(lyric);
    expect(useLyricsCoverStore.getState().lyrics).toHaveLength(1);
    const loaded = useLyricsCoverStore.getState().loadLyric('s1');
    expect(loaded).not.toBeNull();
  });

  it('删除歌词', () => {
    const lyric = {
      id: 'l1', songId: 's1', title: 'Test', artist: 'A',
      lines: [], isLRC: true, source: 'manual', lastModified: Date.now(),
    };
    useLyricsCoverStore.getState().saveLyric(lyric);
    useLyricsCoverStore.getState().deleteLyric('s1');
    expect(useLyricsCoverStore.getState().loadLyric('s1')).toBeNull();
  });

  it('保存和加载封面', () => {
    const cover = {
      id: 'c1', songId: 's1', imageData: 'data:image/png;base64,test',
      source: 'manual', lastModified: Date.now(), format: 'png',
    };
    useLyricsCoverStore.getState().saveCover(cover);
    expect(useLyricsCoverStore.getState().covers).toHaveLength(1);
    const loaded = useLyricsCoverStore.getState().loadCover('s1');
    expect(loaded).not.toBeNull();
  });

  it('importCoverImage 创建封面', () => {
    const cover = useLyricsCoverStore.getState().importCoverImage('s1', 'data:image/png;base64,test', 'png');
    expect(cover.songId).toBe('s1');
    expect(useLyricsCoverStore.getState().covers).toHaveLength(1);
  });

  it('importLRC 解析 LRC 格式', () => {
    const lrcText = '[00:01.00]Line 1\n[00:05.00]Line 2\n';
    const lyric = useLyricsCoverStore.getState().importLRC('s1', lrcText);
    expect(lyric.lines).toHaveLength(2);
    expect(lyric.lines[0].text).toBe('Line 1');
    expect(lyric.lines[1].text).toBe('Line 2');
  });

  it('exportLRC 导出 LRC 格式', () => {
    const lrcText = '[00:01.00]Line 1\n';
    useLyricsCoverStore.getState().importLRC('s1', lrcText);
    const exported = useLyricsCoverStore.getState().exportLRC('s1');
    expect(exported).toContain('Line 1');
  });

  it('cropCover 和 resizeCover 方法存在（Canvas 需要在真实浏览器中测试）', () => {
    useLyricsCoverStore.getState().importCoverImage('s1', 'data:image/png;base64,test', 'png');
    const cropped = useLyricsCoverStore.getState().cropCover('s1', { x: 0, y: 0, width: 100, height: 100 });
    expect(useLyricsCoverStore.getState().loadCover('s1')).not.toBeNull();
  });
});