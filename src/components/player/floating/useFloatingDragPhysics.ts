"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type FloatingPlayerState = "pill" | "expanded" | "dock-left" | "dock-right";

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

export interface DimensionConfig {
  width: number;
  height: number;
}

export interface UseFloatingDragPhysicsOptions {
  /** Initial position coordinates */
  initialPosition?: Position;
  /** Initial player state mode */
  initialState?: FloatingPlayerState;
  /** Edge distance threshold in px to trigger magnetic dock snapping (default: 40px) */
  edgeSnapThreshold?: number;
  /** Viewport margin padding in px (default: 16px) */
  safePadding?: number;
  /** Inertia fling friction decay coefficient per frame (0 to 1, default: 0.92) */
  friction?: number;
  /** Dimension preset for pill state */
  pillDimensions?: DimensionConfig;
  /** Dimension preset for expanded state */
  expandedDimensions?: DimensionConfig;
  /** Dimension preset for docked states */
  dockDimensions?: DimensionConfig;
  /** Callback fired when state transitions */
  onStateChange?: (state: FloatingPlayerState) => void;
}

export const FLOATING_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
  restDelta: 0.5,
};

const DEFAULT_PILL_DIM: DimensionConfig = { width: 340, height: 72 };
const DEFAULT_EXPANDED_DIM: DimensionConfig = { width: 360, height: 480 };
const DEFAULT_DOCK_DIM: DimensionConfig = { width: 60, height: 72 };

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export interface UseFloatingDragPhysicsReturn {
  position: Position;
  playerState: FloatingPlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<FloatingPlayerState>>;
  isDragging: boolean;
  isAnimating: boolean;
  velocity: Velocity;
  isDocked: boolean;
  dragHandlers: DragHandlers;
  springConfig: typeof FLOATING_SPRING_CONFIG;
  restoreFromDock: (targetState?: "pill" | "expanded") => void;
  snapToDock: (side: "left" | "right") => void;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
  clampPosition: (pos: Position, state?: FloatingPlayerState) => Position;
}

/**
 * Custom hook for floating window drag dynamics with inertial fling decay,
 * edge magnetic docking (< 40px), boundary clamp protection, and resize adaptability.
 */
