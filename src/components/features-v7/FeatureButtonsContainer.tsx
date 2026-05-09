"use client";

import { useState, useEffect, useCallback } from "react";
import { VisualizationToggle } from "./VisualizationToggle";
import { AudioEnhancementToggle } from "./AudioEnhancementToggle";
import { ABLoopToggle } from "./ABLoopToggle";
import { ProfessionalToolsToggle } from "./ProfessionalToolsToggle";
import { DesktopLyricsToggle } from "./DesktopLyricsToggle";
import { useUIStore } from "@/store/uiStore";

interface FeatureButtonConfig {
  id: string;
  component: React.ComponentType<any>;
  defaultPosition: number;
}

interface FeatureButtonsContainerProps {
  onOpenFormatConverter?: () => void;
  onOpenTrackCutter?: () => void;
  onOpenFingerprintScanner?: () => void;
  onOpenDSDConverter?: () => void;
  onOpenCrossfadeMixer?: () => void;
  onOpenLibraryHealth?: () => void;
}

const buttons: FeatureButtonConfig[] = [
  { id: "desktopLyrics", component: DesktopLyricsToggle, defaultPosition: 28 },
  { id: "abLoop", component: ABLoopToggle, defaultPosition: 44 },
  { id: "visualization", component: VisualizationToggle, defaultPosition: 60 },
  { id: "audioEffects", component: AudioEnhancementToggle, defaultPosition: 76 },
  { id: "professionalTools", component: ProfessionalToolsToggle, defaultPosition: 92 },
];

const BUTTON_HEIGHT = 56; // w-14 h-14 = 56px
const BUTTON_SPACING = 16; // 间距
const MIN_SPACING = 8; // 最小间距

export function FeatureButtonsContainer() {
  const { currentView, openPanel } = useUIStore();
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const [buttonPositions, setButtonPositions] = useState<Record<string, number>>({});

  const calculatePositions = useCallback(() => {
    const availableHeight = windowHeight - 100; // 减去顶部和底部的余量
    const totalButtonsHeight = buttons.length * BUTTON_HEIGHT;
    const totalSpacingNeeded = (buttons.length - 1) * BUTTON_SPACING;
    const totalHeightNeeded = totalButtonsHeight + totalSpacingNeeded;

    if (totalHeightNeeded <= availableHeight) {
      const positions: Record<string, number> = {};
      let currentBottom = 28;
      buttons.forEach((button) => {
        positions[button.id] = currentBottom;
        currentBottom += BUTTON_HEIGHT + BUTTON_SPACING;
      });
      setButtonPositions(positions);
      return;
    }

    const availableSpacing = (availableHeight - totalButtonsHeight) / (buttons.length - 1);
    const actualSpacing = Math.max(MIN_SPACING, availableSpacing);

    const positions: Record<string, number> = {};
    let currentBottom = 20;
    buttons.forEach((button) => {
      positions[button.id] = currentBottom;
      currentBottom += BUTTON_HEIGHT + actualSpacing;
    });
    setButtonPositions(positions);
  }, [windowHeight]);

  useEffect(() => {
    calculatePositions();
  }, [calculatePositions]);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const visibleButtons = buttons.filter((button) => {
    if (button.id === "desktopLyrics") {
      return currentView === "player" || currentView === "home";
    }
    if (button.id === "abLoop") {
      return currentView === "player" || currentView === "visualization";
    }
    if (button.id === "visualization") {
      return currentView === "player";
    }
    if (button.id === "audioEffects") {
      return currentView === "player";
    }
    if (button.id === "professionalTools") {
      return currentView === "player" || currentView === "home";
    }
    return true;
  });

  return (
    <>
      {visibleButtons.map((button) => {
        const ButtonComponent = button.component;
        const position = buttonPositions[button.id] ?? button.defaultPosition;

        let componentProps = {};
        if (button.id === "professionalTools") {
          componentProps = {
            onOpenFormatConverter: () => openPanel("formatConverter"),
            onOpenTrackCutter: () => openPanel("trackCutter"),
            onOpenFingerprintScanner: () => openPanel("fingerprintScanner"),
            onOpenDSDConverter: () => openPanel("dsdConverter"),
            onOpenCrossfadeMixer: () => openPanel("crossfadeMixer"),
            onOpenLibraryHealth: () => openPanel("libraryHealth"),
          };
        }

        return (
          <div
            key={button.id}
            style={{
              position: "fixed",
              right: "32px",
              bottom: `${position}px`,
              zIndex: 50,
              transition: "bottom 0.3s ease-out",
            }}
          >
            <ButtonComponent {...componentProps} />
          </div>
        );
      })}
    </>
  );
}
