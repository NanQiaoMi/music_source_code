"use client";

import React, { useState, useRef } from "react";
import { Music, FileAudio, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";

export const AudioProcessingPanel: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    genre: string;
    confidence: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("wav2vec2-base");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportUsage = useStatsAchievementsStore((state) => state.reportProToolsUsage);

  const models = [
    { id: "wav2vec2-base", name: "Wav2Vec 2.0", desc: "音频特征提取" },
    { id: "hubert-base", name: "HuBERT", desc: "音频特征提取" },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `http://localhost:8000/api/audio/process?model_id=${selectedModel}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success && data.features) {
        setResult(data.features);
        reportUsage("audio_processing");
      } else {
        setError(data.error_message || "处理失败");
      }
    } catch (err) {
      setError("网络错误，请确保后端服务已启动");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
          <Music className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">音频处理</h3>
          <p className="text-sm text-white/60">Wav2Vec 2.0 / HuBERT 音乐分类</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">选择模型</label>
          <div className="grid grid-cols-2 gap-3">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedModel === model.id
                    ? "border-orange-400 bg-orange-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="text-white font-medium text-sm">{model.name}</div>
                <div className="text-white/50 text-xs mt-1">{model.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">上传音频文件</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              selectedFile
                ? "border-orange-400 bg-orange-500/10"
                : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {selectedFile ? (
                <>
                  <CheckCircle className="w-10 h-10 text-orange-400" />
                  <div className="text-center">
                    <div className="text-white font-medium">{selectedFile.name}</div>
                    <div className="text-white/50 text-sm">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-white/50" />
                  <div className="text-center">
                    <div className="text-white/80">点击或拖拽上传</div>
                    <div className="text-white/50 text-sm">
                      支持 WAV, MP3, WebM, OGG, FLAC (最大 100MB)
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={!selectedFile || isProcessing}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <FileAudio className="w-5 h-5" />
              开始处理
            </>
          )}
        </button>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-orange-400" />
                <span className="text-white font-medium">处理完成</span>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-br from-orange-500 to-amber-500">
                <span className="text-2xl font-bold text-white">{result.genre}</span>
              </div>
              <div className="mt-2 text-white/70">
                置信度: {(result.confidence * 100).toFixed(1)}%
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AudioProcessingPanel;
