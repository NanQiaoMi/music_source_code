"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRecordingStore } from "@/store/recordingStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { X, Circle, Square, Download, Trash2, Play, Video } from "lucide-react";

interface RecordingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function RecordingPanel({ isOpen, onClose, canvasRef }: RecordingPanelProps) {
  const {
    status,
    recordingTime,
    videoUrl,
    startRecording,
    stopRecording,
    setRecordingTime,
    setVideoBlob,
    clearRecording,
    downloadRecording,
  } = useRecordingStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (mediaRecorderRef.current && status === "recording") {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isOpen, status]);

  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, setRecordingTime]);

  const handleStartRecording = async () => {
    if (!canvasRef.current) return;

    try {
      const stream = canvasRef.current.captureStream(30);

      const engine = AudioEngine.getInstance();
      const audioContext = engine.getContext();
      if (!audioContext) return;

      const destination = audioContext.createMediaStreamDestination();
      const mixedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: "video/webm;codecs=vp9",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      startRecording();
    } catch (error) {
      console.error("Recording failed:", error);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    stopRecording();
    useStatsAchievementsStore.getState().reportProToolsUsage("recording");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ duration: 0.3 }}
        className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-2xl border-l border-white/20 z-50"
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-pink-400" />
              <h2 className="text-xl font-bold text-white">录制</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center">
              <div
                className={`text-4xl font-bold mb-2 ${
                  status === "recording" ? "text-red-500 animate-pulse" : "text-white"
                }`}
              >
                {formatTime(recordingTime)}
              </div>
              <div className="text-sm text-white/60">
                {status === "idle" && "准备就绪"}
                {status === "recording" && "录制中..."}
                {status === "processing" && "处理中..."}
                {status === "ready" && "录制完成"}
              </div>
            </div>

            {status === "recording" && (
              <div className="flex justify-center">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              </div>
            )}

            {status === "ready" && videoUrl && (
              <div className="space-y-3">
                <video src={videoUrl} controls className="w-full rounded-lg bg-black" />
                <div className="flex gap-2">
                  <button
                    onClick={downloadRecording}
                    className="flex-1 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    下载
                  </button>
                  <button
                    onClick={clearRecording}
                    className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {status !== "recording" && status !== "processing" && (
              <div className="flex justify-center">
                {status === "idle" && (
                  <button
                    onClick={handleStartRecording}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-red-500/30"
                  >
                    <Circle className="w-10 h-10 text-white" />
                  </button>
                )}
                {status === "ready" && (
                  <button
                    onClick={clearRecording}
                    className="w-20 h-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105"
                  >
                    <Play className="w-10 h-10 text-white ml-1" />
                  </button>
                )}
              </div>
            )}

            {status === "recording" && (
              <div className="flex justify-center">
                <button
                  onClick={handleStopRecording}
                  className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-105"
                >
                  <Square className="w-8 h-8 text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
