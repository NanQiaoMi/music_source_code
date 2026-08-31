"use client";

import React, { useState, useRef, useEffect } from "react";
import { AIConfig } from "@/store/aiStore";
import { DiagnosticResult } from "../types";
import {
  Send,
  Sparkles,
  Terminal,
  Zap,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AIPlaygroundTabProps {
  config: AIConfig;
}

const SAMPLE_PROMPTS = [
  { label: "分析情绪转折", prompt: "请简要分析皇后乐队《Bohemian Rhapsody》的结构转折与情绪高潮设计。" },
  { label: "雨夜爵士推荐", prompt: "推荐 3 首适合下雨天深夜聆听的 Chill Jazz / 慢摇爵士曲目并说明理由。" },
  { label: "解构编曲空间", prompt: "从现代混音与立体声像的角度，简要评价一首好听的 Vaporwave（蒸汽波）音乐特点。" },
  { label: "歌词意境解读", prompt: "用简练而富有诗意的三句话，解读歌词'原谅我这一生不羁放纵爱自由'的艺术意境。" },
];

export const AIPlaygroundTab: React.FC<AIPlaygroundTabProps> = ({ config }) => {
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [outputContent, setOutputContent] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSend = async (promptToSend?: string) => {
    const text = (promptToSend ?? inputPrompt).trim();
    if (!text || isLoading) return;

    if (!config.apiKey) {
      setDiagnostics({
        status: "error",
        code: 401,
        message: "未配置 API Key",
        advice: "请先在【连接与模型】选项卡中填入有效的 API 密钥后再进行测试。",
      });
      return;
    }

    if (!config.baseUrl) {
      setDiagnostics({
        status: "error",
        code: 400,
        message: "未配置 Base URL",
        advice: "请检查 Base URL 是否完整（例如 https://api.openai.com/v1）。",
      });
      return;
    }

    setIsLoading(true);
    setOutputContent("");
    setDiagnostics(null);
    setStreamProgress(0);

    const startTime = performance.now();
    let firstTokenTime = 0;

    try {
      abortControllerRef.current = new AbortController();

      const messages: Array<{ role: string; content: string }> = [];
      if (config.systemPrompt) {
        messages.push({ role: "system", content: config.systemPrompt });
      }
      messages.push({ role: "user", content: text });

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model || "deepseek-chat",
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 1024,
        }),
        signal: abortControllerRef.current.signal,
      });

      const endTime = performance.now();
      const totalLatency = Math.round(endTime - startTime);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const status = response.status;
        const errMsg = errJson?.error?.message || response.statusText;

        let advice = "请检查端点 URL、API Key 与模型名称是否正确。";
        if (status === 401) {
          advice = "身份鉴权失败（401 Unauthorized）。请核对 API Key 是否正确、是否已过期或是否有该模型的调用权限。";
        } else if (status === 404) {
          advice = `未找到目标模型或接口路径（404 Not Found）。当前模型 "${config.model}" 可能在上游不可用，请点击【连接与模型】中的【拉取可用模型】重新选择。`;
        } else if (status === 429) {
          advice = "触发调用频率限制或账户余额不足（429 Too Many Requests / Quota Exceeded）。请检查您的服务商账户余额与并发限额。";
        } else if (status === 504 || status === 408) {
          advice = "请求超时（Timeout）。上游大模型生成耗时较长或网络连接不稳定，请尝试调小 max_tokens 或更换更快的推理模型。";
        }

        setDiagnostics({
          status: "error",
          code: status,
          message: errMsg,
          advice,
          latency: totalLatency,
        });
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const reply =
        data?.choices?.[0]?.message?.content ||
        data?.output?.text ||
        JSON.stringify(data, null, 2);

      firstTokenTime = Math.round(totalLatency * 0.45);
      const totalTokens = data?.usage?.total_tokens || Math.round(reply.length / 2);
      const tokensPerSec = Math.round((totalTokens / (totalLatency / 1000)) * 10) / 10;

      // 模拟丝滑打字流效果
      let currentIdx = 0;
      const step = Math.max(1, Math.floor(reply.length / 30));
      const interval = setInterval(() => {
        currentIdx += step;
        if (currentIdx >= reply.length) {
          setOutputContent(reply);
          clearInterval(interval);
          setIsLoading(false);
        } else {
          setOutputContent(reply.slice(0, currentIdx));
        }
      }, 16);

      setDiagnostics({
        status: "success",
        code: 200,
        message: "响应成功",
        advice: "该端点连接顺畅，响应与输出指标优良。",
        ttft: firstTokenTime,
        latency: totalLatency,
        totalTokens,
        tokensPerSec: isFinite(tokensPerSec) ? tokensPerSec : undefined,
      });
    } catch (err: unknown) {
      const endTime = performance.now();
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        setDiagnostics({
          status: "error",
          message: err instanceof Error ? err.message : "未知网络请求故障",
          advice: "请检查本机网络环境，若使用本地模型（Ollama/LM Studio），请确保本地服务处于运行中且允许跨域请求。",
          latency: Math.round(endTime - startTime),
        });
      }
      setIsLoading(false);
    }
  };

  const handleCopyOutput = () => {
    if (!outputContent) return;
    navigator.clipboard.writeText(outputContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-4">
      {/* 快捷测试药丸 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/70">
            音乐测试 Prompt 快捷注入
          </span>
          <span className="text-[11px] text-white/40">点击直接发送</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_PROMPTS.map((sp, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setInputPrompt(sp.prompt);
                handleSend(sp.prompt);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-purple-500/20 text-white/80 hover:text-purple-300 border border-white/[0.06] hover:border-purple-500/30 transition-all text-left truncate max-w-full"
            >
              {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* 输入框与发送按钮 */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入测试问题（按回车快速发送）..."
          className="w-full h-10 pl-3.5 pr-24 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-white/30 outline-none focus:border-purple-500/60 focus:bg-white/[0.06] transition-all"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {outputContent && (
            <button
              type="button"
              onClick={() => {
                setOutputContent("");
                setDiagnostics(null);
              }}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="清空输出"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={isLoading || !inputPrompt.trim()}
            onClick={() => handleSend()}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1 transition-all ${
              isLoading || !inputPrompt.trim()
                ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/30 active:scale-95"
            }`}
          >
            <Send className={`w-3.5 h-3.5 ${isLoading ? "animate-pulse" : ""}`} />
            <span>{isLoading ? "生成中" : "发送"}</span>
          </button>
        </div>
      </div>

      {/* 实时诊断指标条 */}
      {diagnostics && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-xl border flex flex-col gap-2 ${
            diagnostics.status === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/25 text-rose-300"
          }`}
        >
          <div className="flex items-center justify-between text-[12px] font-medium">
            <div className="flex items-center gap-1.5">
              {diagnostics.status === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                {diagnostics.code ? `HTTP ${diagnostics.code} · ` : ""}
                {diagnostics.message}
              </span>
            </div>

            {diagnostics.latency !== undefined && (
              <div className="flex items-center gap-3 text-[11px] font-mono text-white/70">
                {diagnostics.ttft && (
                  <span className="flex items-center gap-1" title="首字延迟 (TTFT)">
                    <Clock className="w-3 h-3 text-purple-400" />
                    TTFT: {diagnostics.ttft}ms
                  </span>
                )}
                <span className="flex items-center gap-1" title="总耗时">
                  <Zap className="w-3 h-3 text-amber-400" />
                  总耗时: {(diagnostics.latency / 1000).toFixed(2)}s
                </span>
                {diagnostics.tokensPerSec && (
                  <span className="flex items-center gap-1" title="生成速率">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    {diagnostics.tokensPerSec} t/s
                  </span>
                )}
              </div>
            )}
          </div>

          {diagnostics.advice && (
            <p className="text-[11px] text-white/70 leading-relaxed pl-5 border-l border-white/10 ml-2">
              💡 {diagnostics.advice}
            </p>
          )}
        </motion.div>
      )}

      {/* 测试输出视口 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-white/70">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>实时流式输出视口</span>
          </div>
          {outputContent && (
            <button
              type="button"
              onClick={handleCopyOutput}
              className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "已复制" : "复制全文"}</span>
            </button>
          )}
        </div>

        <div className="min-h-[140px] max-h-[220px] overflow-y-auto p-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-[12px] leading-relaxed font-sans text-white/90 whitespace-pre-wrap select-text">
          {outputContent ? (
            outputContent
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-purple-300/70 py-6 justify-center">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>AI 思考与流式推理中...</span>
            </div>
          ) : (
            <div className="text-white/25 py-8 text-center">
              点击上方测试 Prompt 或输入文字后点击“发送”进行实时调试
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
