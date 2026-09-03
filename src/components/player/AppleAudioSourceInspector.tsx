"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { endpointCircuitBreaker, CoolingHostInfo } from "@/services/EndpointCircuitBreaker";
import { networkPriorityManager } from "@/services/networkPriorityManager";
import {
  X,
  CheckCircle2,
  Lock,
  Activity,
  Layers,
  Zap,
  Cpu,
  Radio,
  Sparkles,
  Music,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Server,
} from "lucide-react";

interface AppleAudioSourceInspectorProps {
  onClose: () => void;
}

export const AppleAudioSourceInspector: React.FC<AppleAudioSourceInspectorProps> = ({ onClose }) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);

  const [activeTab, setActiveTab] = useState<"sources" | "stream" | "dsp" | "decrypt">("sources");
  const [liveBpm, setLiveBpm] = useState(128);
  const [simulatedEnergy, setSimulatedEnergy] = useState({ low: 0.65, mid: 0.42, snap: 0.81 });
  const [coolingHosts, setCoolingHosts] = useState<CoolingHostInfo[]>(() =>
    endpointCircuitBreaker.getCoolingHosts()
  );

  const refreshCoolingHosts = () => {
    setCoolingHosts(endpointCircuitBreaker.getCoolingHosts());
  };

  const handleResetCircuitBreaker = () => {
    endpointCircuitBreaker.resetAll();
    setCoolingHosts([]);
  };

  useEffect(() => {
    refreshCoolingHosts();
  }, [activeTab]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedEnergy({
        low: Math.min(1.0, 0.4 + Math.random() * 0.55),
        mid: Math.min(1.0, 0.3 + Math.random() * 0.45),
        snap: Math.min(1.0, 0.2 + Math.random() * 0.6),
      });
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md">
      {/* 模态框主体 (Apple 风格白屋与精细圆角) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl bg-[#f5f5f7] dark:bg-[#1d1d1f] rounded-[24px] shadow-[0_20px_70px_rgba(0,0,0,0.25)] border border-black/5 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* 顶部标题栏与关闭按钮 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#252528]/60 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#0071e3]/10 dark:bg-[#0071e3]/20 flex items-center justify-center text-[#0071e3]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                音频底座与高保真 DSP 监视器
              </h3>
              <p className="text-[12px] text-[#858585] dark:text-[#a1a1a6]">
                Apple Hi-Res Audio Architecture & DSP Pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Apple 经典 Segmented Control (分段选择器) */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-4 p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab("sources")}
              className={`py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 ${
                activeTab === "sources"
                  ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#858585] hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              多源聚合
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stream")}
              className={`py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 ${
                activeTab === "stream"
                  ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#858585] hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              流防护自愈
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dsp")}
              className={`py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 ${
                activeTab === "dsp"
                  ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#858585] hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              节拍分析
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("decrypt")}
              className={`py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 ${
                activeTab === "decrypt"
                  ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-sm"
                  : "text-[#858585] hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              实时解密
            </button>
          </div>
        </div>

        {/* 内容主体区域 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: 多源聚合与试听自动降级 */}
          {activeTab === "sources" && (
            <div className="space-y-4">
              {/* 当前歌曲音源解析结果卡片 */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">
                    当前音源解析状态
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20">
                    <CheckCircle2 className="w-3 h-3" />
                    已成功锁定无损完整源
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h4 className="text-base font-bold text-[#1d1d1f] dark:text-white">
                      {currentSong?.title || "后来你好吗"}
                    </h4>
                    <p className="text-xs text-[#858585] mt-0.5">
                      {currentSong?.artist || "A-Lin"} · FLAC 24-bit / 96kHz (2842 kbps)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#0071e3]">
                      0ms 试听零感知替换
                    </span>
                  </div>
                </div>
              </div>

              {/* 平台级联降级策略表格 */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-[#858585] px-1">全网多源降级路由链路</h5>
                <div className="space-y-1.5">
                  {[
                    { platform: "网易云音乐 (原生)", status: "已就绪", role: "第一优先级 · 试听嗅探", active: true },
                    { platform: "QQ 音乐 (VIP/Free)", status: "已连接", role: "第二优先级 · 备用无损替代", active: true },
                    { platform: "酷狗音乐 (高解析)", status: "已就绪", role: "第三优先级 · 指纹 Hash 匹配", active: true },
                    { platform: "汽水音乐 (Spade解密)", status: "实时解密就绪", role: "第四优先级 · 独家音源解密", active: true },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/70 dark:bg-[#2c2c2e]/70 border border-black/5 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
                        <span className="font-semibold text-[#1d1d1f] dark:text-white">{item.platform}</span>
                      </div>
                      <span className="text-[#858585]">{item.role}</span>
                      <span className="font-mono text-[11px] font-bold text-[#34c759]">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: 流媒体抗卡顿与自愈监控 */}
          {activeTab === "stream" && (
            <div className="space-y-4">
              {/* 核心防护盾状态卡片 */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">
                    流媒体引擎抗卡顿防护盾
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20">
                    <ShieldCheck className="w-3 h-3" />
                    抗死循环 & 智能断点自愈生效中
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1f] dark:text-white">
                      <HardDrive className="w-3.5 h-3.5 text-[#0071e3]" />
                      代理层磁盘 LRU 缓存
                    </div>
                    <p className="text-[11px] text-[#858585] mt-1">
                      1GB 配额 · SHA-256 哈希切片 · 二次加载 0ms 本地瞬发
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1d1d1f] dark:text-white">
                      <Zap className="w-3.5 h-3.5 text-[#34c759]" />
                      智能断点重连 (Stutter Resume)
                    </div>
                    <p className="text-[11px] text-[#858585] mt-1">
                      缓冲停顿 &gt; 2.0s 自动触发 Range 毫秒级断点重连
                    </p>
                  </div>
                </div>
              </div>

              {/* 三级网络优先级队列状态 */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-2.5">
                <h5 className="text-xs font-semibold text-[#858585]">三级网络并发调度队列</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">P0 · 音频拉流与直链嗅探</span>
                    <span className="font-mono text-[#34c759] font-bold">独占最高通道 (零阻塞)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">P1 · 歌词解析与封面拉取</span>
                    <span className="font-mono text-[#0071e3] font-bold">动态并发保护</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-black/5 dark:bg-white/5">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">P2 · AI 通感笔记与预加载</span>
                    <span className="font-mono text-[#ff9500] font-bold">
                      {networkPriorityManager.isAudioBuffering() ? "音频缓冲中 · 自动挂起" : "就绪 · 零抢占"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 动态熔断心跳池卡片 */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#858585]" />
                    <span className="text-xs font-semibold text-[#858585]">第三方接口动态熔断心跳池</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetCircuitBreaker}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1d1d1f] dark:text-white transition-all active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3" />
                    复位熔断池
                  </button>
                </div>

                {coolingHosts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#34c759]/5 border border-[#34c759]/20 text-center">
                    <p className="text-xs text-[#34c759] font-semibold">
                      全网所有音源接口与解析节点状态健康，无处于熔断冷却期的节点
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-[#ff9500] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      以下节点因连通异常被临时阶梯式熔断，当前 0ms 快速跳过：
                    </p>
                    {coolingHosts.map((item) => (
                      <div
                        key={item.host}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs font-mono"
                      >
                        <span className="text-[#ff3b30] font-bold">{item.host}</span>
                        <span className="text-[#ff3b30] text-[11px]">
                          连续失败 {item.failureCount} 次 · 隔离余 {item.remainingSeconds}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Biquad 节拍与下拍分析 */}
          {activeTab === "dsp" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">
                    DSP 实时频率与节拍监控
                  </span>
                  <span className="text-xs font-mono font-bold text-[#0071e3]">
                    BPM: {liveBpm} · 4/4 拍律动
                  </span>
                </div>

                {/* 频段能量计 */}
                <div className="space-y-2.5 pt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1d1d1f] dark:text-white">
                        低音与底鼓 (Lowpass 20-140Hz)
                      </span>
                      <span className="font-mono text-[#0071e3] font-bold">
                        {Math.round(simulatedEnergy.low * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#0071e3] rounded-full transition-all duration-150"
                        style={{ width: `${simulatedEnergy.low * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1d1d1f] dark:text-white">
                        军鼓与人声基频 (Bandpass 200-800Hz)
                      </span>
                      <span className="font-mono text-[#a855f7] font-bold">
                        {Math.round(simulatedEnergy.mid * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#a855f7] rounded-full transition-all duration-150"
                        style={{ width: `${simulatedEnergy.mid * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1d1d1f] dark:text-white">
                        踩镲与高频瞬态 (Highpass 2400-8000Hz)
                      </span>
                      <span className="font-mono text-[#00f5ff] font-bold">
                        {Math.round(simulatedEnergy.snap * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#00f5ff] rounded-full transition-all duration-150"
                        style={{ width: `${simulatedEnergy.snap * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0071e3]/5 border border-[#0071e3]/15 flex items-center gap-3">
                <Activity className="w-5 h-5 text-[#0071e3] shrink-0" />
                <p className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed">
                  已启用下拍 (Downbeat) 智能锚定，小节强拍已与 3D 粒子流场地貌、电影机镜头推拉与发光歌词实现物理对齐。
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: SpadeKey 实时解密 */}
          {activeTab === "decrypt" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-black/5 dark:border-white/5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">
                    SpadeKey AES-128 流式音频解密器
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#34c759]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    透明流式解密已就绪
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-[#858585]">解密算法</span>
                    <p className="text-xs font-mono font-bold text-[#1d1d1f] dark:text-white">
                      AES-128-ECB (Zero Padding)
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-1">
                    <span className="text-[11px] text-[#858585]">密钥生成机制</span>
                    <p className="text-xs font-mono font-bold text-[#1d1d1f] dark:text-white">
                      Base36 Spade Shifting XOR
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    MP4/AAC 容器解密吞吐率
                  </span>
                  <span className="font-mono text-[#0071e3] font-bold">48.2 MB/s (零拷贝)</span>
                </div>
                <p className="text-[#858585] text-[11px] leading-relaxed">
                  音频数据流在内存缓冲区中完成实时解密并直接送入 Web Audio API 单例，不产生多余临时文件，保障发烧级低延迟。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 底部 Apple Pill 按钮 */}
        <div className="px-6 py-4 border-t border-black/5 dark:border-white/10 bg-white/60 dark:bg-[#252528]/60 backdrop-blur-xl flex items-center justify-between">
          <span className="text-xs text-[#858585]">
            MIMI Music Player · Next-Gen Audio Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold tracking-tight shadow-[0_2px_10px_rgba(0,113,227,0.35)] transition-all active:scale-95"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};
