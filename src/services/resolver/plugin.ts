/**
 * Resolver 插件契约 + 注册表 (S7-1b)。
 *
 * 目标：把 MultiSourceResolver 里的平台 if/else 分派换成注册表查询，
 * 平台实现各自成插件（id/label/aliases/canHandle/resolve），返回结构不变。
 * 门面只保留：优先级预算、竞速、兜底、缓存、取消语义（S1-8）。
 *
 * 纯模块：不 import store，平台差异全部经 ResolverPluginContext 注入。
 */
import type { ResolvedAudioSource, SongMetadataQuery } from "./types";
import {
  getHostCircuitStates,
  getHttpMetrics,
  type HttpMetricsSnapshot,
} from "@/services/http/client";
import type { HostCircuitSnapshot } from "@/services/http/circuitBreaker";

export interface ResolverInput {
  query?: SongMetadataQuery;
  /** 显式平台曲目 id（网易云数字 id / QQ mid / 酷狗 hash / 酷我 rid / 汽水 id）。 */
  id?: string;
  /** 来源标识（含别名 wy/tx/kg/kw）。 */
  source?: string;
}

/** 平台插件可用的注入依赖：门面负责把 store/工具函数接进来，插件不直连 store。 */
export interface ResolverPluginContext {
  signal?: AbortSignal;
  apiBase: string;
  isLoggedIn: (platform: string) => boolean;
  headers: (platform: string) => Record<string, string>;
  onUnauthorized: (platform: string) => void;
  score: (
    targetTitle: string,
    targetArtist: string,
    candidateTitle: string,
    candidateArtist: string
  ) => number;
}

export interface ResolverPlugin {
  id: string;
  label: string;
  /** 兼容旧别名（wy/tx/kg/kw）。 */
  aliases?: string[];
  /** 该插件是否处理这个输入（未指定 source 时视为全部可处理）。 */
  canHandle(input: ResolverInput): boolean;
  resolve(input: ResolverInput, ctx: ResolverPluginContext): Promise<ResolvedAudioSource | null>;
}

export interface PluginDispatchStats {
  attempts: number;
  hits: number;
  misses: number;
  errors: number;
  lastError?: string;
}

export interface ResolverPluginMetrics {
  plugins: ({ id: string; label: string; aliases: string[] } & PluginDispatchStats)[];
  unknownSourceRequests: number;
  http: HttpMetricsSnapshot;
  circuits: HostCircuitSnapshot[];
}

function emptyStats(): PluginDispatchStats {
  return { attempts: 0, hits: 0, misses: 0, errors: 0 };
}

/** 插件注册表：按 id/别名查表，统一计数与异常兜底（插件抛错不影响竞速）。 */
export class ResolverRegistry {
  private readonly plugins = new Map<string, ResolverPlugin>();
  private readonly aliasToId = new Map<string, string>();
  private readonly stats = new Map<string, PluginDispatchStats>();
  private unknownSourceRequests = 0;

  register(plugin: ResolverPlugin): void {
    if (this.plugins.has(plugin.id)) return;
    this.plugins.set(plugin.id, plugin);
    this.stats.set(plugin.id, emptyStats());
    for (const alias of plugin.aliases ?? []) {
      this.aliasToId.set(alias.toLowerCase(), plugin.id);
    }
  }

  get(source: string | undefined): ResolverPlugin | undefined {
    if (!source) return undefined;
    const key = source.toLowerCase();
    return this.plugins.get(key) ?? this.plugins.get(this.aliasToId.get(key) ?? "");
  }

  list(): ResolverPlugin[] {
    return [...this.plugins.values()];
  }

  canHandle(source: string | undefined, input: ResolverInput): boolean {
    const plugin = this.get(source);
    return plugin ? plugin.canHandle({ ...input, source: source ?? input.source }) : false;
  }

  /** 未知 source / canHandle=false 一律返回 null（不抛错），并计入指标。 */
  async resolve(
    source: string | undefined,
    input: ResolverInput,
    ctx: ResolverPluginContext
  ): Promise<ResolvedAudioSource | null> {
    const plugin = this.get(source);
    if (!plugin) {
      this.unknownSourceRequests += 1;
      return null;
    }
    const scoped: ResolverInput = { ...input, source: source ?? input.source };
    if (!plugin.canHandle(scoped)) return null;

    const stats = this.stats.get(plugin.id) ?? emptyStats();
    stats.attempts += 1;
    try {
      const result = await plugin.resolve(scoped, ctx);
      if (result?.url) stats.hits += 1;
      else stats.misses += 1;
      return result;
    } catch (error) {
      stats.errors += 1;
      stats.lastError = error instanceof Error ? error.message : String(error);
      return null;
    } finally {
      this.stats.set(plugin.id, stats);
    }
  }

  metrics(): ResolverPluginMetrics {
    return {
      plugins: this.list().map((plugin) => ({
        id: plugin.id,
        label: plugin.label,
        aliases: plugin.aliases ?? [],
        ...(this.stats.get(plugin.id) ?? emptyStats()),
      })),
      unknownSourceRequests: this.unknownSourceRequests,
      http: getHttpMetrics(),
      circuits: getHostCircuitStates(),
    };
  }

  resetStats(): void {
    for (const plugin of this.plugins.keys()) this.stats.set(plugin, emptyStats());
    this.unknownSourceRequests = 0;
  }

  clear(): void {
    this.plugins.clear();
    this.aliasToId.clear();
    this.stats.clear();
    this.unknownSourceRequests = 0;
  }
}

/** 进程内唯一注册表；平台插件由 MultiSourceResolver 在模块初始化时注册。 */
export const resolverRegistry = new ResolverRegistry();
