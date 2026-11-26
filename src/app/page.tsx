"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Zap, ArrowRight, ShieldCheck, Cpu, Code2, Sparkles, Layers, Activity, BookOpen } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
              ⚡
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-foreground">
              Hackathon Engine
            </span>
            <Badge variant="success" className="hidden sm:inline-flex">
              ● Ready to Demo
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/docs">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
                <BookOpen className="w-4 h-4 mr-1.5" /> Docs
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                Direct Dashboard
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Hero & Skim Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 max-w-5xl mx-auto w-full text-center">
        {/* Hackathon Badge Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <Badge variant="sponsor" className="px-3 py-1">
            🏆 Official Hackathon Submission
          </Badge>
          <Badge variant="purple" className="px-3 py-1">
            ✨ Autonomous AI Core
          </Badge>
        </div>

        {/* High-Skim Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight lead-tight max-w-4xl text-foreground">
          Autonomous Speed for{" "}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-purple-300">
            Real-Time Execution
          </span>
        </h1>

        {/* Low-Fatigue 2-Line Subheading */}
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Zero login walls. Zero cold-starts. Experience instant multimodal reasoning, pre-seeded production data, and verifiable sponsor integrations.
        </p>

        {/* The 1-Click Guest Demo Bypass Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="glow" size="lg" className="w-full sm:w-auto px-5 sm:px-8 py-3.5 text-sm sm:text-base font-semibold">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
              <span>⚡ Explore Live Interactive Demo</span>
              <ArrowRight className="w-4 h-4 ml-1 shrink-0" />
            </Button>
          </Link>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Pre-authenticated guest session for judges • Instant execution in &lt; 200ms
        </p>

        {/* 3 Skimmable Metric & Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-16 w-full text-left">
          <Card className="glass">
            <CardHeader className="pb-3">
              <Cpu className="w-6 h-6 text-primary mb-2" />
              <CardTitle className="text-base">Autonomous Reasoning</CardTitle>
              <CardDescription className="text-xs">
                Multimodal agent with structured schema verification and real-time tool calling.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-3">
              <Activity className="w-6 h-6 text-emerald-500 mb-2" />
              <CardTitle className="text-base">Sub-50ms Response Speed</CardTitle>
              <CardDescription className="text-xs">
                Serverless database pooling combined with streaming edge runtime responses.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-3">
              <ShieldCheck className="w-6 h-6 text-purple-500 mb-2" />
              <CardTitle className="text-base">Verifiable Integration</CardTitle>
              <CardDescription className="text-xs">
                Complete SPONSORS.md document with line-by-line source code links for judges.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Interactive Deep-Dive Tabs (For Curious Judges) */}
        <div className="mt-16 w-full text-left">
          <Tabs defaultValue="architecture" className="w-full">
            <div className="flex justify-center mb-6">
              <TabsList>
                <TabsTrigger value="architecture">System Architecture</TabsTrigger>
                <TabsTrigger value="bounties">Bounty Stacking Plan</TabsTrigger>
                <TabsTrigger value="testing">Automated Tests</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="architecture">
              <Card className="glass p-6">
                <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Full-Stack Production Topology
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Engineered with Next.js 15 App Router, Tailwind CSS with HSL design tokens, Neon serverless Postgres, and streaming AI agents. Zero client-side bloat, full type-safety.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="bounties">
              <Card className="glass p-6">
                <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Multi-Track Alignment
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Simultaneously qualifies for Grand Prize + Sponsor Category Bounties with dedicated file proofs in <code>SPONSORS.md</code>.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="testing">
              <Card className="glass p-6">
                <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" /> E2E Smoke & Unit Tests
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pre-configured with Playwright E2E and Vitest unit testing suites. Run <code>npm test</code> to verify all core pipelines before submitting.
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 px-4 text-center text-xs text-muted-foreground">
        Built with the Top 1% Hackathon Blueprint • Production Grade • MIT License
      </footer>
    </div>
  );
}
