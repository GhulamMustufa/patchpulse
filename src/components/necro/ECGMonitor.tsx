"use client";

import React, { useEffect, useRef } from "react";
import { Activity, HeartPulse, ShieldAlert, Skull } from "lucide-react";
import { VitalState, VerificationStatus } from "@/lib/necro-engine/types";

interface ECGMonitorProps {
  vitalState: VitalState;
  heartbeatBpm: number;
  patientName: string;
  verificationStatus?: VerificationStatus;
}

const STATUS_DISPLAY: Record<
  VitalState,
  {
    label: string;
    detail: string;
    pillClass: string;
    lineColor: string;
    glowColor: string;
  }
> = {
  DEAD: {
    label: "Needs Repair",
    detail: "Issues found — click Fix Code below",
    pillClass: "text-rose-300 border-rose-500/40 bg-rose-950/50",
    lineColor: "#f43f5e",
    glowColor: "rgba(244, 63, 94, 0.35)",
  },
  DIAGNOSING: {
    label: "Checking Code...",
    detail: "Scanning syntax, types, and dependencies",
    pillClass: "text-amber-300 border-amber-500/40 bg-amber-950/50 animate-pulse",
    lineColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
  },
  RESURRECTING: {
    label: "Fixing Code...",
    detail: "Generating safe code updates",
    pillClass: "text-purple-300 border-purple-500/40 bg-purple-950/50 animate-pulse",
    lineColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.45)",
  },
  SYNTAX_VERIFIED: {
    label: "Syntax OK • Tests Not Run",
    detail: "Code compiles cleanly — run tests to verify behavior",
    pillClass: "text-cyan-300 border-cyan-500/40 bg-cyan-950/50",
    lineColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.4)",
  },
  TESTS_RUNNING: {
    label: "Running Tests...",
    detail: "Executing inside isolated sandbox",
    pillClass: "text-cyan-300 border-cyan-500/40 bg-cyan-950/50 animate-pulse",
    lineColor: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.45)",
  },
  PARTIAL: {
    label: "Partially Fixed",
    detail: "Some tests passed, but failures remain",
    pillClass: "text-amber-300 border-amber-500/40 bg-amber-950/50",
    lineColor: "#fbbf24",
    glowColor: "rgba(251, 191, 36, 0.4)",
  },
  ALIVE: {
    label: "All Tests Passed",
    detail: "Verified healthy inside isolated sandbox",
    pillClass: "text-emerald-300 border-emerald-500/40 bg-emerald-950/50",
    lineColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.45)",
  },
  FAILED: {
    label: "Fix Failed",
    detail: "Syntax or test errors still present",
    pillClass: "text-rose-300 border-rose-500/40 bg-rose-950/50",
    lineColor: "#f43f5e",
    glowColor: "rgba(244, 63, 94, 0.4)",
  },
  BLOCKED: {
    label: "Tests Blocked",
    detail: "Sandbox unavailable or missing external dependency",
    pillClass: "text-orange-300 border-orange-500/40 bg-orange-950/50",
    lineColor: "#fb923c",
    glowColor: "rgba(251, 146, 60, 0.4)",
  },
};

function getEffectiveDetail(
  vitalState: VitalState,
  verificationStatus?: VerificationStatus
): string {
  if (
    vitalState === "SYNTAX_VERIFIED" &&
    verificationStatus === "NO_TESTS_FOUND"
  ) {
    return "Syntax checked cleanly (no test files in project)";
  }
  return STATUS_DISPLAY[vitalState].detail;
}

export function ECGMonitor({
  vitalState,
  heartbeatBpm,
  patientName,
  verificationStatus,
}: ECGMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const meta = STATUS_DISPLAY[vitalState];
  const detailText = getEffectiveDetail(vitalState, verificationStatus);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationId = 0;

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Subtle clinical grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = meta.lineColor;
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = meta.glowColor;

      const step = 2;
      for (let x = 0; x < width; x += step) {
        const t = ((x + phaseRef.current) % 160) / 160;
        let yOffset = 0;

        if (vitalState === "DEAD" || vitalState === "FAILED") {
          yOffset = Math.sin((x + phaseRef.current) * 0.08) * 1.2;
        } else if (vitalState === "BLOCKED") {
          yOffset = ((x + Math.floor(phaseRef.current)) % 24 < 12 ? -3 : 3);
        } else if (
          vitalState === "DIAGNOSING" ||
          vitalState === "RESURRECTING" ||
          vitalState === "TESTS_RUNNING"
        ) {
          yOffset =
            Math.sin((x + phaseRef.current) * 0.14) * 11 +
            Math.cos((x + phaseRef.current) * 0.32) * 5;
        } else {
          // Heartbeat wave (amplitude tuned to honest state)
          const ampScale =
            vitalState === "ALIVE"
              ? 1
              : vitalState === "PARTIAL"
                ? 0.72
                : 0.48;
          if (t > 0.18 && t < 0.25) {
            yOffset = -5 * ampScale * Math.sin(((t - 0.18) / 0.07) * Math.PI);
          } else if (t >= 0.3 && t < 0.33) {
            yOffset = 7 * ampScale * Math.sin(((t - 0.3) / 0.03) * Math.PI);
          } else if (t >= 0.33 && t < 0.38) {
            yOffset = -28 * ampScale * Math.sin(((t - 0.33) / 0.05) * Math.PI);
          } else if (t >= 0.38 && t < 0.42) {
            yOffset = 10 * ampScale * Math.sin(((t - 0.38) / 0.04) * Math.PI);
          } else if (t >= 0.5 && t < 0.62) {
            yOffset = -8 * ampScale * Math.sin(((t - 0.5) / 0.12) * Math.PI);
          }
        }

        const y = midY + yOffset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      if (!prefersReducedMotion) {
        const speed =
          vitalState === "ALIVE"
            ? 2.8
            : vitalState === "TESTS_RUNNING" || vitalState === "RESURRECTING"
              ? 3.4
              : vitalState === "SYNTAX_VERIFIED" || vitalState === "PARTIAL"
                ? 1.8
                : 0.8;
        phaseRef.current = (phaseRef.current + speed) % 10000;
        animationId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [vitalState, meta.lineColor, meta.glowColor]);

  const StatusIcon =
    vitalState === "ALIVE"
      ? HeartPulse
      : vitalState === "BLOCKED"
        ? ShieldAlert
        : vitalState === "DEAD" || vitalState === "FAILED"
          ? Skull
          : Activity;

  return (
    <section
      aria-label={`Project health status: ${meta.label}`}
      className="rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800/80 bg-[#0b101d]">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusIcon className="w-4 h-4 shrink-0 text-slate-300" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">
                {patientName}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                — {detailText}
              </span>
            </div>
            <p className="text-xs text-slate-400 sm:hidden truncate">
              {detailText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${meta.pillClass}`}
          >
            {meta.label}
          </span>
          <span
            className="text-xs font-mono text-slate-300 tabular-nums bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded"
            title="Health score pulse: 0 = broken, 38 = syntax only, 78 = all tests passed"
          >
            {heartbeatBpm} BPM
          </span>
        </div>
      </div>

      <div className="relative h-16 w-full bg-[#04070e]">
        <canvas
          ref={canvasRef}
          width={960}
          height={64}
          aria-hidden="true"
          className="w-full h-full block"
        />
      </div>
    </section>
  );
}