export function useFloatingDragPhysics(
  options: UseFloatingDragPhysicsOptions = {}
): UseFloatingDragPhysicsReturn {
  const {
    initialPosition = { x: 24, y: 300 },
    initialState = "pill",
    edgeSnapThreshold = 40,
    safePadding = 16,
    friction = 0.92,
    pillDimensions = DEFAULT_PILL_DIM,
    expandedDimensions = DEFAULT_EXPANDED_DIM,
    dockDimensions = DEFAULT_DOCK_DIM,
    onStateChange,
  } = options;

  const [playerState, setPlayerStateInternal] = useState<FloatingPlayerState>(initialState);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [velocity, setVelocity] = useState<Velocity>({ x: 0, y: 0 });

  // Refs for tracking during high-frequency gesture events
  const playerStateRef = useRef<FloatingPlayerState>(initialState);
  const positionRef = useRef<Position>(initialPosition);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>(
    { clientX: 0, clientY: 0, startX: 0, startY: 0 }
  );
  const samplesRef = useRef<PointerSample[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const prevWindowSizeRef = useRef<{ width: number; height: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  // Keep refs synchronized
  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const setPlayerState: React.Dispatch<React.SetStateAction<FloatingPlayerState>> = useCallback(
    (action) => {
      setPlayerStateInternal((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (next !== prev) {
          onStateChange?.(next);
        }
        return next;
      });
    },
    [onStateChange]
  );

  /**
   * Helper to get component dimensions for a given state
   */
  const getDimensionsForState = useCallback(
    (state: FloatingPlayerState): DimensionConfig => {
      switch (state) {
        case "expanded":
          return expandedDimensions;
        case "dock-left":
        case "dock-right":
          return dockDimensions;
        case "pill":
        default:
          return pillDimensions;
      }
    },
    [dockDimensions, expandedDimensions, pillDimensions]
  );

  /**
   * Safe boundary clamping calculation
   */
  const clampPosition = useCallback(
    (pos: Position, state: FloatingPlayerState = playerStateRef.current): Position => {
      if (typeof window === "undefined") return pos;

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const dim = getDimensionsForState(state);

      if (state === "dock-left") {
        return {
          x: 0,
          y: Math.max(safePadding, Math.min(pos.y, winHeight - dim.height - safePadding)),
        };
      }

      if (state === "dock-right") {
        return {
          x: Math.max(0, winWidth - dim.width),
          y: Math.max(safePadding, Math.min(pos.y, winHeight - dim.height - safePadding)),
        };
      }

      // Pill / Expanded modes
      const minX = safePadding;
      const maxX = Math.max(minX, winWidth - dim.width - safePadding);
      const minY = safePadding;
      const maxY = Math.max(minY, winHeight - dim.height - safePadding);

      return {
        x: Math.max(minX, Math.min(pos.x, maxX)),
        y: Math.max(minY, Math.min(pos.y, maxY)),
      };
    },
    [getDimensionsForState, safePadding]
  );

  /**
   * Cancel any running momentum/inertia animation
   */
  const stopInertiaAnimation = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  /**
   * Magnetic snap to dock state on left or right edge
   */
  const snapToDock = useCallback(
    (side: "left" | "right") => {
      stopInertiaAnimation();
      const targetState: FloatingPlayerState = side === "left" ? "dock-left" : "dock-right";
      const clamped = clampPosition(
        {
          x: side === "left" ? 0 : window.innerWidth - dockDimensions.width,
          y: positionRef.current.y,
        },
        targetState
      );
      setPosition(clamped);
      setPlayerState(targetState);
    },
    [clampPosition, dockDimensions.width, setPlayerState, stopInertiaAnimation]
  );

  /**
   * Smoothly restore floating player from docked state back into view
   */
  const restoreFromDock = useCallback(
    (targetState: "pill" | "expanded" = "pill") => {
      stopInertiaAnimation();
      const current = positionRef.current;
      const winWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
      const targetDim = targetState === "expanded" ? expandedDimensions : pillDimensions;

      let targetX = current.x;
      if (playerStateRef.current === "dock-left" || current.x <= safePadding + 20) {
        targetX = safePadding + 16;
      } else if (
        playerStateRef.current === "dock-right" ||
        current.x >= winWidth - dockDimensions.width - 20
      ) {
        targetX = Math.max(safePadding, winWidth - targetDim.width - safePadding - 16);
      }

      const clamped = clampPosition({ x: targetX, y: current.y }, targetState);
      setPosition(clamped);
      setPlayerState(targetState);
    },
    [
      clampPosition,
      dockDimensions.width,
      expandedDimensions,
      pillDimensions,
      safePadding,
      setPlayerState,
      stopInertiaAnimation,
    ]
  );

  /**
   * Calculate pointer release velocity using timestamped sliding window
   */
  const calculateReleaseVelocity = useCallback((): Velocity => {
    const samples = samplesRef.current;
    if (samples.length < 2) return { x: 0, y: 0 };

    const now = performance.now();
    // Use samples from the most recent 120ms
    const recent = samples.filter((s) => now - s.time <= 120);
    const validSamples = recent.length >= 2 ? recent : samples.slice(-3);

    if (validSamples.length < 2) return { x: 0, y: 0 };

    const first = validSamples[0];
    const last = validSamples[validSamples.length - 1];
    const dt = Math.max(1, last.time - first.time);

    // Velocity in pixels per frame (~16.6ms)
    const vx = ((last.x - first.x) / dt) * 16.6;
    const vy = ((last.y - first.y) / dt) * 16.6;

    // Clamp maximum velocity to avoid uncontrollable flinging
    const maxVelocity = 45;
    return {
      x: Math.max(-maxVelocity, Math.min(vx, maxVelocity)),
      y: Math.max(-maxVelocity, Math.min(vy, maxVelocity)),
    };
  }, []);

  /**
   * Start inertia fling physics loop with deceleration and edge snapping
   */
  const startInertiaFling = useCallback(
    (initialVel: Velocity) => {
      stopInertiaAnimation();

      if (typeof window === "undefined") return;

      const winWidth = window.innerWidth;
      const currentPos = positionRef.current;
      const currentState = playerStateRef.current;
      const dim = getDimensionsForState(currentState);

      // Estimate landing X based on current velocity
      const projectedDistanceX = (initialVel.x / (1 - friction)) * 0.6;
      const landingX = currentPos.x + projectedDistanceX;

      // Magnetic snap check: distance to left edge < threshold or distance to right edge < threshold
      const distToLeft = landingX;
      const distToRight = winWidth - (landingX + dim.width);

      if (distToLeft < edgeSnapThreshold && initialVel.x <= 2) {
        // Auto-snap to left dock
        snapToDock("left");
        return;
      }

      if (distToRight < edgeSnapThreshold && initialVel.x >= -2) {
        // Auto-snap to right dock
        snapToDock("right");
        return;
      }

      // If already in dock and moving outwards, remain in pill/expanded
      let currX = currentPos.x;
      let currY = currentPos.y;
      let vx = initialVel.x;
      let vy = initialVel.y;

      if (Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2) {
        const finalClamped = clampPosition({ x: currX, y: currY }, currentState);
        setPosition(finalClamped);
        return;
      }

      setIsAnimating(true);

      const step = () => {
        vx *= friction;
        vy *= friction;

        currX += vx;
        currY += vy;

        const clamped = clampPosition({ x: currX, y: currY }, currentState);
        currX = clamped.x;
        currY = clamped.y;

        setPosition({ x: currX, y: currY });
        setVelocity({ x: vx, y: vy });

        // Check if edge snap threshold reached during movement
        const currentDistLeft = currX;
        const currentDistRight = winWidth - (currX + dim.width);

        if (currentDistLeft < edgeSnapThreshold && vx < 0) {
          snapToDock("left");
          return;
        }

        if (currentDistRight < edgeSnapThreshold && vx > 0) {
          snapToDock("right");
          return;
        }

        // Stop condition when velocity is sufficiently small
        if (Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15) {
          stopInertiaAnimation();
          setVelocity({ x: 0, y: 0 });
          return;
        }

        animFrameIdRef.current = requestAnimationFrame(step);
      };

      animFrameIdRef.current = requestAnimationFrame(step);
    },
    [
      clampPosition,
      edgeSnapThreshold,
      friction,
      getDimensionsForState,
      snapToDock,
      stopInertiaAnimation,
    ]
  );

  /**
   * Pointer down handler (mouse or touch)
   */
  const startDrag = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      // Must be initiated from a drag handle or the dock container
      const isDockedState =
        playerStateRef.current === "dock-left" || playerStateRef.current === "dock-right";
      const isHandle = target.closest(".drag-handle") !== null;
      const isDockElement = target.closest(".dock-drag-target") !== null;

      if (!isHandle && !isDockedState && !isDockElement) {
        return;
      }

      stopInertiaAnimation();
      isDraggingRef.current = true;
      setIsDragging(true);

      dragStartRef.current = {
        clientX,
        clientY,
        startX: positionRef.current.x,
        startY: positionRef.current.y,
      };

      samplesRef.current = [
        {
          x: clientX,
          y: clientY,
          time: performance.now(),
        },
      ];
    },
    [stopInertiaAnimation]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ignore right clicks or non-primary buttons
      if (e.button !== 0) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY, e.target as HTMLElement);
    },
    [startDrag]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY, e.target as HTMLElement);
    },
    [startDrag]
  );

  /**
   * Global pointer move and up handlers during active dragging
   */
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ x: clientX, y: clientY, time: now });
      if (samples.length > 8) {
        samples.shift();
      }

      const dx = clientX - dragStartRef.current.clientX;
      const dy = clientY - dragStartRef.current.clientY;

      let nextState = playerStateRef.current;

      // If dragging while docked, seamlessly transition to 'pill' once moved inward
      if (playerStateRef.current === "dock-left" && dx > 20) {
        nextState = "pill";
        setPlayerState("pill");
      } else if (playerStateRef.current === "dock-right" && dx < -20) {
        nextState = "pill";
        setPlayerState("pill");
      }

      const rawX = dragStartRef.current.startX + dx;
      const rawY = dragStartRef.current.startY + dy;

      const clamped = clampPosition({ x: rawX, y: rawY }, nextState);
      setPosition(clamped);
    },
    [clampPosition, setPlayerState]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    setIsDragging(false);

    const vel = calculateReleaseVelocity();
    setVelocity(vel);
    startInertiaFling(vel);
  }, [calculateReleaseVelocity, startInertiaFling]);

  // Window drag event listeners
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handlePointerMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handlePointerUp();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }
    };

    const onTouchEnd = () => {
      handlePointerUp();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: false });
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [handlePointerMove, handlePointerUp, isDragging]);

  // Window resize listener: scale proportionally and clamp
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const prevWin = prevWindowSizeRef.current;
      const newWinWidth = window.innerWidth;
      const newWinHeight = window.innerHeight;

      if (prevWin.width <= 0 || prevWin.height <= 0) {
        prevWindowSizeRef.current = { width: newWinWidth, height: newWinHeight };
        return;
      }

      const currentState = playerStateRef.current;
      const dim = getDimensionsForState(currentState);

      setPosition((prev) => {
        if (currentState === "dock-left") {
          const ratioY = prev.y / Math.max(1, prevWin.height - dim.height);
          const newY = ratioY * (newWinHeight - dim.height);
          return clampPosition({ x: 0, y: newY }, currentState);
        }

        if (currentState === "dock-right") {
          const ratioY = prev.y / Math.max(1, prevWin.height - dim.height);
          const newY = ratioY * (newWinHeight - dim.height);
          return clampPosition({ x: newWinWidth - dim.width, y: newY }, currentState);
        }

        // Proportional placement for floating states
        const maxPrevX = Math.max(1, prevWin.width - dim.width);
        const maxPrevY = Math.max(1, prevWin.height - dim.height);
        const ratioX = prev.x / maxPrevX;
        const ratioY = prev.y / maxPrevY;

        const targetX = ratioX * (newWinWidth - dim.width);
        const targetY = ratioY * (newWinHeight - dim.height);

        return clampPosition({ x: targetX, y: targetY }, currentState);
      });

      prevWindowSizeRef.current = { width: newWinWidth, height: newWinHeight };
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition, getDimensionsForState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  const isDocked = playerState === "dock-left" || playerState === "dock-right";

  return {
    position,
    playerState,
    setPlayerState,
    isDragging,
    isAnimating,
    velocity,
    isDocked,
    dragHandlers: {
      onMouseDown,
      onTouchStart,
    },
    springConfig: FLOATING_SPRING_CONFIG,
    restoreFromDock,
    snapToDock,
    setPosition,
    clampPosition,
  };
}
