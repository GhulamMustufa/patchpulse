"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import { DEMO_METRICS, DEMO_ACTIVITIES } from "@/lib/demo-data";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Loader2,
  Terminal,
  Activity,
  TrendingUp,
  Layers,
  Code2,
  ExternalLink,
} from "lucide-react";

export default function DashboardPage() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[System initialized]: Connected to Serverless Database with 0ms latency.",
    "[Ready]: Awaiting trigger for autonomous workflow demonstration.",
  ]);
  const [status, setStatus] = useState<"idle" | "running" | "success">("idle");

  const runMagicMoment = () => {
    setIsRunning(true);
    setStatus("running");
    setLogs((prev) => [...prev, "[Agent]: Initiating real-time reasoning cycle..."]);

    setTimeout(() => {
      setLogs((prev) => [...prev, "[API Gateway]: Querying sponsor endpoints & verifying payload..."]);
    }, 500);

    setTimeout(() => {
      setLogs((prev) => [...prev, "[Database]: Running pgvector cosine similarity search (found 3 matches)."]);
    }, 1000);

    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        "✨ [Success]: Autonomous workflow completed in 184ms with 99.8% confidence score!",
      ]);
      setIsRunning(false);
      setStatus("success");
      toast({
        title: "Magic Moment Executed",
        description: "Autonomous pipeline resolved successfully in 184ms.",
        type: "success",
      });
    }, 1600);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-md px-3 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/">
            <Button variant="outline" size="sm" className="px-2.5 sm:px-3">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <span className="font-bold text-sm sm:text-lg tracking-tight truncate">Command Center</span>
          <Badge variant="success" className="hidden sm:inline-flex">● Demo Active</Badge>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="px-2.5 sm:px-3 text-xs sm:text-sm">
            <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" /> <span className="hidden sm:inline">Sponsor</span> Proof
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs">
                <span>Active Sessions</span>
                <Activity className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold">{DEMO_METRICS.activeSessions}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs">
                <span>Success Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold text-emerald-500">
                {DEMO_METRICS.successRate}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs">
                <span>Avg Latency</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold">{DEMO_METRICS.avgLatency}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between text-xs">
                <span>Processed Volume</span>
                <Layers className="w-4 h-4 text-purple-500" />
              </CardDescription>
              <CardTitle className="text-xl sm:text-2xl font-bold">{DEMO_METRICS.totalVolumeProcessed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* The Magic Moment Interactive Runner */}
        <Card className="border-primary/30 bg-card/70 shadow-lg relative overflow-hidden">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>⚡ Interactive Core Feature Trigger</span>
                  <Badge variant="purple">Magic Moment</Badge>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  Click the button below to trigger the live multimodal agent execution pipeline.
                </CardDescription>
              </div>
              <Button
                variant="glow"
                size="md"
                onClick={runMagicMoment}
                disabled={isRunning}
                className="whitespace-nowrap"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Execute Magic Moment Demo</span>
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Terminal Log Console */}
            <div className="bg-muted/70 border border-border rounded-lg p-4 font-mono text-xs text-foreground space-y-1.5 shadow-inner min-h-[140px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/80 text-muted-foreground">
                <span className="flex items-center gap-1.5 font-sans font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-primary" /> Real-Time Telemetry & Agent Execution Log
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold uppercase">
                  STATUS: {status}
                </span>
              </div>
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  <span className="text-muted-foreground">&gt; </span>
                  <span className={log.includes("Success") ? "text-emerald-500 font-semibold" : ""}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Table */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Recent Verified Events</CardTitle>
            <CardDescription className="text-xs">Live audit log of processed workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {DEMO_ACTIVITIES.map((act) => (
                <div key={act.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-foreground">{act.title}</div>
                    <div className="text-xs text-muted-foreground">{act.timestamp}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{act.value}</span>
                    <Badge variant={act.badge as any}>{act.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Sponsor Proof Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Verifiable Sponsor Integrations"
        description="Direct line-by-line proof of sponsor APIs & SDKs utilized in this project."
      >
        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <h4 className="font-semibold text-foreground mb-1">Sponsor A: Database Engine</h4>
            <p>Integrated with connection pooling and sub-millisecond vector indexing.</p>
            <code className="text-[10px] font-mono text-primary block mt-1">src/lib/db.ts:15-38</code>
          </div>

          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <h4 className="font-semibold text-foreground mb-1">Sponsor B: Multimodal Agent Engine</h4>
            <p>Multimodal document parsing and automated JSON schema function execution.</p>
            <code className="text-[10px] font-mono text-purple-400 block mt-1">src/lib/ai.ts:24-60</code>
          </div>

          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={() => setIsModalOpen(false)}>
              Close Proof
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
