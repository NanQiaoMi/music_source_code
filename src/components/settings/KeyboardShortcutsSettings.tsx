"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { useKeyboardShortcutsStore, ShortcutBinding } from "@/store/keyboardShortcutsStore";
import { GlassPanel } from "@/components/shared/Glass";
import { GlassButton } from "@/components/shared/GlassButton";

interface KeyboardShortcutsSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsSettings: React.FC<KeyboardShortcutsSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const { defaults, overrides, setBinding, resetBinding, resetAll, getBinding } =
    useKeyboardShortcutsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string>("");
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);

  const categories = Array.from(new Set(defaults.map((d) => d.category)));

  useEffect(() => {
    if (!recordingId) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const mods: string[] = [];
      if (e.ctrlKey || e.metaKey) mods.push("Ctrl");
      if (e.shiftKey) mods.push("Shift");
      if (e.altKey) mods.push("Alt");
      const key = e.key === " " ? "Space" : e.key;
      const keys = mods.length > 0 ? [...mods, key] : [key];
      setPendingKeys(keys);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId]);

  const handleStartRecord = (id: string) => {
    setRecordingId(id);
    setPendingKeys([]);
    setConflictMsg("");
  };

  const handleConfirm = useCallback(() => {
    if (!recordingId || pendingKeys.length === 0) return;
    const result = setBinding(recordingId, pendingKeys);
    if (!result.success) {
      setConflictMsg("与以下快捷键冲突: " + result.conflicts.join(", "));
    }
    setRecordingId(null);
    setPendingKeys([]);
  }, [recordingId, pendingKeys, setBinding]);

  const handleCancel = () => {
    setRecordingId(null);
    setPendingKeys([]);
    setConflictMsg("");
  };

  const isDefault = (id: string) => !overrides.some((o) => o.id === id);

  const formatKeys = (keys: string[]) => keys.join(" + ");

  return (
    <GlassPanel
      position="right"
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="快捷键设置"
      headerRight={
        <button
          onClick={resetAll}
          className="text-white/60 hover:text-white text-[13px] px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
        >
          重置全部
        </button>
      }
    >
      <div className="p-3 space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-white/50 text-xs font-medium uppercase tracking-wider px-2 mb-2">
              {category}
            </h3>
            <div className="space-y-1">
              {defaults
                .filter((d) => d.category === category)
                .map((binding) => {
                  const currentKeys = getBinding(binding.id);
                  const isRecording = recordingId === binding.id;
                  return (
                    <div
                      key={binding.id}
                      className="flex items-center justify-between py-2 px-3 bg-white/[0.03] rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-white/80 text-sm">{binding.label}</span>
                        <p className="text-white/30 text-[11px]">{binding.description}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {isRecording ? (
                          <div className="flex items-center gap-2">
                            <kbd className="px-2.5 py-1 bg-white/20 rounded-lg text-white text-xs font-mono min-w-[60px] text-center">
                              {pendingKeys.length > 0 ? formatKeys(pendingKeys) : "..."}
                            </kbd>
                            {pendingKeys.length > 0 && (
                              <>
                                <GlassButton size="sm" variant="primary" onClick={handleConfirm}>
                                  确认
                                </GlassButton>
                                <GlassButton size="sm" variant="ghost" onClick={handleCancel}>
                                  取消
                                </GlassButton>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            <kbd
                              className={`
                                px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer
                                transition-colors
                                ${isDefault(binding.id)
                                  ? "bg-white/10 text-white/70"
                                  : "bg-white/20 text-white"
                                }
                                hover:bg-white/20
                              `}
                              onClick={() => handleStartRecord(binding.id)}
                              title="点击修改快捷键"
                            >
                              {formatKeys(currentKeys)}
                            </kbd>
                            {!isDefault(binding.id) && (
                              <button
                                onClick={() => resetBinding(binding.id)}
                                className="text-white/30 hover:text-white/60 text-[11px] transition-colors"
                              >
                                重置
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {conflictMsg && (
          <div className="mx-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-xs">{conflictMsg}</p>
          </div>
        )}
      </div>
    </GlassPanel>
  );
};