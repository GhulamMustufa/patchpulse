"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { PRESET_PATIENTS } from "@/lib/necro-engine/patients";
import {
  ArrowLeft,
  Activity,
  ShieldCheck,
  Database,
  Cpu,
  AlertTriangle,
} from "lucide-react";

interface HealthSnapshot {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  integrations: {
    database: string;
    ai: string;
    github: string;
    sandbox: string;
  };
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthSnapshot>;
      })
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load health telemetry");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-[#070b14]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-200 hover:bg-slate-800">
              <ArrowLeft className="w-4 h-4 mr-1" /> Lab
            </Button>
          </Link>
          <span className="font-mono font-bold text-sm sm:text-base tracking-tight truncate">
            NecroCode System Telemetry
          </span>
          <Badge variant={health ? "success" : "secondary"} className="hidden sm:inline-flex">
            {health ? `Status: ${health.status}` : "Checking..."}
          </Badge>
        </div>

        <Link href="/docs">
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-200 hover:bg-slate-800">
            API Docs
          </Button>
        </Link>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-xs font-mono text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to reach /api/health: {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#070b14] border-slate-800 text-slate-100">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs text-slate-400">
                <span>AI Engine Mode</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </CardDescription>
              <CardTitle className="text-base font-mono text-slate-100">
                {health?.integrations.ai ?? "loading..."}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-[#070b14] border-slate-800 text-slate-100">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs text-slate-400">
                <span>Database Mode</span>
                <Database className="w-4 h-4 text-cyan-400" />
              </CardDescription>
              <CardTitle className="text-base font-mono text-slate-100">
                {health?.integrations.database ?? "loading..."}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-[#070b14] border-slate-800 text-slate-100">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs text-slate-400">
                <span>Execution Sandbox</span>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </CardDescription>
              <CardTitle className="text-base font-mono text-amber-300">
                {health?.integrations.sandbox ?? "syntax_only_phase_2"}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-[#070b14] border-slate-800 text-slate-100">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs text-slate-400">
                <span>Preset Patients</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </CardDescription>
              <CardTitle className="text-base font-mono text-emerald-400">
                {PRESET_PATIENTS.length} Seeded Subjects
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-[#070b14] border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-mono text-slate-100">
              Pre-Seeded Historical Subjects
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Reference repositories available for immediate 1-click inspection in the Operating Theatre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-800">
              {PRESET_PATIENTS.map((patient) => (
                <div
                  key={patient.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-medium text-sm text-slate-100">
                      {patient.name}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {patient.repoSlug} • Died {patient.deceasedYear}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {patient.language}
                    </Badge>
                    <Link href="/">
                      <Button size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                        Open in Lab
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
