export interface CUERem {
  title?: string;
  performer?: string;
  file?: string;
  tracks: CUETrack[];
}

export interface CUETrack {
  number: number;
  type: string;
  title?: string;
  performer?: string;
  indices: CUEIndex[];
}

export interface CUEIndex {
  number: number;
  minutes: number;
  seconds: number;
  frames: number;
}

export interface ParsedCUE {
  title?: string;
  performer?: string;
  file?: string;
  tracks: CUETrack[];
  totalDuration: number;
}

export const parseCUEIndex = (indexStr: string): CUEIndex | null => {
  const match = indexStr.match(/^(\d+)\s+(\d+):(\d+):(\d+)$/);
  if (!match) return null;

  return {
    number: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
    seconds: parseInt(match[3], 10),
    frames: parseInt(match[4], 10),
  };
};

export const parseCUEFile = (content: string): ParsedCUE | null => {
  const lines = content.split(/\r?\n/);

  let title: string | undefined;
  let performer: string | undefined;
  let file: string | undefined;
  const tracks: CUETrack[] = [];

  let currentTrack: CUETrack | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("TITLE") || trimmedLine.startsWith("PERFORMER")) {
      const match = trimmedLine.match(/^(TITLE|PERFORMER)\s+"(.*)"$/);
      if (match) {
        const [, key, value] = match;
        if (key === "TITLE") {
          if (currentTrack) {
            currentTrack.title = value;
          } else {
            title = value;
          }
        } else {
          if (currentTrack) {
            currentTrack.performer = value;
          } else {
            performer = value;
          }
        }
      }
    } else if (trimmedLine.startsWith("FILE")) {
      const match = trimmedLine.match(/^FILE\s+"(.*)"\s+(.+)$/);
      if (match) {
        file = match[1];
      }
    } else if (trimmedLine.startsWith("TRACK")) {
      const match = trimmedLine.match(/^TRACK\s+(\d+)\s+(.+)$/);
      if (match) {
        if (currentTrack) {
          tracks.push(currentTrack);
        }
        currentTrack = {
          number: parseInt(match[1], 10),
          type: match[2],
          indices: [],
        };
      }
    } else if (trimmedLine.startsWith("INDEX")) {
      const match = trimmedLine.match(/^INDEX\s+(\d+)\s+(.+)$/);
      if (match && currentTrack) {
        const index = parseCUEIndex(`0 ${match[2]}`);
        if (index) {
          currentTrack.indices.push({
            number: parseInt(match[1], 10),
            minutes: index.minutes,
            seconds: index.seconds,
            frames: index.frames,
          });
        }
      }
    }
  }

  if (currentTrack) {
    tracks.push(currentTrack);
  }

  const totalDuration = calculateTotalDuration(tracks);

  return {
    title,
    performer,
    file,
    tracks,
    totalDuration,
  };
};

export const calculateTotalDuration = (tracks: CUETrack[]): number => {
  if (tracks.length === 0) return 0;

  const lastTrack = tracks[tracks.length - 1];
  if (lastTrack.indices.length === 0) return 0;

  const lastIndex = lastTrack.indices[lastTrack.indices.length - 1];
  return indexToSeconds(lastIndex) + 180;
};

export const indexToSeconds = (index: CUEIndex): number => {
  return index.minutes * 60 + index.seconds + index.frames / 75;
};

export const secondsToTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const getTrackDuration = (track: CUETrack, nextTrack?: CUETrack): number => {
  if (track.indices.length === 0) return 0;

  const startSeconds = indexToSeconds(track.indices[0]);

  if (nextTrack && nextTrack.indices.length > 0) {
    const endSeconds = indexToSeconds(nextTrack.indices[0]);
    return endSeconds - startSeconds;
  }

  return 180;
};

export const generateTrackList = (
  parsedCUE: ParsedCUE
): Array<{
  trackNumber: number;
  title: string;
  performer: string;
  startTime: number;
  duration: number;
}> => {
  const trackList: Array<{
    trackNumber: number;
    title: string;
    performer: string;
    startTime: number;
    duration: number;
  }> = [];

  for (let i = 0; i < parsedCUE.tracks.length; i++) {
    const track = parsedCUE.tracks[i];
    const nextTrack = parsedCUE.tracks[i + 1];

    const startTime = track.indices.length > 0 ? indexToSeconds(track.indices[0]) : 0;
    const duration = getTrackDuration(track, nextTrack);

    trackList.push({
      trackNumber: track.number,
      title: track.title || `Track ${track.number}`,
      performer: track.performer || parsedCUE.performer || "Unknown Artist",
      startTime,
      duration,
    });
  }

  return trackList;
};

export const validateCUEFile = (content: string): { valid: boolean; error?: string } => {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "CUE file is empty" };
  }

  const parsed = parseCUEFile(content);

  if (!parsed) {
    return { valid: false, error: "Failed to parse CUE file" };
  }

  if (parsed.tracks.length === 0) {
    return { valid: false, error: "No tracks found in CUE file" };
  }

  for (const track of parsed.tracks) {
    if (track.indices.length === 0) {
      return { valid: false, error: `Track ${track.number} has no indices` };
    }
  }

  return { valid: true };
};

export const formatTrackInfo = (track: {
  trackNumber: number;
  title: string;
  performer: string;
  startTime: number;
  duration: number;
}): string => {
  return `[${track.trackNumber.toString().padStart(2, "0")}] ${track.title} - ${track.performer} (${secondsToTime(track.startTime)}) [${secondsToTime(track.duration)}]`;
};
