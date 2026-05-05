import { AudioEngine } from "./AudioEngine";
import { useAudioStore } from "@/store/audioStore";
import { useEmotionStore } from "@/store/emotionStore";

/**
 * CrossfadeMixer handles smooth transitions between songs.
 * It dynamically calculates duration based on emotional distance.
 */
export class CrossfadeMixer {
  private static instance: CrossfadeMixer;
  private context: AudioContext | null = null;
  private gainNodes: Map<HTMLAudioElement, GainNode> = new Map();
  private currentAnimationId: number | null = null;

  private constructor() {
    this.context = AudioEngine.getInstance().getContext();
  }

  public static getInstance(): CrossfadeMixer {
    if (!CrossfadeMixer.instance) {
      CrossfadeMixer.instance = new CrossfadeMixer();
    }
    return CrossfadeMixer.instance;
  }

  /**
   * Prepares a gain node for an audio element and connects it to the main graph.
   */
  public prepareElement(audio: HTMLAudioElement): GainNode | null {
    if (!this.context) return null;
    
    let gainNode = this.gainNodes.get(audio);
    if (!gainNode) {
      gainNode = this.context.createGain();
      gainNode.gain.value = 1;
      
      const source = AudioEngine.getInstance().createMediaSource(audio);
      if (source) {
        try { source.disconnect(); } catch (e) {}
        source.connect(gainNode);
        const entry = AudioEngine.getInstance().getEQChainEntry();
        if (entry) {
          gainNode.connect(entry);
        }
      }
      this.gainNodes.set(audio, gainNode);
    }
    return gainNode;
  }

  /**
   * Calculates the dynamic crossfade duration.
   */
  public calculateDynamicDuration(songId1: string, songId2: string): number {
    const emotionStore = useEmotionStore.getState();
    const distance = emotionStore.calculateDistance(songId1, songId2);
    const minDuration = 1.5; // Reduced for better responsiveness
    const maxDuration = 5;
    const rawDuration = minDuration + (distance / 2.82) * (maxDuration - minDuration);
    return isFinite(rawDuration) ? Math.min(maxDuration, Math.max(minDuration, rawDuration)) : minDuration;
  }

  /**
   * Performs a crossfade. New calls will override previous ones.
   */
  public async crossfade(
    fromAudio: HTMLAudioElement,
    toAudio: HTMLAudioElement,
    duration: number
  ): Promise<void> {
    const fromGain = this.prepareElement(fromAudio);
    const toGain = this.prepareElement(toAudio);

    if (!fromGain || !toGain || !this.context) return;

    const now = this.context.currentTime;
    
    // Cancel any ongoing ramps on BOTH nodes to prevent overlaps
    fromGain.gain.cancelScheduledValues(now);
    toGain.gain.cancelScheduledValues(now);

    // Initial states
    fromGain.gain.setValueAtTime(fromGain.gain.value, now);
    toGain.gain.setValueAtTime(0, now);
    toAudio.volume = 1;

    try {
      await toAudio.play();
    } catch (e: any) {
      const isAbort = e.name === "AbortError" || e.code === 20 || e.message?.includes("interrupted");
      if (!isAbort) {
        console.error("Crossfade play failed:", e);
      }
      toGain.gain.setValueAtTime(1, now); // Fallback to instant play
      return;
    }

    // Perform smooth linear ramps
    fromGain.gain.linearRampToValueAtTime(0.001, now + duration);
    toGain.gain.linearRampToValueAtTime(1, now + duration);

    // We don't block the UI with a long await anymore. 
    // We use a timer just for the 'from' cleanup.
    setTimeout(() => {
      try {
        if (fromAudio.paused === false) {
           fromAudio.pause();
           fromAudio.currentTime = 0;
           fromGain.gain.setValueAtTime(1, this.context!.currentTime);
        }
      } catch (e) {}
    }, duration * 1000 + 100);
  }
}
