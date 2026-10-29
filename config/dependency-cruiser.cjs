/**
 * dependency-cruiser 分层门禁（S6-12a）
 *
 * 目标：把"谁能依赖谁"固化成 CI 可执行的规则，而不是只写在架构文档里。
 * 运行：npm run verify:layers（= depcruise src --config config/dependency-cruiser.cjs --output-type err）
 *
 * 分层意图：components / hooks 位于上层，可以依赖 store / services / domain / lib / types；
 * 状态与服务层（store / services / lib / domain）不得反向依赖 components / hooks。
 * domain 额外不得直连 store（唯一例外 ports.ts，见规则注释）。所有豁免都写成
 * "当前架构的棘轮"：后续重构只允许收紧，不允许扩大。
 *
 * 测试文件（*.test.* / *.spec.* / src/test/**）不参与分层与 devDependency 规则：
 * 测试本来就需要直接触达被 mock 的实现，且 vitest 等 devDependency 只在测试期使用。
 *
 * 口径：未开启 tsPreCompilationDeps —— 与 S6-11c 的 store 图脚本一致，import type
 * 不构成运行时边，因此不参与 no-circular / 方向规则；也让仅被 type import 的
 * types 文件出现在 no-orphans（warn）里，属于已知噪声，不阻塞 CI。
 * 豁免一律用 pathNot 精确到文件/目录，禁止整层排除；新增豁免必须在本文件写明原因。
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "禁止循环依赖（生产模块）。环会让模块初始化顺序变成隐式契约，" +
        "在 Next.js/Webpack 分包下还会把无关代码拖进同一 chunk。",
      from: { pathNot: ["\\.(test|spec)\\.[cm]?[jt]sx?$", "^src/test/"] },
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "孤立模块（没有任何 import 者，也不是路由/worker 入口）。仅告警：可能是" +
        "动态加载或待删遗留，先暴露再逐个清理，不阻塞 CI。",
      from: {
        orphan: true,
        pathNot: [
          "\\.(test|spec)\\.[cm]?[jt]sx?$",
          "\\.d\\.ts$",
          "^src/app/", // Next.js 路由/页面是框架入口
          "^src/workers/", // new Worker(new URL(...)) 动态入口
          "^src/test/",
        ],
      },
      to: {},
    },
    {
      name: "store-must-not-import-ui",
      severity: "error",
      comment:
        "store 是状态层，禁止 import components/hooks。UI 反馈必须走 store action " +
        "（如 @/store/actions/uiActions）或由组件层订阅，否则 store 与 React 渲染树互相绑定。",
      from: { path: "^src/store/", pathNot: "\\.(test|spec)\\.[cm]?[jt]sx?$" },
      to: { path: "^src/(components|hooks)/" },
    },
    {
      name: "services-must-not-import-components",
      severity: "error",
      comment: "services 是领域/IO 层，禁止 import React 组件；展示逻辑留在 components。",
      from: { path: "^src/services/", pathNot: "\\.(test|spec)\\.[cm]?[jt]sx?$" },
      to: { path: "^src/components/" },
    },
    {
      name: "lib-must-not-import-ui",
      severity: "error",
      comment:
        "lib 是框架无关的基础设施层，禁止 import components/hooks（React 绑定只允许出现在 " +
        "hooks/components 层）。音频上下文访问器已下沉到 src/lib/audio/audioEngineAccess.ts。",
      from: { path: "^src/lib/", pathNot: "\\.(test|spec)\\.[cm]?[jt]sx?$" },
      to: { path: "^src/(components|hooks)/" },
    },
    {
      name: "domain-must-not-import-ui",
      severity: "error",
      comment:
        "domain 是用例层，必须与 React 解耦：禁止 import react/react-dom/next 与 " +
        "components/hooks（domain 只依赖 types 与注入的 ports）。",
      from: { path: "^src/domain/", pathNot: "\\.(test|spec)\\.[cm]?[jt]sx?$" },
      to: { path: ["^react(-dom)?$", "^next(/|$)", "^src/(components|hooks)/"] },
    },
    {
      name: "domain-must-not-import-store",
      severity: "error",
      comment:
        "domain 不得直接 import store。例外：src/domain/playback/ports.ts 是当前唯一" +
        "获准把播放命令映射到 audioStore/playerStore/queueStore/playbackRuntimeStore 的" +
        "适配器（见该文件头注释）；其余 domain 模块只能通过 ports 接口间接依赖 store。" +
        "棘轮：新增 domain 模块不得再开 store 直连。",
      from: {
        path: "^src/domain/",
        pathNot: ["playback/ports\\.ts$", "\\.(test|spec)\\.[cm]?[jt]sx?$"],
      },
      to: { path: "^src/store/" },
    },
    {
      name: "no-dev-dependencies-in-src",
      severity: "error",
      comment:
        "src 生产代码不得 import devDependency（vitest/test-library 等只在测试期存在，" +
        "打进运行时会导致构建或生产环境缺包）。测试文件与 src/test 不在此规则范围内。",
      from: {
        path: "^src/",
        pathNot: ["\\.(test|spec)\\.[cm]?[jt]sx?$", "^src/test/"],
      },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "node_modules|^\\.next|^coverage|^scratch|^archive" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/[^/]+" },
    },
  },
};
