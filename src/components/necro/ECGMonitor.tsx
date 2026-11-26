"use client";

import React, { useEffect, useRef } from "react";
import { ResurrectionState, VitalState } from "@/lib/necro-engine/types";
import { Skull, Zap, Heart, ShieldCheck, AlertOctagon, Ban } from "lucide-react";

interface ECGMonitorProps {
  vitalState: VitalState;
  bpm: number;
  patientName: string;
  resurrectionState?: ResurrectionState;
}

export function ECGMonitor({
  vitalState,
  bpm,
  patientName,
  resurrectionState,
}: ECGMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId = 0;
    let offset = 0;

    const drawFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 1;
      const gridSize = 20;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      let strokeColor = "#ef4444";
      let glowColor = "rgba(239, 68, 68, 0.6)";

      if (
        vitalState === "RESURRECTING" ||
        vitalState === "DIAGNOSING" ||
        vitalState === "TESTS_RUNNING" ||
        vitalState === "PARTIAL"
      ) {
        strokeColor = "#f59e0b";
        glowColor = "rgba(245, 158, 11, 0.6)";
      } else if (vitalState === "SYNTAX_VERIFIED") {
        strokeColor = "#06b6d4";
        glowColor = "rgba(6, 182, 212, 0.7)";
      } else if (vitalState === "ALIVE") {
        strokeColor = "#10b981";
        glowColor = "rgba(16, 185, 129, 0.8)";
      }

      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();

      const wavePeriod =
        vitalState === "ALIVE" || vitalState === "SYNTAX_VERIFIED" ? 140 : 200;

      for (let x = 0; x < width; x++) {
        const localPos = (x + offset) % wavePeriod;
        let y = midY;

        if (vitalState === "DEAD" || vitalState === "FAILED" || vitalState === "BLOCKED") {
          y = midY + (prefersReducedMotion ? 0 : (Math.random() - 0.5) * 1.5);
        } else if (
          vitalState === "RESURRECTING" ||
          vitalState === "DIAGNOSING" ||
          vitalState === "TESTS_RUNNING"
        ) {
          if (localPos > 20 && localPos < 35) {
            y = midY - 25 * Math.sin(((localPos - 20) / 15) * Math.PI);
          } else if (localPos > 70 && localPos < 95) {
            y = midY + 30 * Math.sin(((localPos - 70) / 25) * Math.PI);
          } else {
            y = midY + Math.sin(x * 0.05 + offset * 0.1) * 3;
          }
        } else {
          const amplitude =
            vitalState === "PARTIAL" ? 0.55 : vitalState === "SYNTAX_VERIFIED" ? 0.75 : 1;
          if (localPos >= 20 && localPos < 35) {
            y = midY - 8 * amplitude * Math.sin(((localPos - 20) / 15) * Math.PI);
          } else if (localPos >= 42 && localPos < 46) {
            y = midY + 6 * amplitude;
          } else if (localPos >= 46 && localPos < 54) {
            y = midY - 46 * amplitude;
          } else if (localPos >= 54 && localPos < 58) {
            y = midY + 12 * amplitude;
          } else if (localPos >= 70 && localPos < 95) {
            y = midY - 14 * amplitude * Math.sin(((localPos - 70) / 25) * Math.PI);
          }
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      if (!prefersReducedMotion) {
        const scanX = (width - (offset % width)) % width;
        const gradient = ctx.createLinearGradient(scanX - 30, 0, scanX, 0);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
        gradient.addColorStop(1, glowColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(Math.max(0, scanX - 30), 0, 30, height);

        offset +=
          vitalState === "ALIVE"
            ? 3.5
            : vitalState === "SYNTAX_VERIFIED" || vitalState === "PARTIAL"
            ? 2.8
            : vitalState === "RESURRECTING" ||
              vitalState === "DIAGNOSING" ||
              vitalState === "TESTS_RUNNING"
            ? 5
            : 0.8;
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [vitalState]);

  const statusText =
    vitalState === "DEAD"
      ? "FLATLINE (UNREPAIRED)"
      : vitalState === "BLOCKED"
      ? "VERIFICATION BLOCKED"
      : vitalState === "FAILED"
      ? "VERIFICATION FAILED"
      : vitalState === "DIAGNOSING"
      ? "DIAGNOSING AST & DEPENDENCIES..."
      : vitalState === "RESURRECTING"
      ? "GENERATING & VALIDATING PATCH..."
      : vitalState === "TESTS_RUNNING"
      ? "RUNNING TESTS IN ISOLATED SANDBOX..."
      : vitalState === "PARTIAL"
      ? "PARTIALLY RESURRECTED"
      : vitalState === "SYNTAX_VERIFIED"
      ? "SYNTAX VERIFIED (NO SANDBOX TEST PASS)"
      : "RESURRECTED (SANDBOX TESTS PASSED)";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#070b14] p-4 shadow-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
            {vitalState === "DEAD" && <Skull className="h-4 w-4 text-rose-500" />}
            {vitalState === "FAILED" && <AlertOctagon className="h-4 w-4 text-rose-500" />}
            {vitalState === "BLOCKED" && <Ban className="h-4 w-4 text-rose-400" />}
            {(vitalState === "RESURRECTING" ||
              vitalState === "DIAGNOSING" ||
              vitalState === "TESTS_RUNNING" ||
              vitalState === "PARTIAL") && <Zap className="h-4 w-4 text-amber-400" />}
            {vitalState === "SYNTAX_VERIFIED" && (
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
            )}
            {vitalState === "ALIVE" && <Heart className="h-4 w-4 text-emerald-400" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                Patient Subject:
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200">
                {patientName}
              </span>
              {resurrectionState && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                  STATE: {resurrectionState}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Lead II Telemetry • Truthful Sandbox Execution Monitor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
              vitalState === "DEAD" || vitalState === "FAILED" || vitalState === "BLOCKED"
                ? "bg-rose-950/40 border-rose-800/60 text-rose-400"
                : vitalState === "RESURRECTING" ||
                  vitalState === "DIAGNOSING" ||
                  vitalState === "TESTS_RUNNING" ||
                  vitalState === "PARTIAL"
                ? "bg-amber-950/40 border-amber-700/60 text-amber-300"
                : vitalState === "SYNTAX_VERIFIED"
                ? "bg-cyan-950/40 border-cyan-700/60 text-cyan-300"
                : "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                vitalState === "DEAD" || vitalState === "FAILED" || vitalState === "BLOCKED"
                  ? "bg-rose-500"
                  : vitalState === "RESURRECTING" ||
                    vitalState === "DIAGNOSING" ||
                    vitalState === "TESTS_RUNNING" ||
                    vitalState === "PARTIAL"
                  ? "bg-amber-400 animate-pulse"
                  : vitalState === "SYNTAX_VERIFIED"
                  ? "bg-cyan-400"
                  : "bg-emerald-400"
              }`}
            />
            {statusText}
          </div>

          <div className="flex items-baseline gap-1 text-right">
            <span
              className={`font-mono text-2xl font-bold tracking-tight ${
                vitalState === "DEAD" || vitalState === "FAILED" || vitalState === "BLOCKED"
                  ? "text-rose-500"
                  : vitalState === "RESURRECTING" ||
                    vitalState === "DIAGNOSING" ||
                    vitalState === "TESTS_RUNNING" ||
                    vitalState === "PARTIAL"
                  ? "text-amber-400"
                  : vitalState === "SYNTAX_VERIFIED"
                  ? "text-cyan-400"
                  : "text-emerald-400"
              }`}
            >
              {bpm}
            </span>
            <span className="font-mono text-xs text-slate-400">BPM</span>
          </div>
        </div>
      </div>

      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-slate-800/80 bg-[#090d16]">
        <canvas
          ref={canvasRef}
          width={800}
          height={112}
          role="img"
          aria-label={`ECG monitor for ${patientName}: ${statusText} at ${bpm} BPM`}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />
      </div>
    </div>
  );
}
