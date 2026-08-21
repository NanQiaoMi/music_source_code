/**
 * MimiMusic Resource Reclaimer & Memory Lifecycle Pipeline
 *
 * Tracks, manages, and cleans up transient resources such as blob URLs,
 * offscreen canvases, and detached media elements to prevent memory leaks
 * during long-term 24/7 continuous playback.
 */

class ResourceReclaimer {
  private static instance: ResourceReclaimer;
  private activeBlobUrls = new Set<string>();
  private audioCleanupQueue: HTMLAudioElement[] = [];

  public static getInstance(): ResourceReclaimer {
    if (!ResourceReclaimer.instance) {
      ResourceReclaimer.instance = new ResourceReclaimer();
    }
    return ResourceReclaimer.instance;
  }

  /**
   * Registers a Blob URL to be managed and eventually revoked.
   */
  public registerBlobUrl(url: string): string {
    if (url && url.startsWith("blob:")) {
      this.activeBlobUrls.add(url);
    }
    return url;
  }

  /**
   * Explicitly revokes a Blob URL and removes it from active tracking.
   */
  public revokeBlobUrl(url?: string | null): void {
    if (!url || typeof window === "undefined") return;

    if (url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
        this.activeBlobUrls.delete(url);
      } catch (e) {
        console.warn("[ResourceReclaimer] Failed to revoke blob URL:", e);
      }
    }
  }

  /**
   * Safely disposes and cleans up an HTMLAudioElement.
   */
  public disposeAudioElement(audio?: HTMLAudioElement | null): void {
    if (!audio) return;

    try {
      audio.pause();
      if (audio.src && audio.src.startsWith("blob:")) {
        this.revokeBlobUrl(audio.src);
      }
      audio.removeAttribute("src");
      audio.load();
    } catch {
      // Ignored
    }
  }

  /**
   * Bulk cleanup of all registered Blob URLs during session reset or logout.
   */
  public purgeAllBlobUrls(): void {
    if (typeof window === "undefined") return;

    for (const url of this.activeBlobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignored
      }
    }
    this.activeBlobUrls.clear();
  }

  /**
   * Gets the count of currently tracked active blob URLs.
   */
  public getActiveBlobCount(): number {
    return this.activeBlobUrls.size;
  }
}

export const resourceReclaimer = ResourceReclaimer.getInstance();
