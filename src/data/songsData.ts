import { Song } from "@/types/song";

export const songsData: Song[] = [
  {
    id: "1330348068",
    title: "起风了",
    artist: "买辣椒也用券",
    album: "起风了",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop",
    audioUrl: "https://music.163.com/song/media/outer/url?id=1330348068.mp3",
    duration: 325,
    source: "demo",
    addedAt: Date.now(),
    playCount: 0,
  },
  {
    id: "1363948882",
    title: "世间美好与你环环相扣",
    artist: "柏松",
    album: "听风的歌",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
    audioUrl: "https://music.163.com/song/media/outer/url?id=1363948882.mp3",
    duration: 207,
    source: "demo",
    addedAt: Date.now() - 86400000,
    playCount: 0,
  },
  {
    id: "1436709403",
    title: "海底",
    artist: "一支榴莲",
    album: "海底",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
    audioUrl: "https://music.163.com/song/media/outer/url?id=1436709403.mp3",
    duration: 258,
    source: "demo",
    addedAt: Date.now() - 172800000,
    playCount: 0,
  },
  {
    id: "3320816993",
    title: "喵喵之歌",
    artist: "漂移的人（Drifting Man）",
    album: "Montagem Miau",
    cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop",
    audioUrl: "https://music.163.com/song/media/outer/url?id=3320816993.mp3",
    duration: 180,
    source: "demo",
    addedAt: Date.now() - 259200000,
    playCount: 0,
  },
];

export function searchSongs(query: string, songs: Song[]): Song[] {
  const lowerQuery = query.toLowerCase();
  return songs.filter(
    (song) =>
      song.title.toLowerCase().includes(lowerQuery) ||
      song.artist.toLowerCase().includes(lowerQuery) ||
      (song.album && song.album.toLowerCase().includes(lowerQuery))
  );
}

export function getSongsByArtist(artist: string, songs: Song[]): Song[] {
  return songs.filter((song) => song.artist.toLowerCase().includes(artist.toLowerCase()));
}

export function getSongsByAlbum(album: string, songs: Song[]): Song[] {
  return songs.filter(
    (song) => song.album && song.album.toLowerCase().includes(album.toLowerCase())
  );
}

export function filterSongsByArtist(artist: string, songs: Song[]): Song[] {
  return songs.filter((song) => song.artist.toLowerCase() === artist.toLowerCase());
}

export function filterSongsByAlbum(album: string, songs: Song[]): Song[] {
  return songs.filter((song) => song.album && song.album.toLowerCase() === album.toLowerCase());
}
