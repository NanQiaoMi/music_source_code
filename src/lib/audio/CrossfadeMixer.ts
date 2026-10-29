import { AudioEngine } from "./AudioEngine";
import { getEmotionSnapshot } from "@/store/actions/emotionActions";

/**
 * CrossfadeMixer handles smooth transitions between songs.
 * It dynamically calculates duration based on emotional distance.
 */
export class CrossfadeMixer {
  private static instance: CrossfadeMixer;
  private context: AudioContext | null = null;
  private gainNodes: Map<HTMLAudioElement, GainNode> = new Map();
  private elementGenerations = new WeakMap<HTMLAudioElement, number>();
  private nextElementGeneration = 1;
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
        try {
          source.disconnect();
        } catch {
          /* ignore */
        }
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

  private claimElement(audio: HTMLAudioElement): number {
    const generation = this.nextElementGeneration++;
    this.elementGenerations.set(audio, generation);
    return generation;
  }

  private ownsElement(audio: HTMLAudioElement, generation: number): boolean {
    return this.elementGenerations.get(audio) === generation;
  }

  private resetElementGain(audio: HTMLAudioElement): void {
    const gainNode = this.gainNodes.get(audio);
    if (!gainNode || !this.context) return;

    const now = this.context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(1, now);
  }

  /**
   * Claims a deck for ordinary playback and removes any abandoned crossfade ramp.
   */
  public prepareForDirectPlayback(audio: HTMLAudioElement): void {
    this.claimElement(audio);
    this.resetElementGain(audio);
  }

  /**
   * Stops a deck and invalidates any pending crossfade that still references it.
   */
  public pauseAndReset(audio: HTMLAudioElement, rewind = false): void {
    this.claimElement(audio);
    audio.pause();
    if (rewind) {
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore unavailable seek while media is changing */
      }
    }
    this.resetElementGain(audio);
  }

  /**
   * Calculates the dynamic crossfade duration.
   */
  public calculateDynamicDuration(songId1: string, songId2: string): number {
    const emotionStore = getEmotionSnapshot();
    const distance = emotionStore.calculateDistance(songId1, songId2);
    const minDuration = 1.5; // Reduced for better responsiveness
    const maxDuration = 5;
    const rawDuration = minDuration + (distance / 2.82) * (maxDuration - minDuration);
    return isFinite(rawDuration)
      ? Math.min(maxDuration, Math.max(minDuration, rawDuration))
      : minDuration;
  }

  /**
   * Performs a crossfade. New calls will override previous ones.
   */
  public async crossfade(
    fromAudio: HTMLAudioElement,
    toAudio: HTMLAudioElement,
    duration: number,
    isCurrentRequest: () => boolean = () => true,
    canCleanupFromAudio: () => boolean = () => true,
    canCleanupToAudio: () => boolean = () => true
  ): Promise<void> {
    const fromGain = this.prepareElement(fromAudio);
    const toGain = this.prepareElement(toAudio);

    if (!fromGain || !toGain || !this.context) return;

    const fromGeneration = this.claimElement(fromAudio);
    const toGeneration = this.claimElement(toAudio);

    const now = this.context.currentTime;

    // Cancel LegacyAny ongoing ramps on BOTH nodes to prevent overlaps
    fromGain.gain.cancelScheduledValues(now);
    toGain.gain.cancelScheduledValues(now);

    // Initial states
    fromGain.gain.setValueAtTime(fromGain.gain.value, now);
    toGain.gain.setValueAtTime(0, now);
    toAudio.volume = 1;

    try {
      await toAudio.play();
    } catch (e: LegacyAny) {
      if (
        !isCurrentRequest() ||
        !this.ownsElement(fromAudio, fromGeneration) ||
        !this.ownsElement(toAudio, toGeneration)
      ) {
        this.cleanupStaleDeck(toAudio, toGeneration, canCleanupToAudio);
        this.cleanupStaleDeck(fromAudio, fromGeneration, canCleanupFromAudio);
        return;
      }
      const isAbort =
        e.name === "AbortError" || e.code === 20 || e.message?.includes("interrupted");
      if (!isAbort) {
        console.error("Crossfade play failed:", e);
      }
      this.resetElementGain(toAudio); // Fallback to instant play
      return;
    }

    // A newer selection may have reused either deck while play() was pending.
    if (
      !isCurrentRequest() ||
      !this.ownsElement(fromAudio, fromGeneration) ||
      !this.ownsElement(toAudio, toGeneration)
    ) {
      this.cleanupStaleDeck(toAudio, toGeneration, canCleanupToAudio);
      this.cleanupStaleDeck(fromAudio, fromGeneration, canCleanupFromAudio);
      return;
    }

    // Perform smooth linear ramps
    const fadeStart = this.context.currentTime;
    fromGain.gain.cancelScheduledValues(fadeStart);
    toGain.gain.cancelScheduledValues(fadeStart);
    fromGain.gain.setValueAtTime(fromGain.gain.value, fadeStart);
    toGain.gain.setValueAtTime(0, fadeStart);
    fromGain.gain.linearRampToValueAtTime(0.001, fadeStart + duration);
    toGain.gain.linearRampToValueAtTime(1, fadeStart + duration);

    // We don't block the UI with a long await anymore.
    // We use a timer just for the 'from' cleanup.
    setTimeout(
      () => {
        try {
          // A stale fade may still clean its outgoing deck if the deck was not
          // reused as the active target of a newer playback request.
          if (
            this.ownsElement(fromAudio, fromGeneration) &&
            canCleanupFromAudio() &&
            fromAudio.paused === false
          ) {
            fromAudio.pause();
            fromAudio.currentTime = 0;
            this.resetElementGain(fromAudio);
          }
        } catch {
          /* ignore */
        }
      },
      duration * 1000 + 100
    );
  }

  private cleanupStaleDeck(
    audio: HTMLAudioElement,
    generation: number,
    canCleanup: () => boolean
  ): void {
    if (!this.ownsElement(audio, generation)) return;

    if (canCleanup()) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore unavailable seek while media is changing */
      }
    }

    this.resetElementGain(audio);
  }
}
