const fs = require('fs');
const path = require('path');

// Files to fix with their specific changes
const fixes = {
  'src/components/lyrics/FullscreenLyrics.tsx': [
    { find: 'import React, { useEffect, useRef, useCallback, useState, memo } from "react";', replace: 'import React, { useEffect, useRef, useCallback, useState } from "react";' },
    { find: 'const getAnimationVariants = (', replace: 'const _getAnimationVariants = (' },
    { find: 'const scaleIntensity = 1 + 0.08 * intensity;', replace: 'const _scaleIntensity = 1 + 0.08 * intensity;' },
    { find: 'const isPlaying = useAudioStore((state) => state.isPlaying);', replace: 'const _isPlaying = useAudioStore((state) => state.isPlaying);' },
    { find: 'const { audioElement } = useAudioPlayer();', replace: 'const { audioElement: _audioElement } = useAudioPlayer();' },
    { find: '    lineHeight,', replace: '    lineHeight: _lineHeight,' },
    { find: '    animationType,', replace: '    animationType: _animationType,' },
    { find: '    animationSpeed,', replace: '    animationSpeed: _animationSpeed,' },
    { find: '    animationIntensity,', replace: '    animationIntensity: _animationIntensity,' },
    { find: 'const isPast = idx < currentIndex;', replace: 'const _isPast = idx < currentIndex;' }
  ],
  'src/components/visualization-v8/VisualizationViewV8.tsx': [
    { find: 'import React, { useEffect, useRef, useState, memo } from "react";', replace: 'import React, { useEffect, useRef, useState } from "react";' },
    { find: 'import { motion, AnimatePresence } from "framer-motion";', replace: 'import { motion } from "framer-motion";' },
    { find: 'const currentSong = useAudioStore((state) => state.currentSong);', replace: 'const _currentSong = useAudioStore((state) => state.currentSong);' },
    { find: 'const bufferedRanges = useAudioStore((state) => state.bufferedRanges);', replace: 'const _bufferedRanges = useAudioStore((state) => state.bufferedRanges);' },
    { find: 'const setIsPlaying = useAudioStore((state) => state.setIsPlaying);', replace: 'const _setIsPlaying = useAudioStore((state) => state.setIsPlaying);' },
    { find: 'const prevSong = useQueueStore((state) => state.prevSong);', replace: 'const _prevSong = useQueueStore((state) => state.prevSong);' },
    { find: 'const nextSong = useQueueStore((state) => state.nextSong);', replace: 'const _nextSong = useQueueStore((state) => state.nextSong);' },
    { find: 'const currentTheme = useUIStore((state) => state.currentTheme);', replace: 'const _currentTheme = useUIStore((state) => state.currentTheme);' },
    { find: 'const seek = useAudioStore((state) => state.seekTo);', replace: 'const _seek = useAudioStore((state) => state.seekTo);' }
  ],
  'src/components/settings/AISettingsPanel.tsx': [
    { find: 'import React, { useState, useEffect } from "react";', replace: 'import React, { useState } from "react";' },
    { find: '  Settings,', replace: '' },
    { find: '  CheckCircle,', replace: '' },
    { find: '  AlertCircle,', replace: '' },
    { find: '  Cpu,', replace: '' },
    { find: 'import { useAIStore, AIConfig } from "@/store/aiStore";', replace: 'import { useAIStore } from "@/store/aiStore";' },
    { find: 'import { GlassButton } from "@/components/shared/GlassButton";', replace: '' },
    { find: 'const [isFetchingModels, setIsFetchingModels] = useState(false);', replace: 'const [_isFetchingModels, setIsFetchingModels] = useState(false);' }
  ],
  'src/components/library/BatchMetadataEditor.tsx': [
    { find: '  RegexPreset,', replace: '' },
    { find: '  X,', replace: '' },
    { find: '  Wand2,', replace: '' },
    { find: '    selectedSongs,', replace: '' },
    { find: '    previewMode,', replace: '' },
    { find: '    setPreviewMode,', replace: '' },
    { find: 'const [regexPattern, setRegexPattern] = useState("");', replace: 'const [regexPattern, _setRegexPattern] = useState("");' },
    { find: 'const handleApplyRegex = () => {', replace: 'const _handleApplyRegex = () => {' }
  ],
  'src/components/library/LibraryManagerPanel.tsx': [
    { find: 'FileScan, Settings, BarChart3,', replace: '' },
    { find: 'import { Song } from "@/types/song";', replace: '' },
    { find: '  onAddRule,', replace: '' },
    { find: '  onUpdateRule,', replace: '' },
    { find: '  onSetFilters,', replace: '' }
  ],
  'src/app/data-manager/page.tsx': [
    { find: 'useCallback,', replace: '' },
    { find: 'GlassCard,', replace: '' },
    { find: '  Plus,', replace: '' },
    { find: '  ChevronDown,', replace: '' },
    { find: '  Upload,', replace: '' },
    { find: 'const duration = currentSong.duration;', replace: 'const _duration = currentSong.duration;' }
  ],
  'src/hooks/useAudioPlayer.ts': [
    { find: 'useRef,', replace: '' },
    { find: 'AudioError,', replace: '' },
    { find: 'const playStartTime =', replace: 'const _playStartTime =' },
    { find: 'const loopMode =', replace: 'const _loopMode =' },
    { find: 'const recordPlay =', replace: 'const _recordPlay =' }
  ],
  'src/components/features-v7/ProfessionalToolsPanel.tsx': [
    { find: 'FileAudio, Music,', replace: '' },
    { find: 'const currentView =', replace: 'const _currentView =' },
    { find: 'const [activeSection, setActiveSection] =', replace: 'const [_activeSection, setActiveSection] =' }
  ],
  'src/components/social/SharePanel.tsx': [
    { find: 'import { motion, AnimatePresence } from "framer-motion";', replace: 'import { motion } from "framer-motion";' },
    { find: 'import { Song } from "@/types/song";', replace: '' },
    { find: '  QrCode,', replace: '' },
    { find: 'PosterTemplate,', replace: '' },
    { find: 'setSelectedLyric', replace: '_setSelectedLyric' }
  ]
};

let totalChanges = 0;

for (const [file, changes] of Object.entries(fixes)) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanges = 0;
  
  for (const change of changes) {
    if (content.includes(change.find)) {
      content = content.replace(change.find, change.replace);
      fileChanges++;
    }
  }
  
  if (fileChanges > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${fileChanges} issues in ${file}`);
    totalChanges += fileChanges;
  }
}

console.log(`\nTotal changes: ${totalChanges}`);
