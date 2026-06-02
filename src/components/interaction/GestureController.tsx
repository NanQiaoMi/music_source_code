"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useGestureStore, GestureType } from "@/store/gestureStore";
import { useAudioStore } from "@/store/audioStore";

// Landmark
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;

// ֲ
const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

interface HandLandmarkerResult {
  landmarks?: NormalizedLandmark[][];
}

interface HandLandmarkerInstance {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => HandLandmarkerResult;
  close: () => void;
}

export const GestureController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const animationFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [showCamera, setShowCamera] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [statusText, setStatusText] = useState("ڳʼ...");

  // ״̬ refsհ⣩
  const isMouseDownRef = useRef(false);
  const gestureCooldownRef = useRef(false);
  const lastPinchStateRef = useRef(false);
  const pinchHoldStartRef = useRef<number>(0);
  const smoothPositionRef = useRef({ x: 0.5, y: 0.5 });
  const lastHandTimeRef = useRef<number>(0);
  const swipeHistoryRef = useRef<{ x: number; time: number }[]>([]);

  //
  const SMOOTH_FACTOR = 0.2;
  const PINCH_THRESHOLD = 0.06;
  const PINCH_RELEASE_THRESHOLD = 0.08; // ɿʱֵγͺ
  const SWIPE_MIN_DISTANCE = 0.2;
  const SWIPE_MAX_TIME_MS = 350;
  const HAND_LOST_TIMEOUT_MS = 600;

  const isEnabled = useGestureStore((state) => state.isEnabled);

  // Use non-reactive getState() for setters called in the hot loop
  const _getGestureActions = useCallback(() => useGestureStore.getState(), []);

  const setIsCameraActive = useCallback(
    (v: boolean) => useGestureStore.getState().setIsCameraActive(v),
    []
  );
  const setCursorPosition = useCallback(
    (x: number, y: number) => useGestureStore.getState().setCursorPosition(x, y),
    []
  );
  const setIsHandDetected = useCallback(
    (v: boolean) => useGestureStore.getState().setIsHandDetected(v),
    []
  );
  const setIsPinching = useCallback(
    (v: boolean) => useGestureStore.getState().setIsPinching(v),
    []
  );
  const setIsEnabled = useCallback((v: boolean) => useGestureStore.getState().setIsEnabled(v), []);
  const setLastGesture = useCallback(
    (v: GestureType) => useGestureStore.getState().setLastGesture(v),
    []
  );
  const setGestureTriggered = useCallback(
    (v: boolean) => useGestureStore.getState().setGestureTriggered(v),
    []
  );

  // ============ Ƽ߼ ============

  const getDistance2D = (a: NormalizedLandmark, b: NormalizedLandmark) => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  };

  const isPinch = useCallback((landmarks: NormalizedLandmark[]) => {
    const dist = getDistance2D(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
    // ʹͺֹ
    if (lastPinchStateRef.current) {
      return dist < PINCH_RELEASE_THRESHOLD;
    }
    return dist < PINCH_THRESHOLD;
  }, []);

  const detectSwipe = useCallback((landmarks: NormalizedLandmark[], now: number) => {
    const wrist = landmarks[WRIST];
    const history = swipeHistoryRef.current;

    // ӵʷ
    history.push({ x: wrist.x, time: now });

    // ֻ500ms
    while (history.length > 0 && now - history[0].time > 500) {
      history.shift();
    }

    if (history.length < 3) return null;

    const first = history[0];
    const last = history[history.length - 1];
    const dx = last.x - first.x;
    const dt = last.time - first.time;

    if (dt > 50 && dt < SWIPE_MAX_TIME_MS && Math.abs(dx) > SWIPE_MIN_DISTANCE) {
      swipeHistoryRef.current = [];
      // ע⣺ͷǾģx Ѿ 1-x ת
      //  dx > 0 ԭʼͷζ󣬵ת
      return dx < 0 ? "swipe_right" : "swipe_left";
    }

    return null;
  }, []);

  // ============ ƹ ============

  const drawSkeleton = useCallback((landmarks: NormalizedLandmark[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    //
    ctx.strokeStyle = "rgba(0, 255, 136, 0.7)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      ctx.stroke();
    }

    // ؼ
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const isKey = i === THUMB_TIP || i === INDEX_TIP;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, isKey ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isKey ? "#ff00ff" : i === WRIST ? "#ff6b6b" : "#ffffff";
      ctx.fill();
    }

    // ״̬һĴָ-ʳָ
    const pinchDist = getDistance2D(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
    if (pinchDist < PINCH_RELEASE_THRESHOLD) {
      ctx.strokeStyle = "rgba(255, 0, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(landmarks[THUMB_TIP].x * w, landmarks[THUMB_TIP].y * h);
      ctx.lineTo(landmarks[INDEX_TIP].x * w, landmarks[INDEX_TIP].y * h);
      ctx.stroke();
    }
  }, []);

  // ============ ɷ¼ ============

  const dispatchSyntheticEvent = useCallback((type: string, x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    if (type === "click") {
      (el as HTMLElement).click();
      return;
    }

    const event = new PointerEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "touch",
    });
    el.dispatchEvent(event);
  }, []);

  // ============ һ֡ƽ ============

  const processFrame = useCallback(
    (landmarks: NormalizedLandmark[]) => {
      const now = Date.now();
      lastHandTimeRef.current = now;

      // 1. λãʳָĴָе㣩
      const midX = (landmarks[INDEX_TIP].x + landmarks[THUMB_TIP].x) / 2;
      const midY = (landmarks[INDEX_TIP].y + landmarks[THUMB_TIP].y) / 2;

      // ת X
      const rawX = 1 - midX;
      const rawY = midY;

      // ƽ
      smoothPositionRef.current = {
        x: smoothPositionRef.current.x + (rawX - smoothPositionRef.current.x) * SMOOTH_FACTOR,
        y: smoothPositionRef.current.y + (rawY - smoothPositionRef.current.y) * SMOOTH_FACTOR,
      };

      const sx = Math.max(0, Math.min(1, smoothPositionRef.current.x));
      const sy = Math.max(0, Math.min(1, smoothPositionRef.current.y));

      setCursorPosition(sx, sy);
      setIsHandDetected(true);

      const screenX = sx * window.innerWidth;
      const screenY = sy * window.innerHeight;

      // 2. ϼ
      const pinching = isPinch(landmarks);
      const wasPinching = lastPinchStateRef.current;
      lastPinchStateRef.current = pinching;
      setIsPinching(pinching);

      if (pinching && !wasPinching) {
        // տʼ  pointerdown
        isMouseDownRef.current = true;
        pinchHoldStartRef.current = now;
        dispatchSyntheticEvent("pointerdown", screenX, screenY);
      } else if (!pinching && wasPinching) {
        // ɿ  pointerup + click
        isMouseDownRef.current = false;
        dispatchSyntheticEvent("pointerup", screenX, screenY);
        // ֻж̰Ŵ clickΪק
        if (now - pinchHoldStartRef.current < 500) {
          dispatchSyntheticEvent("click", screenX, screenY);
        }
      }

      // 3. ƶ¼hover / drag
      dispatchSyntheticEvent("pointermove", screenX, screenY);

      // 4. Ӷи裨ڷʱ
      if (!pinching) {
        const swipe = detectSwipe(landmarks, now);
        if (swipe && !gestureCooldownRef.current) {
          gestureCooldownRef.current = true;
          setTimeout(() => {
            gestureCooldownRef.current = false;
          }, 800);

          setGestureTriggered(true);
          setLastGesture(swipe);

          if (swipe === "swipe_left") {
            useAudioStore.getState().prevSong();
          } else if (swipe === "swipe_right") {
            useAudioStore.getState().nextSong();
          }

          setTimeout(() => setGestureTriggered(false), 400);
        }
      }
    },
    [
      setCursorPosition,
      setIsHandDetected,
      setIsPinching,
      isPinch,
      detectSwipe,
      dispatchSyntheticEvent,
      setGestureTriggered,
      setLastGesture,
    ]
  );

  // ============  Effectʼ HandLandmarker ============

  useEffect(() => {
    if (!isEnabled) {
      setIsCameraActive(false);
      return;
    }

    let cancelled = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey)) {
        setIsEnabled(false);
      }
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
        setShowCamera((p) => !p);
      }
      if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        setShowSkeleton((p) => !p);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    const init = async () => {
      setStatusText("ģ...");

      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { HandLandmarker, FilesetResolver } = vision;

        if (cancelled) return;

        // ʼ WASM ʱ
        const wasmFileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (cancelled) return;

        setStatusText(" HandLandmarker...");

        //  HandLandmarkerʹ CDN ϵģͣ
        const handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (cancelled) {
          handLandmarker.close();
          return;
        }

        handLandmarkerRef.current = handLandmarker;

        setStatusText("ͷ...");

        // ͷ
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          handLandmarker.close();
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        setIsCameraActive(true);
        setStatusText(" ?");

        // ѭ
        let lastTimestamp = -1;

        const loop = () => {
          if (cancelled || !videoRef.current || !handLandmarkerRef.current) return;

          const vd = videoRef.current;
          if (vd.readyState >= 2 && vd.currentTime !== lastTimestamp) {
            lastTimestamp = vd.currentTime;
            const startMs = performance.now();

            try {
              const result = handLandmarkerRef.current.detectForVideo(vd, startMs);

              if (result.landmarks && result.landmarks.length > 0) {
                const landmarks: NormalizedLandmark[] = result.landmarks[0];

                // ƹ
                if (canvasRef.current && showSkeleton) {
                  drawSkeleton(landmarks, canvasRef.current);
                }

                //
                processFrame(landmarks);
              } else {
                // ֲʧ
                const now = Date.now();
                if (
                  lastHandTimeRef.current &&
                  now - lastHandTimeRef.current > HAND_LOST_TIMEOUT_MS
                ) {
                  setIsHandDetected(false);
                  setIsPinching(false);

                  if (isMouseDownRef.current) {
                    isMouseDownRef.current = false;
                    const sx = smoothPositionRef.current.x * window.innerWidth;
                    const sy = smoothPositionRef.current.y * window.innerHeight;
                    dispatchSyntheticEvent("pointerup", sx, sy);
                  }

                  if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext("2d");
                    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  }
                }
              }
            } catch (err) {
              // ż֡жѭ
              console.warn("Frame processing error:", err);
            }
          }

          animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);
      } catch (error) {
        console.error("HandLandmarker ʼʧ:", error);
        setStatusText("ʼʧ ?");
        setIsCameraActive(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", handleKeyDown);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (handLandmarkerRef.current) {
        try {
          handLandmarkerRef.current.close();
        } catch {
          /* ignore */
        }
        handLandmarkerRef.current = null;
      }

      setIsCameraActive(false);
      setIsHandDetected(false);
      setIsPinching(false);
    };
  }, [
    isEnabled,
    setIsCameraActive,
    setIsHandDetected,
    setIsPinching,
    setIsEnabled,
    drawSkeleton,
    processFrame,
    dispatchSyntheticEvent,
    showSkeleton,
  ]);

  // ============ Ⱦ ============

  const displayStatusText = isEnabled ? statusText : "ѹر";

  if (!isEnabled) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
      {/* ưť */}
      <div className="flex gap-2 mb-1">
        <button
          onClick={() => setShowCamera((p) => !p)}
          className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs rounded-full hover:bg-white/20 transition-colors cursor-pointer select-none"
        >
          {showCamera ? "ͷ" : "ʾͷ"}
        </button>
        <button
          onClick={() => setShowSkeleton((p) => !p)}
          className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs rounded-full hover:bg-white/20 transition-colors cursor-pointer select-none"
        >
          {showSkeleton ? "ع" : "ʾ"}
        </button>
        <button
          onClick={() => setIsEnabled(false)}
          className="px-3 py-1.5 bg-red-500/30 backdrop-blur-md border border-red-400/20 text-red-200 text-xs rounded-full hover:bg-red-500/50 transition-colors cursor-pointer select-none"
        >
          ر
        </button>
      </div>

      {/* ״ָ̬ʾ */}
      <div className="text-white/60 text-[10px] px-1">{displayStatusText}</div>

      {/* ͷ */}
      {showCamera && (
        <div className="relative pointer-events-none">
          <video
            ref={videoRef}
            className="w-52 h-40 rounded-lg object-cover"
            playsInline
            muted
            style={{
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
              transform: "scaleX(-1)",
            }}
          />
          {showSkeleton && (
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute top-0 left-0 w-52 h-40 rounded-lg"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
        </div>
      )}

      {/* ص video ԪأͷʱУ */}
      {!showCamera && (
        <video ref={videoRef} className="w-0 h-0 absolute opacity-0" playsInline muted />
      )}

      {/* ݼʾ */}
      <div className="text-white/40 text-[10px] leading-relaxed px-1 mt-1">
        <p>ESC/G ر C ͷ S </p>
        <p>= =и</p>
      </div>
    </div>
  );
};
