"use client";

import { useEffect, useRef, useCallback } from "react";
import { AvatarState, AVATAR_VIDEO_SPEED } from "@/types/avatar";
import { useAvatar, getVideoForState, ChromakeyMode } from "@/hooks/useAvatar";

interface AvatarVideoProps {
  state: AvatarState;
  onLoad?: () => void;
}

// Black chromakey thresholds
const BLACK_THRESHOLD = 40;
const BLACK_EDGE = 80;

// Green chromakey thresholds
const GREEN_DOMINANCE = 1.2;
const GREEN_MIN = 80;
const GREEN_EDGE = 0.15;

const CROSSFADE_MS = 400;

function chromakey(data: Uint8ClampedArray, mode: ChromakeyMode) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (mode === "green") {
      const maxRB = Math.max(r, b);
      if (g > GREEN_MIN && g > maxRB * GREEN_DOMINANCE) {
        const greenness = (g - maxRB * GREEN_DOMINANCE) / g;
        if (greenness > GREEN_EDGE) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = Math.round((1 - greenness / GREEN_EDGE) * 255);
        }
      }
    } else {
      const brightness = r + g + b;
      if (brightness < BLACK_THRESHOLD) {
        data[i + 3] = 0;
      } else if (brightness < BLACK_EDGE) {
        const alpha =
          ((brightness - BLACK_THRESHOLD) / (BLACK_EDGE - BLACK_THRESHOLD)) *
          255;
        data[i + 3] = Math.round(alpha);
      }
    }
  }
}

