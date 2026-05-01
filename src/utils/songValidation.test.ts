import { describe, it, expect } from 'vitest';
import { validateSong, validateSongsBatch, formatDuration, parseDuration, generateSongId } from './songValidation';

describe('songValidation', () => {
  describe('validateSong', () => {
    it('should validate a correct song object', () => {
      const song = {
        id: 'test-1',
        title: 'Test Song',
        artist: 'Test Artist',
        cover: 'https://example.com/cover.jpg',
        duration: 180
      };
      const result = validateSong(song);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const result = validateSong({});
      expect(result.isValid).toBe(false);
      const fields = result.errors.map(e => e.field);
      expect(fields).toContain('id');
      expect(fields).toContain('title');
      expect(fields).toContain('artist');
      expect(fields).toContain('cover');
    });

    it('should catch invalid IDs', () => {
      const result = validateSong({ id: 'invalid id!' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('id');
    });

    it('should catch invalid URLs', () => {
      const result = validateSong({ 
        id: 'id', title: 't', artist: 'a', 
        cover: 'not-a-url' 
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('cover');
    });

    it('should catch invalid durations', () => {
      const result = validateSong({ 
        id: 'id', title: 't', artist: 'a', cover: 'https://c.com',
        duration: -10
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('duration');
    });

    it('should catch too long durations', () => {
      const result = validateSong({ 
        id: 'id', title: 't', artist: 'a', cover: 'https://c.com',
        duration: 40000
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('duration');
    });
  });

  describe('validateSongsBatch', () => {
    it('should validate multiple songs', () => {
      const songs = [
        { id: '1', title: 'S1', artist: 'A1', cover: 'https://c1.com' },
        { id: '', title: 'S2', artist: 'A2', cover: 'https://c2.com' }
      ];
      const results = validateSongsBatch(songs);
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors[0].message).toContain('第2首歌曲');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(-10)).toBe('0:00');
    });
  });

  describe('parseDuration', () => {
    it('should parse M:SS correctly', () => {
      expect(parseDuration('1:05')).toBe(65);
    });
    it('should parse H:MM:SS correctly', () => {
      expect(parseDuration('1:00:05')).toBe(3605);
    });
    it('should return 0 for invalid format', () => {
      expect(parseDuration('invalid')).toBe(0);
    });
  });

  describe('generateSongId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSongId();
      const id2 = generateSongId();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('song-')).toBe(true);
    });
  });
});
