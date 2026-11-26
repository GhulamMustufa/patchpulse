"useclient";

import React, { useEffect, useRef } from "react";
import { VitalState } from "@/lib/necro-engine/types";
import { Activity, Skull, Zap, Heart } from "lucide-react";

interface ECGMonitorProps {
  vitalState: VitalState;
  bpm: number;
  patientName: string;
}

export function ECGMonitor({ vitalState, bpm, patientName }: ECGMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      // Clear with dark gothic CRT background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, width, height);

      // Draw faint cyber grid
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

      // Determine wave style based on Vital State
      let strokeColor = "#ef4444"; // DEAD flatline red
      let glowColor = "rgba(239, 68, 68, 0.6)";

      if (vitalState === "RESURRECTING") {
        strokeColor = "#f59e0b"; // Defibrillating amber
        glowColor = "rgba(245, 158, 11, 0.6)";
      } else if (vitalState === "ALIVE") {
        strokeColor = "#10b981"; // Vibrant emerald green
        glowColor = "rgba(16, 185, 129, 0.8)";
      }

      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();

      const wavePeriod = vitalState === "ALIVE" ? 140 : 200;

      for (let x = 0; x < width; x++) {
        const localPos = (x + offset) % wavePeriod;
        let y = midY;

        if (vitalState === "DEAD") {
          // Flatline with tiny micro-electrical noise
          y = midY + (Math.random() - 0.5) * 1.5;
        } else if (vitalState === "RESURRECTING") {
          // Irregular defibrillating ventricular spasms
          if (localPos > 20 && localPos < 35) {
            y = midY - 25 * Math.sin(((localPos - 20) / 15) * Math.PI);
          } else if (localPos > 70 && localPos < 95) {
            y = midY + 30 * Math.sin(((localPos - 70) / 25) * Math.PI);
          } else {
            y = midY + (Math.sin(x * 0.05 + offset * 0.1) * 3);
          }
        } else {
          // ALIVE: Pristine normal sinus rhythm (P wave, QRS complex, T wave)
          if (localPos >= 0 && localPos < 20) {
            // Baseline
            y = midY;
          } else if (localPos >= 20 && localPos < 35) {
            // P wave
            y = midY - 8 * Math.sin(((localPos - 20) / 15) * Math.PI);
          } else if (localPos >= 35 && localPos < 42) {
            // PR segment
            y = midY;
          } else if (localPos >= 42 && localPos < 46) {
            // Q dip
            y = midY + 6;
          } else if (localPos >= 46 && localPos < 54) {
            // R spike (peak)
            y = midY - 48;
          } else if (localPos >= 54 && localPos < 58) {
            // S dip
            y = midY + 12;
          } else if (localPos >= 58 && localPos < 70) {
            // ST segment
            y = midY;
          } else if (localPos >= 70 && localPos < 95) {
            // T wave
            y = midY - 14 * Math.sin(((localPos - 70) / 25) * Math.PI);
          } else {
            // Isoelectric line
            y = midY;
          }
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Draw sweeping scanner beam
      const scanX = (width - (offset % width)) % width;
      const gradient = ctx.createLinearGradient(scanX - 30, 0, scanX, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
      gradient.addColorStop(1, glowColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(Math.max(0, scanX - 30), 0, 30, height);

      offset += vitalState === "ALIVE" ? 3.5 : vitalState === "RESURRECTING" ? 5 : 0.8;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [vitalState]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#070b14] p-4 shadow-2xl">
      {/* Top telemetry bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
            {vitalState === "DEAD" && <Skull className="h-4 w-4 text-rose-500 animate-pulse" />}
            {vitalState === "RESURRECTING" && <Zap className="h-4 w-4 text-amber-400 animate-bounce" />}
            {vitalState === "ALIVE" && <Heart className="h-4 w-4 text-emerald-400 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                Patient Subject:
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200">
                {patientName}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Lead II Electrocardiogram • Continuous AST Cardiac Monitor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
              vitalState === "DEAD"
                ? "bg-rose-950/40 border-rose-800/60 text-rose-400"
                : vitalState === "RESURRECTING"
                ? "bg-amber-950/40 border-amber-700/60 text-amber-300"
                : "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                vitalState === "DEAD"
                  ? "bg-rose-500 animate-ping"
                  : vitalState === "RESURRECTING"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            {vitalState === "DEAD" && "FLATLINE (SYNTAX EXTINCT)"}
            {vitalState === "RESURRECTING" && "DEFIBRILLATING AST..."}
            {vitalState === "ALIVE" && "VITAL SIGNS RESTORED"}
          </div>

          {/* Heart rate metric */}
          <div className="flex items-baseline gap-1 text-right">
            <span
              className={`font-mono text-2xl font-bold tracking-tight ${
                vitalState === "DEAD"
                  ? "text-rose-500"
                  : vitalState === "RESURRECTING"
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {bpm}
            </span>
            <span className="font-mono text-xs text-slate-400">BPM</span>
          </div>
        </div>
      </div>

      {/* Canvas Oscilloscope */}
      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-slate-800/80 bg-[#090d16]">
        <canvas
          ref={canvasRef}
          width={800}
          height={112}
          className="h-full w-full object-cover"
        />

        {/* Overlay CRT scanlines effect */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px]" />
      </div>
    </div>
  );
}
