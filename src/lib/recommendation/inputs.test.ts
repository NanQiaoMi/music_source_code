import { describe, expect, it } from "vitest";
import { Song } from "@/types/song";
import { collectRecommendationInputs } from "./inputs";

const songs: Song[] = [
  {
    id: "s1",
    title: "Song One",
    artist: "Artist",
    duration: 180,
    source: "local",
  },
];

describe("collectRecommendationInputs", () => {
  it("collects songs and emotion coordinates from supplied deps", () => {
    expect(
      collectRecommendationInputs({
        getPlaylists: () => ({ songs }),
        getEmotionTags: () => ({ realtimeCoordinates: { x: 0.2, y: -0.4 } }),
      })
    ).toEqual({
      songs,
      emotion: { x: 0.2, y: -0.4 },
    });
  });

  it("falls back to empty songs and neutral emotion", () => {
    expect(
      collectRecommendationInputs({
        getPlaylists: () => ({}),
        getEmotionTags: () => ({ realtimeCoordinates: null }),
      })
    ).toEqual({
      songs: [],
      emotion: { x: 0, y: 0 },
    });
  });
});
