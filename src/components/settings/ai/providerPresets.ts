import { ProviderPreset } from "./types";

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek 深度求索",
    category: "domestic",
    description: "顶尖推理与代码旗舰，极高性价比与思维链解析",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    recommendedModels: ["deepseek-chat", "deepseek-reasoner"],
    tags: ["深度思考", "高性价比", "国产之光"],
    docUrl: "https://platform.deepseek.com",
    accentColor: "#0066ff",
  },
  {
    id: "sensenova",
    name: "SenseNova 商汤日日新",
    category: "domestic",
    description: "商汤旗舰大模型体系，支持超长上下文与多模态感知",
    baseUrl: "https://api.sensenova.cn/v1",
    defaultModel: "SenseChat-5",
    recommendedModels: ["SenseChat-5", "SenseChat-5-Cantonese", "SenseChat-Vision"],
    tags: ["长文本", "商汤科技", "多模态"],
    docUrl: "https://platform.sensenova.cn",
    accentColor: "#00b96b",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow 硅基流动",
    category: "domestic",
    description: "国内顶级高性能开源大模型聚合托管服务，开箱即用",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    recommendedModels: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
    ],
    tags: ["极速推理", "模型聚合", "开箱即用"],
    docUrl: "https://siliconflow.cn",
    accentColor: "#7c3aed",
  },
  {
    id: "qwen",
    name: "Qwen 通义千问",
    category: "domestic",
    description: "阿里巴巴通义大模型，综合中文理解与创意写作顶级",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-max-latest",
    recommendedModels: ["qwen-max-latest", "qwen-plus", "qwen-turbo"],
    tags: ["阿里达摩院", "综合实力", "百万长文"],
    docUrl: "https://help.aliyun.com/zh/dashscope",
    accentColor: "#ff6a00",
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi 月之暗面",
    category: "domestic",
    description: "长文本与超长上下文无损记忆领域标杆",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    recommendedModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    tags: ["超长上下文", "Kimi", "无损记忆"],
    docUrl: "https://platform.moonshot.cn",
    accentColor: "#10a37f",
  },
  {
    id: "zhipu",
    name: "Zhipu GLM 智谱清言",
    category: "domestic",
    description: "智谱 AI 旗舰模型，清华 KEG 团队自研基座",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-plus",
    recommendedModels: ["glm-4-plus", "glm-4-air", "glm-4-flash"],
    tags: ["清华系", "高并发", "GLM4"],
    docUrl: "https://open.bigmodel.cn",
    accentColor: "#2563eb",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "global",
    description: "全球顶级大语言模型先驱，通用推理与创造力巅峰",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    recommendedModels: ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1-preview", "gpt-4-turbo"],
    tags: ["行业标杆", "GPT-4o", "旗舰推理"],
    docUrl: "https://platform.openai.com",
    accentColor: "#10a37f",
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    category: "global",
    description: "极具人文温度与超强逻辑/代码分析能力的 Claude 系列",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    recommendedModels: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    tags: ["人文艺术", "Sonnet 3.5", "代码天花板"],
    docUrl: "https://docs.anthropic.com",
    accentColor: "#d97706",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "global",
    description: "Google 原生多模态模型，极速响应与超长上下文窗口",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    recommendedModels: [
      "gemini-2.0-flash",
      "gemini-2.0-pro-exp-02-05",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
    tags: ["Google AI", "极速推理", "多模态"],
    docUrl: "https://ai.google.dev",
    accentColor: "#4285f4",
  },
  {
    id: "groq",
    name: "Groq LPU",
    category: "global",
    description: "LPU 专用硬件驱动的超光速推理引擎，数百 tokens/s",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    recommendedModels: [
      "llama-3.3-70b-versatile",
      "deepseek-r1-distill-llama-70b",
      "mixtral-8x7b-32768",
    ],
    tags: ["超光速", "LPU芯片", "极速生成"],
    docUrl: "https://console.groq.com",
    accentColor: "#f97316",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "global",
    description: "聚合全球数百种主流模型的统一 API 路由网关",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-r1",
    recommendedModels: [
      "deepseek/deepseek-r1",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-3.3-70b-instruct",
      "openai/gpt-4o",
    ],
    tags: ["全球聚合", "智能路由", "降级保护"],
    docUrl: "https://openrouter.ai",
    accentColor: "#6366f1",
  },
  {
    id: "ollama",
    name: "Ollama 本地运行",
    category: "local",
    description: "本地私有运行开源大模型首选神器，数据 100% 隐私",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2:latest",
    recommendedModels: ["llama3.2:latest", "deepseek-r1:7b", "qwen2.5:7b", "mistral:latest"],
    tags: ["本地私有", "零数据上传", "离线运行"],
    docUrl: "https://ollama.com",
    accentColor: "#ffffff",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    category: "local",
    description: "优雅的本地大模型可视化工作站与本地 API 服务器",
    baseUrl: "http://localhost:1234/v1",
    defaultModel: "local-model",
    recommendedModels: ["local-model"],
    tags: ["本地 GUI", "GGUF", "硬件加速"],
    docUrl: "https://lmstudio.ai",
    accentColor: "#38bdf8",
  },
  {
    id: "custom",
    name: "自定义 OpenAI 兼容端点",
    category: "custom",
    description: "连接任何自建、反向代理或兼容 OpenAI 协议的第三方 API",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    recommendedModels: ["gpt-4o", "deepseek-chat"],
    tags: ["通用兼容", "私有中转", "自由定制"],
    accentColor: "#a855f7",
  },
];

export function findPresetById(providerId?: string): ProviderPreset | undefined {
  if (!providerId) return undefined;
  return PROVIDER_PRESETS.find((p) => p.id === providerId);
}

export function detectProviderFromUrl(url: string): ProviderPreset {
  const lower = url.toLowerCase();
  if (lower.includes("deepseek")) return PROVIDER_PRESETS[0];
  if (lower.includes("sensenova")) return PROVIDER_PRESETS[1];
  if (lower.includes("siliconflow")) return PROVIDER_PRESETS[2];
  if (lower.includes("dashscope") || lower.includes("aliyuncs") || lower.includes("qwen"))
    return PROVIDER_PRESETS[3];
  if (lower.includes("moonshot") || lower.includes("kimi")) return PROVIDER_PRESETS[4];
  if (lower.includes("bigmodel") || lower.includes("zhipu")) return PROVIDER_PRESETS[5];
  if (lower.includes("openai.com")) return PROVIDER_PRESETS[6];
  if (lower.includes("anthropic.com") || lower.includes("claude")) return PROVIDER_PRESETS[7];
  if (lower.includes("googleapis.com") || lower.includes("gemini")) return PROVIDER_PRESETS[8];
  if (lower.includes("groq.com")) return PROVIDER_PRESETS[9];
  if (lower.includes("openrouter.ai")) return PROVIDER_PRESETS[10];
  if (lower.includes("11434") || lower.includes("ollama")) return PROVIDER_PRESETS[11];
  if (lower.includes("1234") || lower.includes("lmstudio")) return PROVIDER_PRESETS[12];
  return PROVIDER_PRESETS[13]; // Custom
}
