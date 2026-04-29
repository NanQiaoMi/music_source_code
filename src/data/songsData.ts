import { Song } from "@/store/playlistStore";

export const songsData: Song[] = [];

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
