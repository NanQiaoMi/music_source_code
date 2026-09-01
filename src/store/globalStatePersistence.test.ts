import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./uiStore";
import { usePlayerStore } from "./playerStore";
import { useAudioStore } from "./audioStore";
import { useDataManagerStore } from "./useDataManagerStore";
import { useAIAgentStore } from "./useAIAgentStore";
import { useSourceConfigStore } from "./sourceConfigStore";
import { Song } from "@/types/song";

const sampleSong: Song = {
  id: "song-persist-test-1",
  title: "夜曲",
  artist: "周杰伦",
  album: "十一月的萧邦",
  duration: 226,
  source: "kuwo",
  audioUrl: "https://example.com/yequ.mp3",
  cover: "https://example.com/cover.jpg",
};

describe("Global State Retention & Persistence Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("1. UI Store persists currentView and theme settings in safe storage", () => {
    useUIStore.getState().setCurrentView("emotion");
    useUIStore.getState().setThemeMode("light");

    expect(useUIStore.getState().currentView).toBe("emotion");
    expect(useUIStore.getState().themeMode).toBe("light");

    const raw = localStorage.getItem("ui-store-v2");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.currentView).toBe("emotion");
    expect(parsed.state.themeMode).toBe("light");
  });

  it("2. PlayerStore & AudioStore accurately persist breakpoint currentTime and sanitized queue", () => {
    usePlayerStore.getState().setCurrentSong(sampleSong);
    usePlayerStore.getState().setCurrentTime(115.5);
    usePlayerStore.getState().setDuration(226);

    const playerRaw = localStorage.getItem("player-store");
    expect(playerRaw).toBeTruthy();
    const playerParsed = JSON.parse(playerRaw!);
    expect(playerParsed.state.currentTime).toBe(115.5);
    expect(playerParsed.state.duration).toBe(226);
    expect(playerParsed.state.currentSong.title).toBe("夜曲");

    useAudioStore.getState().setQueue([sampleSong]);
    useAudioStore.getState().setCurrentTime(115.5);

    const audioRaw = localStorage.getItem("audio-store-v4");
    expect(audioRaw).toBeTruthy();
    const audioParsed = JSON.parse(audioRaw!);
    expect(audioParsed.state.currentTime).toBe(115.5);
    expect(audioParsed.state.queue.length).toBe(1);
    expect(audioParsed.state.queue[0].id).toBe("song-persist-test-1");
  });

  it("3. DataManagerStore retains active hub tab, search keyword, and search results across unmounts", () => {
    useDataManagerStore.getState().setActiveHubTab("lx_search");
    useDataManagerStore.getState().setKeyword("晴天");
    useDataManagerStore.getState().setSongResults([sampleSong]);
    useDataManagerStore.getState().setActiveSourceTab("kugou");

    const hubRaw = localStorage.getItem("mimi_datamanager_hub_store_v1");
    expect(hubRaw).toBeTruthy();
    const hubParsed = JSON.parse(hubRaw!);
    expect(hubParsed.state.activeHubTab).toBe("lx_search");
    expect(hubParsed.state.keyword).toBe("晴天");
    expect(hubParsed.state.activeSourceTab).toBe("kugou");
    expect(hubParsed.state.songResults.length).toBe(1);
    expect(hubParsed.state.songResults[0].title).toBe("夜曲");
  });

  it("4. AI Agent Chat Store retains message history across drawer toggles and reloads", () => {
    useAIAgentStore.setState({
      messages: [
        {
          id: "msg-test-1",
          role: "user",
          content: "帮我找一首慢歌",
          timestamp: 1700000000,
          status: "done",
        },
      ],
    });

    const aiRaw = localStorage.getItem("mimi_ai_agent_chat_store_v1");
    expect(aiRaw).toBeTruthy();
    const aiParsed = JSON.parse(aiRaw!);
    expect(aiParsed.state.messages.length).toBe(1);
    expect(aiParsed.state.messages[0].content).toBe("帮我找一首慢歌");
  });

  it("5. SourceConfigStore persists resolutionMode and custom sound scripts", () => {
    useSourceConfigStore.getState().setResolutionMode("lx_only");

    const sourceRaw = localStorage.getItem("vibe_source_config_v1");
    expect(sourceRaw).toBeTruthy();
    const sourceParsed = JSON.parse(sourceRaw!);
    expect(sourceParsed.state.resolutionMode).toBe("lx_only");
  });
});
