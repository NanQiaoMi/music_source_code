"use client";

import React, { useState, useRef } from "react";
import { Image, Upload, Loader2, CheckCircle, AlertCircle, Camera } from "lucide-react";
import { motion } from "framer-motion";

export const VisionProcessingPanel: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    top_label: string;
    confidence: number;
    labels: string[];
    scores: number[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("vit-base");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = [
    { id: "vit-base", name: "ViT Base", desc: "图像分类" },
    { id: "clip-vit", name: "CLIP ViT", desc: "图文检索" },
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
        `http://localhost:8000/api/vision/process?model_id=${selectedModel}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success && data.vision) {
        setResult(data.vision);
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">视觉处理</h3>
          <p className="text-sm text-white/60">ViT / CLIP 图像分类</p>
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
                    ? "border-cyan-400 bg-cyan-500/20"
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
          <label className="block text-sm font-medium text-white/80 mb-2">上传图像</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              selectedFile
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {selectedFile ? (
                <>
                  <CheckCircle className="w-10 h-10 text-cyan-400" />
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
                    <div className="text-white/50 text-sm">支持 JPG, PNG, WebP (最大 20MB)</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={!selectedFile || isProcessing}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <Image className="w-5 h-5" />
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
            <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">处理完成</span>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500">
                <span className="text-2xl font-bold text-white">{result.top_label}</span>
              </div>
              <div className="mt-2 text-white/70">
                置信度: {(result.confidence * 100).toFixed(1)}%
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-white/80 mb-3">Top 5 标签</div>
              {result.labels.slice(0, 5).map((label, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{label}</span>
                    <span className="text-white/90 font-mono">
                      {(result.scores[index] * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${result.scores[index] * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VisionProcessingPanel;
