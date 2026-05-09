"use client";

import React, { useState } from "react";
import { Mic, Volume2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export const SpeechSynthesisPanel: React.FC = () => {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const models = [{ id: "sambert-zh", name: "SamBERT", desc: "中文语音合成" }];

  const handleSynthesize = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("http://localhost:8000/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "sambert-zh",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error_message || "合成失败");
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
          <Mic className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">语音合成</h3>
          <p className="text-sm text-white/60">SamBERT 中文 TTS</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">输入文本</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要合成的中文文本..."
            className="w-full h-40 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 resize-none focus:outline-none focus:border-pink-400/50"
          />
        </div>

        <button
          onClick={handleSynthesize}
          disabled={!text.trim() || isProcessing}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              合成中...
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              开始合成
            </>
          )}
        </button>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-pink-500/10 border border-pink-500/20"
          >
            <CheckCircle className="w-5 h-5 text-pink-400" />
            <span className="text-white font-medium">合成完成！（模拟模式）</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SpeechSynthesisPanel;
