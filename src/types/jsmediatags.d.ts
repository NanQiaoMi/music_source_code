declare module "jsmediatags" {
  export interface MediaTagPicture {
    data: number[] | Uint8Array;
    format: string;
  }

  export interface MediaTags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string | number;
    genre?: string;
    track?: string | number;
    picture?: MediaTagPicture;
    USLT?: string | { data?: string };
    SYLT?: string | { data?: string };
    lyrics?: string;
    LYRICS?: string;
  }

  export interface MediaTagResult {
    tags?: MediaTags;
  }

  export interface MediaTagReadCallbacks {
    onSuccess?: (tag: MediaTagResult) => void;
    onError?: (error?: unknown) => void;
  }

  const jsmediatags: {
    read: (file: File | Blob, callbacks: MediaTagReadCallbacks) => void;
  };

  export default jsmediatags;
}
