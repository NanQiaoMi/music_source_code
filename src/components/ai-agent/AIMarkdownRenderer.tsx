"use client";

import React, { useMemo } from "react";
import { Sparkles, Music2, Disc3 } from "lucide-react";

interface AIMarkdownRendererProps {
  content: string;
  className?: string;
}

// Global LRU Cache for parsed Markdown AST blocks (Max 200 entries to prevent memory leak)
const AST_CACHE_MAX_SIZE = 200;
const astBlockCache = new Map<string, React.ReactNode[]>();

/**
 * 格式化行内 Markdown（加粗、斜体、代码、书名号歌名高亮）
 */
function renderInlineContent(text: string): React.ReactNode[] {
  // 分词正则：匹配 **粗体**、`代码`、《歌名》、*斜体*
  const regex = /(\*\*.*?\*\*|`.*?`|《.*?》|\*.*?\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-white tracking-wide">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/[0.08] border border-white/[0.12] text-[12px] font-mono text-cyan-300 select-all"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("《") && part.endsWith("》") && part.length >= 2) {
      const inner = part.slice(1, -1).replace(/^\*\*|\*\*$/g, "");
      return (
        <span
          key={index}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-lg bg-white/[0.08] border border-white/[0.14] text-white font-medium text-[12.5px] shadow-[0_1px_4px_rgba(0,0,0,0.2)] text-white/95"
        >
          <Music2 className="w-3 h-3 text-white/70 shrink-0 inline" />
          <strong>{inner}</strong>
        </span>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-white/80">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

function sanitizeRawToolCalls(text: string): string {
  if (!text) return "";
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_call>/gi, "")
    .replace(/<\/tool_call>/gi, "")
    .replace(
      /<function(?:\s*=\s*|\s+name\s*=\s*["']?)[a-zA-Z0-9_-]+["']?>[\s\S]*?<\/function>/gi,
      ""
    )
    .replace(/<function[\s\S]*?<\/function>/gi, "")
    .replace(/<parameter[\s\S]*?<\/parameter>/gi, "")
    .trim();
}

function parseMarkdownBlocks(content: string): React.ReactNode[] {
  const sanitized = sanitizeRawToolCalls(content);
  if (!sanitized) return [];

  if (astBlockCache.has(sanitized)) {
    return astBlockCache.get(sanitized)!;
  }

  const rawLines = sanitized.split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. 空行
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. 水平分割线 (--- / ***)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <div key={`hr-${i}`} className="my-2.5 flex items-center gap-2">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
        </div>
      );
      i++;
      continue;
    }

    // 3. 标题 (#, ##, ###)
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="text-[13.5px] font-semibold text-white/95 mt-2.5 mb-1 flex items-center gap-1.5 tracking-tight"
        >
          <Sparkles className="w-3.5 h-3.5 text-white/70 shrink-0" />
          <span>{renderInlineContent(trimmed.slice(4))}</span>
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="text-[14.5px] font-semibold text-white mt-3 mb-1.5 flex items-center gap-1.5 tracking-tight"
        >
          <Disc3 className="w-4 h-4 text-white/80 shrink-0 animate-spin-slow" />
          <span>{renderInlineContent(trimmed.slice(3))}</span>
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="text-[15.5px] font-bold text-white mt-3.5 mb-2 tracking-tight"
        >
          {renderInlineContent(trimmed.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 4. 表格识别 (| col | col |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (
        i < rawLines.length &&
        rawLines[i].trim().startsWith("|") &&
        rawLines[i].trim().endsWith("|")
      ) {
        tableLines.push(rawLines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());

        // 过滤掉对齐行 (|---|---|)
        const bodyLines = tableLines.slice(1).filter((l) => !/^[|\s\-:]+$/.test(l));

        blocks.push(
          <div
            key={`table-${i}`}
            className="my-3 overflow-x-auto rounded-xl bg-white/[0.03] border border-white/[0.1] shadow-sm backdrop-blur-xl"
          >
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.1] bg-white/[0.05]">
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className="px-3 py-2 text-white/80 font-semibold whitespace-nowrap"
                    >
                      {renderInlineContent(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {bodyLines.map((rowStr, rIdx) => {
                  const cells = rowStr
                    .slice(1, -1)
                    .split("|")
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx} className="hover:bg-white/[0.04] transition-colors">
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-white/85 leading-relaxed">
                          {renderInlineContent(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 5. 引用块 / 提示区 (> text 或 💡 / 🎵 开头)
    if (trimmed.startsWith("> ")) {
      blocks.push(
        <div
          key={`quote-${i}`}
          className="my-2 pl-3 py-1.5 border-l-2 border-white/40 bg-white/[0.02] rounded-r-lg text-white/80 text-[13px] leading-relaxed italic"
        >
          {renderInlineContent(trimmed.slice(2))}
        </div>
      );
      i++;
      continue;
    }

    // 6. 无序列表 (- / * / •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^[-*•]\s+/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^[-*•]\s+/, ""));
        i++;
      }

      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
          {listItems.map((item, itemIdx) => (
            <li
              key={itemIdx}
              className="flex items-start gap-2 text-[13px] text-white/90 leading-relaxed"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 mt-2 shrink-0 shadow-[0_0_4px_rgba(255,255,255,0.4)]" />
              <div className="flex-1">{renderInlineContent(item)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. 有序列表 (1. 2. 3.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const orderedItems: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        orderedItems.push(rawLines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }

      blocks.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-1">
          {orderedItems.map((item, itemIdx) => (
            <li
              key={itemIdx}
              className="flex items-start gap-2 text-[13px] text-white/90 leading-relaxed"
            >
              <span className="w-4 h-4 rounded-full bg-white/[0.1] border border-white/[0.15] text-[10px] font-semibold text-white/80 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                {itemIdx + 1}
              </span>
              <div className="flex-1">{renderInlineContent(item)}</div>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. 普通段落
    blocks.push(
      <p
        key={`p-${i}`}
        className="my-1.5 text-[13.5px] leading-relaxed text-white/90 tracking-normal"
      >
        {renderInlineContent(trimmed)}
      </p>
    );
    i++;
  }

  if (astBlockCache.size >= AST_CACHE_MAX_SIZE) {
    const firstKey = astBlockCache.keys().next().value;
    if (firstKey) astBlockCache.delete(firstKey);
  }
  astBlockCache.set(content, blocks);

  return blocks;
}

/**
 * 将多行文本解析为块级元素（标题、分割线、列表、表格、引用块、段落）
 */
export const AIMarkdownRenderer: React.FC<AIMarkdownRendererProps> = React.memo(
  ({ content, className = "" }) => {
    const blocks = useMemo(() => (content ? parseMarkdownBlocks(content) : null), [content]);
    if (!blocks) return null;
    return <div className={`space-y-1 ${className}`}>{blocks}</div>;
  }
);

AIMarkdownRenderer.displayName = "AIMarkdownRenderer";
