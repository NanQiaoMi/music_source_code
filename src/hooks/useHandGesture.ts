import { useEffect, useRef, useCallback } from "react";
import { useGestureStore } from "@/store/gestureStore";

export const useHandGesture = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastHandPosition = useRef<{ x: number; y: number } | null>(null);
  const gestureCooldown = useRef(false);
  const {
    setIsCameraActive,
    setCursorPosition,
    setIsHandDetected,
    setLastGesture,
    setGestureTriggered,
  } = useGestureStore();

  const smoothPosition = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const smoothFactor = 0.2;

  const applySmoothing = useCallback((rawX: number, rawY: number) => {
    smoothPosition.current = {
      x: smoothPosition.current.x + (rawX - smoothPosition.current.x) * smoothFactor,
      y: smoothPosition.current.y + (rawY - smoothPosition.current.y) * smoothFactor,
    };
    return smoothPosition.current;
  }, []);

  const checkFistGesture = useCallback((landmarks: any[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];

    const isFist =
      indexTip.y > indexMcp.y &&
      middleTip.y > middleMcp.y &&
      ringTip.y > ringMcp.y &&
      pinkyTip.y > pinkyMcp.y;

    return isFist;
  }, []);

  const checkSwipeGesture = useCallback((hand: any[]) => {
    const palmBase = hand[0];
    const currentPosition = { x: palmBase.x, y: palmBase.y };

    if (lastHandPosition.current && !gestureCooldown.current) {
      const dx = currentPosition.x - lastHandPosition.current.x;
      const dy = currentPosition.y - lastHandPosition.current.y;

      if (Math.abs(dx) > 0.15 && Math.abs(dx) > Math.abs(dy)) {
        gestureCooldown.current = true;
        setTimeout(() => {
          gestureCooldown.current = false;
        }, 500);

        return dx > 0 ? "swipe_right" : "swipe_left";
      }
    }

    lastHandPosition.current = currentPosition;
    return null;
  }, []);

  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      setIsCameraActive(false);
    }
  }, [setIsCameraActive]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setIsCameraActive(false);
    }
  }, [setIsCameraActive]);

  const updateCursorPosition = useCallback(
    (hand: any[]) => {
      const palmBase = hand[0];
      const rawX = 1 - palmBase.x;
      const rawY = palmBase.y;

      const clampedX = Math.max(0, Math.min(1, rawX));
      const clampedY = Math.max(0, Math.min(1, rawY));

      const smoothed = applySmoothing(clampedX, clampedY);
      setCursorPosition(smoothed.x, smoothed.y);
    },
    [setCursorPosition, applySmoothing]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    initializeCamera,
    stopCamera,
    updateCursorPosition,
    checkFistGesture,
    checkSwipeGesture,
    setIsHandDetected,
    setLastGesture,
    setGestureTriggered,
  };
};
