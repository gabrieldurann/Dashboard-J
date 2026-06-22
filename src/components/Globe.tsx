import createGlobe from "cobe";
import { useCallback, useEffect, useRef } from "react";

export interface GlobeMarker {
  id: string;
  location: [number, number]; // [lat, lng]
  label: string;
}

// HUD palette (cobe uses 0–1 RGB). Module-level for stable identity (avoids re-init each render).
const HUD_MARKER: [number, number, number] = [0.2, 0.89, 0.63]; // #34e3a0 green
const HUD_BASE: [number, number, number] = [0.24, 0.31, 0.33]; // muted land dots
const HUD_GLOW: [number, number, number] = [0.05, 0.13, 0.11]; // subtle atmosphere

interface GlobeProps {
  markers?: GlobeMarker[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  markerElevation?: number;
  speed?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
}

/**
 * Interactive dotted globe (cobe v2) with draggable rotation, inertia, and labeled markers.
 * Ported from the user's reference; recolored to the app's obsidian + green HUD. No arcs.
 */
export function Globe({
  markers = [],
  className = "",
  markerColor = HUD_MARKER,
  baseColor = HUD_BASE,
  glowColor = HUD_GLOW,
  dark = 1,
  mapBrightness = 6,
  markerSize = 0.04,
  markerElevation = 0.012,
  speed = 0.0035,
  theta = 0.25,
  diffuse = 1.2,
  mapSamples = 16000,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPausedRef.current = true;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (pointerInteracting.current === null) return;
    const deltaX = e.clientX - pointerInteracting.current.x;
    const deltaY = e.clientY - pointerInteracting.current.y;
    dragOffset.current = { phi: deltaX / 300, theta: deltaY / 1000 };
    const now = Date.now();
    if (lastPointer.current) {
      const dt = Math.max(now - lastPointer.current.t, 1);
      const maxV = 0.15;
      velocity.current = {
        phi: Math.max(-maxV, Math.min(maxV, ((e.clientX - lastPointer.current.x) / dt) * 0.3)),
        theta: Math.max(-maxV, Math.min(maxV, ((e.clientY - lastPointer.current.y) / dt) * 0.08)),
      };
    }
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId = 0;
    let phi = 0;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width,
        height: width,
        phi: 0,
        theta,
        dark,
        diffuse,
        mapSamples,
        mapBrightness,
        baseColor,
        markerColor,
        glowColor,
        markerElevation,
        markers: markers.map((m) => ({ location: m.location, size: markerSize, id: m.id })),
        opacity: 0.9,
      });

      const animate = () => {
        if (!isPausedRef.current) {
          phi += speed;
          if (Math.abs(velocity.current.phi) > 0.0001 || Math.abs(velocity.current.theta) > 0.0001) {
            phiOffsetRef.current += velocity.current.phi;
            thetaOffsetRef.current += velocity.current.theta;
            velocity.current.phi *= 0.95;
            velocity.current.theta *= 0.95;
          }
          const thetaMin = -0.4;
          const thetaMax = 0.4;
          if (thetaOffsetRef.current < thetaMin) thetaOffsetRef.current += (thetaMin - thetaOffsetRef.current) * 0.1;
          else if (thetaOffsetRef.current > thetaMax) thetaOffsetRef.current += (thetaMax - thetaOffsetRef.current) * 0.1;
        }
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: theta + thetaOffsetRef.current + dragOffset.current.theta,
          dark,
          mapBrightness,
          markerColor,
          baseColor,
          markerElevation,
          markers: markers.map((m) => ({ location: m.location, size: markerSize, id: m.id })),
        });
        animationId = requestAnimationFrame(animate);
      };
      animate();
      setTimeout(() => {
        if (canvas) canvas.style.opacity = "1";
      });
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if ((entries[0]?.contentRect.width ?? 0) > 0) {
          ro.disconnect();
          init();
        }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  }, [markers, markerColor, baseColor, glowColor, dark, mapBrightness, markerSize, markerElevation, speed, theta, diffuse, mapSamples]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          style={{
            position: "absolute",
            positionAnchor: `--cobe-${m.id}`,
            bottom: "anchor(top)",
            left: "anchor(center)",
            translate: "-50% 0",
            marginBottom: 8,
            padding: "2px 7px",
            background: "#0a0e14",
            color: "#e8eef5",
            border: "1px solid rgba(52,227,160,0.45)",
            borderRadius: 6,
            fontFamily: "'Inter', sans-serif",
            fontSize: "0.6rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            transition: "opacity 0.8s, filter 0.8s",
          }}
        >
          {m.label}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translate3d(-50%, -1px, 0)",
              border: "5px solid transparent",
              borderTopColor: "rgba(52,227,160,0.45)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
