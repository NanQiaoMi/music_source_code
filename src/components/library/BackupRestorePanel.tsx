"use client";

import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Database, Download, Trash2, Upload, X } from "lucide-react";
import {
  BackupItem,
  BackupPreview,
  BackupSchedule,
  BackupType,
  useBackupRestoreStore,
} from "@/store/backupRestoreStore";

interface BackupRestorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ITEMS = [
  { id: "backup", name: "立即备份", icon: "Backup" },
  { id: "history", name: "备份历史", icon: "History" },
  { id: "schedule", name: "定时备份", icon: "Schedule" },
  { id: "restore", name: "恢复数据", icon: "Restore" },
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
    restoreError,
    schedules,
    createBackup,
    downloadBackup,
    deleteBackup,
    restoreBackup,
    uploadBackup,
    addSchedule,
    getBackupPreview,
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
        className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">数据备份与恢复</h2>
              <p className="text-sm text-white/60">备份、恢复和定时保护本地播放数据</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "border-b-2 border-emerald-500 bg-white/5 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <span className="sr-only">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] min-h-0 overflow-y-auto p-6 custom-scrollbar">
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
              getBackupPreview={getBackupPreview}
              restoreError={restoreError}
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
  onCreateBackup: (type: BackupType, name?: string, description?: string) => Promise<BackupItem>;
}) {
  const backupTypes = [
    { id: "full" as BackupType, name: "完整备份", desc: "所有数据、配置、歌单和歌词" },
    { id: "settings" as BackupType, name: "仅设置", desc: "界面、播放、可视化等偏好" },
    { id: "playlists" as BackupType, name: "仅歌单", desc: "歌单、队列和推荐状态" },
    { id: "library" as BackupType, name: "仅音乐库", desc: "音乐库索引和元数据" },
    { id: "lyrics" as BackupType, name: "仅歌词", desc: "歌词与封面相关数据" },
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
      <div className="py-6 text-center">
        <h3 className="mb-2 text-xl font-semibold text-white">选择备份类型</h3>
        <p className="text-white/60">备份保存在浏览器本地，可下载为 JSON 文件长期保存</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {backupTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleCreateBackup(type.id)}
            disabled={isBackingUp}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="mb-1 font-semibold text-white">{type.name}</div>
            <div className="text-sm text-white/60">{type.desc}</div>
          </button>
        ))}
      </div>

      {isBackingUp && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold text-emerald-300">正在备份...</div>
            <div className="text-emerald-300">{backupProgress}%</div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
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
  backups: BackupItem[];
  onDownload: (backupId: string) => void;
  onDelete: (backupId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {backups.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
            <Clock className="h-10 w-10 text-white/40" />
          </div>
          <h3 className="mb-2 font-semibold text-white">暂无备份</h3>
          <p className="text-white/60">创建备份后会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map((backup) => (
            <div key={backup.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-white">{backup.name}</div>
                  <div className="text-sm text-white/60">
                    {new Date(backup.createdAt).toLocaleString("zh-CN")} - {backup.type}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDownload(backup.id)}
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4" />
                    下载
                  </button>
                  <button
                    onClick={() => onDelete(backup.id)}
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/30"
                  >
                    <Trash2 className="h-4 w-4" />
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
  schedules: BackupSchedule[];
  onAddSchedule: (schedule: Omit<BackupSchedule, "id">) => void;
}) {
  const scheduleOptions = [
    { id: "daily" as const, name: "每日", desc: "每天自动创建一份完整备份" },
    { id: "weekly" as const, name: "每周", desc: "每周自动创建一份完整备份" },
    { id: "monthly" as const, name: "每月", desc: "每月自动创建一份完整备份" },
  ];

  return (
    <div className="space-y-6">
      <div className="py-6 text-center">
        <h3 className="mb-2 text-xl font-semibold text-white">定时备份设置</h3>
        <p className="text-white/60">选择一个频率后，系统会按配置保留最近的备份</p>
      </div>

      <div className="space-y-3">
        {scheduleOptions.map((option) => (
          <button
            key={option.id}
            onClick={() =>
              onAddSchedule({
                enabled: true,
                frequency: option.id,
                time: "02:00",
                maxBackups: 10,
                backupType: "full",
              })
            }
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all duration-200 hover:bg-white/10"
          >
            <div className="mb-1 font-semibold text-white">{option.name}</div>
            <div className="text-sm text-white/60">{option.desc}</div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 font-medium text-white/80">已配置的定时任务</div>
        {schedules.length === 0 ? (
          <p className="text-sm text-white/40">暂无定时任务</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="text-sm text-white/60">
                {schedule.frequency} - {schedule.enabled ? "已启用" : "已停用"}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 font-medium text-white/80">备份说明</div>
        <ul className="space-y-2 text-sm text-white/40">
          <li>自动备份会保存在浏览器本地。</li>
          <li>建议定期下载关键备份到本地文件。</li>
          <li>可以随时在备份历史中下载或删除备份。</li>
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
  getBackupPreview,
  restoreError,
}: {
  isRestoring: boolean;
  restoreProgress: number;
  backups: BackupItem[];
  onRestore: (backupId: string) => Promise<void>;
  onUploadBackup: (file: File) => Promise<BackupItem>;
  getBackupPreview: (backupId: string) => BackupPreview | null;
  restoreError: string | null;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const selectedPreview = selectedBackupId ? getBackupPreview(selectedBackupId) : null;

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".json")) {
        void onUploadBackup(file);
      }
    },
    [onUploadBackup]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void onUploadBackup(file);
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
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-white/20 bg-white/5"
        }`}
      >
        <Upload className="mx-auto mb-4 h-12 w-12 text-white/40" />
        <h3 className="mb-2 font-semibold text-white">上传备份文件恢复</h3>
        <p className="mb-4 text-sm text-white/60">拖拽或点击选择 .json 备份文件</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={isRestoring}
        />
        <span className="inline-flex rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white">
          选择文件
        </span>
      </div>

      {backups.length > 0 && (
        <div className="space-y-4">
          <div className="font-medium text-white/80">或从历史备份恢复</div>
          <div className="space-y-3">
            {backups.slice(0, 5).map((backup) => (
              <button
                key={backup.id}
                onClick={() => setSelectedBackupId(backup.id)}
                disabled={isRestoring}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all duration-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{backup.name}</div>
                    <div className="text-sm text-white/60">
                      {new Date(backup.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-300">
                    预览
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedPreview && selectedBackupId && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">恢复预览</div>
              <div className="text-sm text-white/60">
                Schema {selectedPreview.schemaVersion} - {selectedPreview.includedStores.length}{" "}
                stores
              </div>
            </div>
            <button
              onClick={() => void handleRestore(selectedBackupId)}
              disabled={isRestoring || !selectedPreview.canRestore}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-emerald-200 disabled:opacity-40"
            >
              确认恢复
            </button>
          </div>
          {!selectedPreview.canRestore && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-200">
              {selectedPreview.error}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {selectedPreview.includedStores.map((storeName) => (
              <span
                key={storeName}
                className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white/60"
              >
                {storeName}
              </span>
            ))}
          </div>
        </div>
      )}

      {restoreError && (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/15 p-4 text-sm text-red-200">
          {restoreError}
        </div>
      )}

      {isRestoring && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold text-emerald-300">正在恢复...</div>
            <div className="text-emerald-300">{restoreProgress}%</div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
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
