"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Database, Download, Upload, Trash2, Clock, Settings } from "lucide-react";
import { useBackupRestoreStore, BackupType } from "@/store/backupRestoreStore";

interface BackupRestorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "backup", name: "立即备份", icon: "💾" },
  { id: "history", name: "备份历史", icon: "📜" },
  { id: "schedule", name: "定时备份", icon: "⏰" },
  { id: "restore", name: "恢复数据", icon: "🔄" },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

export const BackupRestorePanel: React.FC<BackupRestorePanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>("backup");

  const {
    backups,
    isBackingUp,
    backupProgress,
    isRestoring,
    restoreProgress,
    schedules,
    createBackup,
    downloadBackup,
    deleteBackup,
    restoreBackup,
    uploadBackup,
    addSchedule,
  } = useBackupRestoreStore();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white text-2xl font-semibold">数据备份与恢复</h2>
              <p className="text-white/60 text-sm">备份、恢复、定时备份管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-emerald-500 bg-white/5"
                  : "text-white/60 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
          {activeTab === "backup" && (
            <BackupTab
              isBackingUp={isBackingUp}
              backupProgress={backupProgress}
              onCreateBackup={createBackup}
            />
          )}

          {activeTab === "history" && (
            <BackupHistoryTab
              backups={backups}
              onDownload={downloadBackup}
              onDelete={deleteBackup}
            />
          )}

          {activeTab === "schedule" && (
            <ScheduleTab schedules={schedules} onAddSchedule={addSchedule} />
          )}

          {activeTab === "restore" && (
            <RestoreTab
              isRestoring={isRestoring}
              restoreProgress={restoreProgress}
              backups={backups}
              onRestore={restoreBackup}
              onUploadBackup={uploadBackup}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

function BackupTab({
  isBackingUp,
  backupProgress,
  onCreateBackup,
}: {
  isBackingUp: boolean;
  backupProgress: number;
  onCreateBackup: (type: BackupType, name?: string, description?: string) => Promise<any>;
}) {
  const BACKUP_TYPES = [
    { id: "full" as BackupType, name: "完整备份", desc: "所有数据和配置", icon: "📦" },
    { id: "settings" as BackupType, name: "仅设置", desc: "界面配置和偏好", icon: "⚙️" },
    { id: "playlists" as BackupType, name: "仅歌单", desc: "歌单和播放历史", icon: "🎵" },
    { id: "library" as BackupType, name: "仅音乐库", desc: "音乐库元数据", icon: "💿" },
    { id: "lyrics" as BackupType, name: "仅歌词", desc: "歌词和封面", icon: "📝" },
  ];

  const handleCreateBackup = async (type: BackupType) => {
    try {
      await onCreateBackup(type);
    } catch (error) {
      console.error("Backup failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <h3 className="text-white text-xl font-semibold mb-2">选择备份类型</h3>
        <p className="text-white/60">备份数据保存到本地，不会上传到任何服务器</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {BACKUP_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleCreateBackup(type.id)}
            disabled={isBackingUp}
            className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-3xl mb-2">{type.icon}</div>
            <div className="text-white font-semibold mb-1">{type.name}</div>
            <div className="text-white/60 text-sm">{type.desc}</div>
          </button>
        ))}
      </div>

      {isBackingUp && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="text-emerald-300 font-semibold">正在备份...</div>
            <div className="text-emerald-300">{backupProgress}%</div>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${backupProgress}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BackupHistoryTab({
  backups,
  onDownload,
  onDelete,
}: {
  backups: any[];
  onDownload: (backupId: string) => void;
  onDelete: (backupId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {backups.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-white/5 flex items-center justify-center">
            <Clock className="w-10 h-10 text-white/40" />
          </div>
          <h3 className="text-white font-semibold mb-2">暂无备份</h3>
          <p className="text-white/60">创建备份后会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map((backup) => (
            <div key={backup.id} className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">{backup.name}</div>
                  <div className="text-white/60 text-sm">
                    {new Date(backup.createdAt).toLocaleString("zh-CN")} · {backup.type}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDownload(backup.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                  <button
                    onClick={() => onDelete(backup.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleTab({
  schedules,
  onAddSchedule,
}: {
  schedules: any[];
  onAddSchedule: (schedule: any) => void;
}) {
  const SCHEDULE_OPTIONS = [
    { id: "daily", name: "每日", desc: "每天自动备份" },
    { id: "weekly", name: "每周", desc: "每周自动备份" },
    { id: "monthly", name: "每月", desc: "每月自动备份" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <h3 className="text-white text-xl font-semibold mb-2">定时备份设置</h3>
        <p className="text-white/60">设置自动备份频率</p>
      </div>

      <div className="space-y-3">
        {SCHEDULE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() =>
              onAddSchedule({
                enabled: true,
                frequency: option.id as any,
                time: "02:00",
                maxBackups: 10,
                backupType: "full" as BackupType,
              })
            }
            className="w-full p-5 rounded-2xl text-left transition-all duration-200 bg-white/5 border border-white/10 hover:bg-white/10"
          >
            <div className="text-white font-semibold mb-1">{option.name}</div>
            <div className="text-white/60 text-sm">{option.desc}</div>
          </button>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="text-white/80 font-medium mb-3">已配置的定时任务</div>
        {schedules.length === 0 ? (
          <p className="text-white/40 text-sm">暂无定时任务</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="text-white/60 text-sm">
                {schedule.frequency} - {schedule.enabled ? "已启用" : "已禁用"}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="text-white/80 font-medium mb-3">备份说明</div>
        <ul className="text-white/40 text-sm space-y-2">
          <li>• 自动备份会保存在浏览器本地</li>
          <li>• 建议定期下载备份到本地文件</li>
          <li>• 可以随时在备份历史中管理备份</li>
        </ul>
      </div>
    </div>
  );
}

function RestoreTab({
  isRestoring,
  restoreProgress,
  backups,
  onRestore,
  onUploadBackup,
}: {
  isRestoring: boolean;
  restoreProgress: number;
  backups: any[];
  onRestore: (backupId: string) => Promise<void>;
  onUploadBackup: (file: File) => Promise<any>;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".json")) {
        onUploadBackup(file);
      }
    },
    [onUploadBackup]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUploadBackup(file);
      }
    },
    [onUploadBackup]
  );

  const handleRestore = async (backupId: string) => {
    try {
      await onRestore(backupId);
    } catch (error) {
      console.error("Restore failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all duration-200 ${
          isDragging
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-white/20 bg-white/5 hover:border-white/30"
        }`}
      >
        <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
        <h3 className="text-white font-semibold mb-2">上传备份文件恢复</h3>
        <p className="text-white/60 text-sm mb-4">拖拽或点击上传 .json 备份文件</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = (event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) {
                onUploadBackup(file);
              }
            };
            input.click();
          }}
          disabled={isRestoring}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          选择文件
        </button>
      </div>

      {backups.length > 0 && (
        <div className="space-y-4">
          <div className="text-white/80 font-medium">或从历史备份恢复</div>
          <div className="space-y-3">
            {backups.slice(0, 5).map((backup) => (
              <button
                key={backup.id}
                onClick={() => handleRestore(backup.id)}
                disabled={isRestoring}
                className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">{backup.name}</div>
                    <div className="text-white/60 text-sm">
                      {new Date(backup.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm">
                    恢复
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isRestoring && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="text-emerald-300 font-semibold">正在恢复...</div>
            <div className="text-emerald-300">{restoreProgress}%</div>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${restoreProgress}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
