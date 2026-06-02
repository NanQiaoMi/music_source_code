import { Song } from "@/types/song";

export const songsData: Song[] = [
  {
    id: "demo-1",
    title: "Welcome to VIBE Player",
    artist: "MIMI Demo",
    album: "Getting Started",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
    audioUrl: "",
    duration: 180,
    source: "demo",
    addedAt: Date.now(),
    playCount: 0,
  },
  {
    id: "demo-2",
    title: "Import Your Music",
    artist: "MIMI Demo",
    album: "Getting Started",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop",
    audioUrl: "",
    duration: 210,
    source: "demo",
    addedAt: Date.now() - 86400000,
    playCount: 0,
  },
  {
    id: "demo-3",
    title: "Enjoy Your Music",
    artist: "MIMI Demo",
    album: "Getting Started",
    cover: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=600&fit=crop",
    audioUrl: "",
    duration: 195,
    source: "demo",
    addedAt: Date.now() - 172800000,
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
