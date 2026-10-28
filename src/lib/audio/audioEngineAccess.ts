/**
 * S6-12a：AudioEngine 只读访问器。
 *
 * 这些 getter 原本定义在 src/hooks/useAudioPlayer.ts，导致 lib/audio 反向 import hooks
 * （AudioEffectsManager / AudioVisualizerManager）。访问器本身不依赖 React，下沉到 lib
 * 后 lib 保持框架无关；useAudioPlayer 继续 re-export 以维持旧调用点兼容。
 */
import { AudioEngine } from "@/lib/audio/AudioEngine";

export const getAudioAnalyser = (): AnalyserNode | null => AudioEngine.getInstance().getAnalyser();

export const getAudioContext = (): AudioContext | null => AudioEngine.getInstance().getContext();