export default function AvatarVideo({ state, onLoad }: AvatarVideoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offA = useRef<HTMLCanvasElement | null>(null);
  const offB = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const processFrameRef = useRef<() => void>(() => {});
  const loadedRef = useRef(false);

  // Two video slots for crossfade
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  // Which slot is "active" (the one we're fading TO)
  const activeSlotRef = useRef<"A" | "B">("A");
  // Crossfade state
  const fadeStartRef = useRef<number | null>(null);
  const prevSrcKeyRef = useRef<string>("");

  const { avatar } = useAvatar();
  const videoSources = getVideoForState(avatar, state);
  const chromakeyRef = useRef<ChromakeyMode>(avatar.chromakey);

  useEffect(() => {
    chromakeyRef.current = avatar.chromakey;
  }, [avatar.chromakey]);

  const srcKey = videoSources.mp4; // unique identifier for current source

  // Update playback rate on both videos
  useEffect(() => {
    const rate = AVATAR_VIDEO_SPEED[state];
    if (videoARef.current) videoARef.current.playbackRate = rate;
    if (videoBRef.current) videoBRef.current.playbackRate = rate;
  }, [state]);

  // Handle source changes — load new source into the inactive slot and start crossfade
  useEffect(() => {
    if (srcKey === prevSrcKeyRef.current) return;
    const isFirst = prevSrcKeyRef.current === "";
    prevSrcKeyRef.current = srcKey;

    if (isFirst) {
      // First load: just set source on slot A directly
      const video = videoARef.current;
      if (!video) return;
      const sources = video.querySelectorAll("source");
      if (sources[0]) sources[0].setAttribute("src", videoSources.webm);
      if (sources[1]) sources[1].setAttribute("src", videoSources.mp4);
      video.load();
      video.play().catch(() => {});
      activeSlotRef.current = "A";
      return;
    }

    // Subsequent changes: load into inactive slot, start crossfade when ready
    const inactiveSlot = activeSlotRef.current === "A" ? "B" : "A";
    const inactiveVideo =
      inactiveSlot === "A" ? videoARef.current : videoBRef.current;
    if (!inactiveVideo) return;

    const sources = inactiveVideo.querySelectorAll("source");
    if (sources[0]) sources[0].setAttribute("src", videoSources.webm);
    if (sources[1]) sources[1].setAttribute("src", videoSources.mp4);

    inactiveVideo.load();

    const onCanPlay = () => {
      inactiveVideo.removeEventListener("canplay", onCanPlay);
      inactiveVideo.play().catch(() => {});
      // Start crossfade
      activeSlotRef.current = inactiveSlot;
      fadeStartRef.current = performance.now();
    };

    inactiveVideo.addEventListener("canplay", onCanPlay);

    return () => {
      inactiveVideo.removeEventListener("canplay", onCanPlay);
    };
  }, [srcKey, videoSources]);

  const ensureOffscreen = (
    ref: React.MutableRefObject<HTMLCanvasElement | null>
  ) => {
    if (!ref.current) ref.current = document.createElement("canvas");
    return ref.current;
  };

  const processVideoFrame = useCallback(
    (
      video: HTMLVideoElement,
      off: HTMLCanvasElement,
      mode: ChromakeyMode
    ): ImageData | null => {
      if (video.paused || video.ended) return null;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) return null;

      if (off.width !== w || off.height !== h) {
        off.width = w;
        off.height = h;
      }

      const ctx = off.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      chromakey(imageData.data, mode);
      return imageData;
    },
    []
  );

  const processFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const videoA = videoARef.current;
    const videoB = videoBRef.current;

    if (!canvas || !videoA || !videoB) {
      rafRef.current = requestAnimationFrame(processFrameRef.current);
      return;
    }

    const mode = chromakeyRef.current;
    const activeSlot = activeSlotRef.current;
    const activeVideo = activeSlot === "A" ? videoA : videoB;
    const oldVideo = activeSlot === "A" ? videoB : videoA;

    const offActive = ensureOffscreen(activeSlot === "A" ? offA : offB);
    const offOld = ensureOffscreen(activeSlot === "A" ? offB : offA);

    const activeFrame = processVideoFrame(activeVideo, offActive, mode);

    // Calculate crossfade blend
    let blend = 1; // 1 = fully showing active, 0 = fully showing old
    if (fadeStartRef.current !== null) {
      const elapsed = performance.now() - fadeStartRef.current;
      blend = Math.min(elapsed / CROSSFADE_MS, 1);
      if (blend >= 1) fadeStartRef.current = null; // fade complete
    }

    const isCrossfading = blend < 1;
    const oldFrame = isCrossfading
      ? processVideoFrame(oldVideo, offOld, mode)
      : null;

    // Determine output size from active frame
    const frame = activeFrame || oldFrame;
    if (!frame) {
      rafRef.current = requestAnimationFrame(processFrameRef.current);
      return;
    }

    const w = frame.width;
    const h = frame.height;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrameRef.current);
      return;
    }

    ctx.clearRect(0, 0, w, h);

    if (isCrossfading && oldFrame && activeFrame) {
      // Blend: draw old frame, then draw active frame on top with blend alpha
      ctx.putImageData(oldFrame, 0, 0);
      // Draw active frame onto a temp canvas, then composite with globalAlpha
      const tempOff = ensureOffscreen(
        activeSlot === "A" ? offA : offB
      );
      const tempCtx = tempOff.getContext("2d", { willReadFrequently: true });
      if (tempCtx) {
        tempCtx.putImageData(activeFrame, 0, 0);
        ctx.globalAlpha = blend;
        ctx.drawImage(tempOff, 0, 0);
        ctx.globalAlpha = 1;
      }
    } else if (activeFrame) {
      ctx.putImageData(activeFrame, 0, 0);
    } else if (oldFrame) {
      ctx.putImageData(oldFrame, 0, 0);
    }

    if (!loadedRef.current && frame) {
      loadedRef.current = true;
      onLoad?.();
    }

    rafRef.current = requestAnimationFrame(processFrameRef.current);
  }, [onLoad, processVideoFrame]);

  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(processFrameRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [processFrame]);

  return (
    <div className="relative h-full">
      {/* Two hidden video elements for crossfade */}
      <div className="absolute overflow-hidden" style={{ width: 1, height: 1 }}>
        <video
          ref={videoARef}
          className="opacity-0 pointer-events-none"
          style={{ width: 1, height: 1 }}
          playsInline
          loop
          muted
          autoPlay
          crossOrigin="anonymous"
        >
          <source src={videoSources.webm} type="video/webm" />
          <source src={videoSources.mp4} type="video/mp4" />
        </video>
        <video
          ref={videoBRef}
          className="opacity-0 pointer-events-none"
          style={{ width: 1, height: 1 }}
          playsInline
          loop
          muted
          crossOrigin="anonymous"
        >
          <source type="video/webm" />
          <source type="video/mp4" />
        </video>
      </div>

      {/* Visible canvas with transparency */}
      <canvas
        ref={canvasRef}
        className="h-full w-auto max-w-none object-contain"
      />
    </div>
  );
}

