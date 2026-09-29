import React from "react";
import { Activity, Loader2 } from "lucide-react";
import { StatusDot, StatusKind } from "./StatusDot";

export interface HealthRow {
  id: string;
  name: string;
  status: StatusKind;
  latencyMs: number | null;
}

export interface SourceHealthSummaryProps {
  sources: HealthRow[];
  probing?: boolean;
  onRunDiagnostics: () => void;
}

export function SourceHealthSummary({
  sources,
  probing = false,
  onRunDiagnostics,
}: SourceHealthSummaryProps) {
  const count = (s: StatusKind) => sources.filter((x) => x.status === s).length;
  const ok = count("ok");
  const warn = count("warn");
  const err = count("error");
  const idle = count("idle");
  const probed = ok + warn + err;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          <span className="text-white/45">音源健康</span>
          {probed === 0 && !probing && <span className="text-white/35">尚未测速</span>}
          {probing && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <Loader2 className="w-3 h-3 animate-spin" />
              测速中
            </span>
          )}
          {ok > 0 && <span className="text-emerald-300">{ok} 在线</span>}
          {warn > 0 && <span className="text-amber-300">{warn} 需处理</span>}
          {err > 0 && <span className="text-rose-300">{err} 异常</span>}
          {idle > 0 && <span className="text-white/35">{idle} 未测</span>}
        </div>

        <button
          type="button"
          onClick={onRunDiagnostics}
          disabled={probing}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[12px] text-white/80 disabled:opacity-50 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          {probing ? "测速中…" : "快速测速"}
        </button>
      </div>

      {probed > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] flex flex-wrap gap-x-5 gap-y-1.5">
          {sources.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="truncate max-w-[120px]">{s.name}</span>
              <StatusDot status={s.status} latencyMs={s.latencyMs ?? undefined} showLabel />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
