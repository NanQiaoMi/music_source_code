import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Song } from "@/types/song";

const recommendedSong: Song = {
  id: "song-1",
  title: "Midnight City",
  artist: "M83",
  album: "Hurry Up",
  genre: "Synthpop",
  duration: 245,
  url: "blob:midnight-city",
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: "div",
  },
}));

vi.mock("@/hooks/useDailyRecommendation", () => ({
  useDailyRecommendation: () => ({
    recommendation: [recommendedSong],
    isLoading: false,
    refreshRecommendation: vi.fn(),
    hasRecommendation: true,
    recommendationGroups: [],
    recommendationMode: {
      id: "morning",
      title: "Morning focus",
      description: "Fresh picks for this part of the day.",
    },
  }),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: (selector: (state: unknown) => unknown) =>
    selector({
      playQueue: vi.fn(),
    }),
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: (selector: (state: unknown) => unknown) =>
    selector({
      addToQueue: vi.fn(),
      insertNext: vi.fn(),
      history: [],
    }),
}));

vi.mock("@/store/statsAchievementsStore", () => ({
  useStatsAchievementsStore: (selector: (state: unknown) => unknown) =>
    selector({
      listeningStats: {
        topArtists: [{ artist: "M83", playCount: 9 }],
        genreDistribution: [{ genre: "Synthpop", count: 5 }],
        topSongs: [{ song: recommendedSong, playCount: 4 }],
      },
    }),
}));

vi.mock("@/store/recommendationStore", () => ({
  useRecommendationStore: (selector: (state: unknown) => unknown) =>
    selector({
      addNegativeFeedback: vi.fn(),
    }),
}));

describe("DailyRecommendation", () => {
  it("renders a keyboard-reachable why-this explanation for each recommendation", async () => {
    const { DailyRecommendation } = await import("./DailyRecommendation");

    const html = renderToStaticMarkup(
      <DailyRecommendation isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("Daily Recommendations");
    expect(html).toContain("Why this");
    expect(html).toContain('aria-keyshortcuts="?"');
    expect(html).toContain("Common artist");
    expect(html).toContain("+24");
  });

  it("keeps the why-this region collapsed until the row is focused, hovered, or pinned", async () => {
    const { DailyRecommendation } = await import("./DailyRecommendation");

    const html = renderToStaticMarkup(
      <DailyRecommendation isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain('aria-controls="recommendation-reasons-song-1"');
    expect(html).toContain('id="recommendation-reasons-song-1"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("max-h-0");
    expect(html).toContain("group-hover:max-h-64");
  });
});
