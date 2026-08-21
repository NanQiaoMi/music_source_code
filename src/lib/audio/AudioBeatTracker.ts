export interface BeatEvent {
  time: number;
  energy: number;
  isDownbeat: boolean;
  confidence: number;
}

export interface SongStructureSection {
  role: 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro';
  startTime: number;
  endTime: number;
  averageEnergy: number;
}

export class AudioBeatTracker {
  private bpm: number = 120;
  private energyHistory: number[] = [];
  private lastBeatTime: number = 0;

  constructor() {}

  /**
   * 实时从时域与频域数据中检测节拍冲击 (Transient Peak Detection)
   */
  public processFrame(frequencyData: Uint8Array, currentTime: number): { isBeat: boolean; energy: number; impact: number } {
    let sum = 0;
    // 聚焦低频区 (20Hz - 250Hz, 约前 1/6 频段)
    const lowFreqLength = Math.floor(frequencyData.length / 6);
    for (let i = 0; i < lowFreqLength; i++) {
      sum += frequencyData[i];
    }
    const currentEnergy = sum / (lowFreqLength * 255);

    this.energyHistory.push(currentEnergy);
    if (this.energyHistory.length > 40) {
      this.energyHistory.shift();
    }

    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const variance = this.energyHistory.reduce((a, b) => a + Math.pow(b - avgEnergy, 2), 0) / this.energyHistory.length;
    const dynamicThreshold = avgEnergy + Math.sqrt(variance) * 1.5;

    const timeSinceLastBeat = currentTime - this.lastBeatTime;
    const isBeat = currentEnergy > dynamicThreshold && currentEnergy > 0.35 && timeSinceLastBeat > 0.22;

    if (isBeat) {
      this.lastBeatTime = currentTime;
      if (timeSinceLastBeat > 0.3 && timeSinceLastBeat < 1.5) {
        const instantBpm = 60 / timeSinceLastBeat;
        this.bpm = Math.round(this.bpm * 0.8 + instantBpm * 0.2);
      }
    }

    const impact = isBeat ? Math.min(2.0, (currentEnergy - avgEnergy) * 3.5) : 0;

    return { isBeat, energy: currentEnergy, impact };
  }

  public getBpm(): number {
    return this.bpm;
  }
}

export const globalBeatTracker = new AudioBeatTracker();
