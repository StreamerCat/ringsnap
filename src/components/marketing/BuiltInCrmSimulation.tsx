import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { capture } from "@/lib/analytics";
import {
  Phone,
  CheckCircle2,
  MapPin,
  Wrench,
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Send,
  Zap,
} from "lucide-react";

// ─── Simulation config (mock data only) ──────────────────────────────────────

const LEAD = {
  name: "Gary Rogers",
  initials: "GR",
  phone: "(512) 847-3291",
  location: "Austin, TX",
  service: "Water Heater — Leak",
  urgency: "Today",
  score: 92,
  tags: ["Emergency", "New Customer", "High Intent"] as const,
  nextAction: "Confirm same-day appointment",
  sms: "Thanks Gary, I can send a tech today to inspect the leak and provide solutions. Does 12 or 3 PM work better for you?",
};

const TRANSCRIPT = [
  { speaker: "AI",     text: "Thanks for calling — how can I help today?" },
  { speaker: "Caller", text: "My water heater is leaking and it's getting worse." },
  { speaker: "AI",     text: "How urgent? Are you seeing active water on the floor?" },
  { speaker: "Caller", text: "Yes — water on the floor right now. I need someone today." },
  { speaker: "AI",     text: "Got it. What's the service address?" },
  { speaker: "Caller", text: "4821 Shoal Creek Blvd, Austin." },
  { speaker: "AI",     text: "Is this your first time calling us?" },
  { speaker: "Caller", text: "Yes, first time." },
  { speaker: "AI",     text: "I can schedule a same-day tech. Does 12 or 3 PM work?" },
] as const;

// Visible transcript lines per step
const LINES_PER_STEP = [0, 4, 6, 8, 9] as const;

// Auto-advance durations per step (ms). 0 = final step, no auto-advance.
const STEP_DURATIONS = [2200, 3000, 2600, 2200, 0] as const;

const STEP_LABELS = [
  "Incoming Call",
  "AI Intake",
  "Qualification",
  "Booking",
  "Follow-up",
] as const;

const STATUS_PER_STEP = [
  "Open",
  "Open",
  "Open",
  "Appointment Requested",
  "Booked",
] as const;

// ─── Score ring (SVG, no deps) ────────────────────────────────────────────────

function ScoreRing({ value, max = 100, size = 52 }: { value: number; max?: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dashFill = (value / max) * circ;
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dashFill} ${circ}`}
        style={{ transition: "stroke-dasharray 80ms linear" }}
      />
    </svg>
  );
}

// ─── Main simulation component ────────────────────────────────────────────────

export function BuiltInCrmSimulation() {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const analyticsStartedRef = useRef(false);

  // Derive once — stable across renders, no re-renders needed.
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // Autoplay on first viewport entry
  useEffect(() => {
    if (hasAutoStarted) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAutoStarted(true);
          setIsPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAutoStarted]);

  // Analytics: fire once per session when simulation first plays
  useEffect(() => {
    if (isPlaying && !analyticsStartedRef.current) {
      analyticsStartedRef.current = true;
      capture("crm_simulation_view", {}, { dedupKey: "crm_sim_view", dedupWindowMs: 300_000 });
    }
  }, [isPlaying]);

  // Auto-advance steps
  useEffect(() => {
    if (!isPlaying || isHovered || step >= 4 || reducedMotion) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_DURATIONS[step]);
    return () => clearTimeout(t);
  }, [step, isPlaying, isHovered, reducedMotion]);

  // Score counter — rAF-driven, no setInterval jank
  useEffect(() => {
    if (step < 2) {
      setScoreDisplay(0);
      return;
    }
    if (reducedMotion) {
      setScoreDisplay(LEAD.score);
      return;
    }
    const startTime = performance.now();
    const dur = 1400;
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setScoreDisplay(Math.round(eased * LEAD.score));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, reducedMotion]);

  const goToStep = useCallback((n: number) => {
    setStep(n);
    capture("crm_simulation_step_change", {
      step: n,
      step_label: STEP_LABELS[n],
    });
  }, []);

  const handleReplay = useCallback(() => {
    setStep(0);
    setScoreDisplay(0);
    setIsPlaying(true);
    capture("crm_simulation_replay");
  }, []);

  const visibleLines = LINES_PER_STEP[step];
  const status = STATUS_PER_STEP[step];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="CRM lead capture simulation"
    >
      {/* Step progress dots + current label */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5" role="list" aria-label="Simulation steps">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              role="listitem"
              onClick={() => goToStep(i)}
              aria-label={`Go to step ${i + 1}: ${label}`}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                step === i
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          {STEP_LABELS[step]}
          {isPlaying && !isHovered && step < 4 && !reducedMotion && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse" />
          )}
        </span>
      </div>

      {/* Three-panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] border border-border/50 rounded-2xl overflow-hidden shadow-sm bg-white">

        {/* ── LEFT: Inbound Call / Transcript ────────────────────────────── */}
        <div className="border-b lg:border-b-0 lg:border-r border-border/30 bg-muted/20 flex flex-col">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300",
                step === 0 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              )}
            >
              <Phone className="w-3 h-3" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
              Inbound Call
            </span>
          </div>

          <div className="p-3 flex-1" style={{ minHeight: 240 }}>
            {step === 0 ? (
              /* Ringing state */
              <div className="flex flex-col items-center justify-center h-full gap-3 py-2">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  {!reducedMotion && (
                    <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping pointer-events-none" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Incoming call</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{LEAD.phone}</p>
                </div>
                <div className="w-full bg-white border border-border/40 rounded-xl p-3 text-left">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">
                    Caller ID
                  </p>
                  <p className="text-sm font-semibold text-foreground">{LEAD.name}</p>
                  <p className="text-xs text-muted-foreground">{LEAD.location}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{LEAD.service}</p>
                </div>
              </div>
            ) : (
              /* Transcript */
              <div className="space-y-1.5">
                {TRANSCRIPT.map((line, i) => {
                  const prevLines = step > 0 ? LINES_PER_STEP[step - 1] : 0;
                  const delayMs = reducedMotion
                    ? 0
                    : Math.max(0, (i - prevLines) * 90);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "transition-all duration-500",
                        i < visibleLines
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                      )}
                      style={{ transitionDelay: `${delayMs}ms` }}
                    >
                      <div
                        className={cn(
                          "rounded-xl px-2.5 py-1.5 text-xs leading-relaxed",
                          line.speaker === "AI"
                            ? "bg-primary/10 border border-primary/15 text-foreground"
                            : "bg-muted/50 border border-border/30 text-muted-foreground ml-3"
                        )}
                      >
                        <span
                          className={cn(
                            "font-semibold mr-1 text-[10px] uppercase tracking-wide",
                            line.speaker === "AI"
                              ? "text-primary"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {line.speaker === "AI" ? "AI" : "Gary"}
                        </span>
                        {line.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: CRM Lead Record ─────────────────────────────────────── */}
        <div className="border-b lg:border-b-0 lg:border-r border-border/30 bg-white flex flex-col">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
              CRM · Lead Record
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-500",
                status === "Booked"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : status === "Appointment Requested"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border/40"
              )}
            >
              {status}
            </span>
          </div>

          <div className="p-4">
            {/* Contact header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all duration-500",
                  step >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-75"
                )}
              >
                {LEAD.initials}
              </div>
              <div
                className={cn(
                  "transition-all duration-500",
                  step >= 1 ? "opacity-100" : "opacity-0"
                )}
              >
                <p className="font-semibold text-sm text-foreground">{LEAD.name}</p>
                <p className="text-xs text-muted-foreground">{LEAD.phone}</p>
              </div>
            </div>

            {/* CRM fields */}
            <div className="space-y-2 mb-4">
              {[
                { label: "Location", value: LEAD.location, Icon: MapPin },
                { label: "Service",  value: LEAD.service,  Icon: Wrench },
                { label: "Urgency",  value: LEAD.urgency,  Icon: Clock  },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-2 transition-all duration-500",
                    step >= 1 ? "opacity-100" : "opacity-0"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground w-14 flex-shrink-0">
                    {label}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            {/* Lead score + tags */}
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 mb-3",
                step >= 2
                  ? "opacity-100 bg-muted/20 border-border/30"
                  : "opacity-0 pointer-events-none border-transparent"
              )}
            >
              <div className="relative flex-shrink-0">
                <ScoreRing value={scoreDisplay} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">
                    {scoreDisplay}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Lead Score
                </p>
                <div className="flex flex-wrap gap-1">
                  {LEAD.tags.map((tag, i) => (
                    <span
                      key={tag}
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-300",
                        tag === "Emergency"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-primary/10 text-primary border-primary/20",
                        step >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-75"
                      )}
                      style={{
                        transitionDelay: reducedMotion ? "0ms" : `${500 + i * 100}ms`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Next action */}
            <div
              className={cn(
                "flex items-start gap-2 p-3 rounded-xl border transition-all duration-500 mb-3",
                step >= 3
                  ? "opacity-100 bg-primary/5 border-primary/20"
                  : "opacity-0 pointer-events-none border-transparent"
              )}
            >
              <Calendar className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">
                  Next Action
                </p>
                <p className="text-xs text-foreground">{LEAD.nextAction}</p>
              </div>
            </div>

            {/* Activity feed */}
            <div
              className={cn(
                "transition-all duration-500",
                step >= 4 ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Activity
              </p>
              {[
                { Icon: Phone,        text: "Call answered — intake logged" },
                { Icon: CheckCircle2, text: "Lead scored and tagged" },
                { Icon: Calendar,     text: "Same-day appointment requested" },
                { Icon: Send,         text: "SMS confirmation sent to Gary" },
              ].map(({ Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 text-xs mb-1.5">
                  <Icon className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{text}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/50">now</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Automation / Actions ────────────────────────────────── */}
        <div className="bg-muted/10 flex flex-col">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
              Automation
            </span>
          </div>

          <div className="p-3 flex-1 space-y-3">
            {/* Step 0: Listening */}
            {step === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <div className="flex gap-0.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full bg-muted-foreground/30",
                        !reducedMotion && "animate-bounce"
                      )}
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
                <span>Listening for calls…</span>
              </div>
            )}

            {/* Step 1+: Capturing */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                step >= 1 ? "max-h-16 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                  step === 1
                    ? "bg-primary/10 text-primary font-medium"
                    : "bg-muted/40 text-muted-foreground"
                )}
              >
                {step === 1 ? (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full bg-primary flex-shrink-0",
                      !reducedMotion && "animate-pulse"
                    )}
                  />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                )}
                Capturing lead data
              </div>
            </div>

            {/* Step 2+: Score bar */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-500",
                step >= 2 ? "max-h-40 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              <div className="p-3 rounded-xl bg-white border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Lead Score
                  </span>
                  <span className="text-sm font-bold text-primary">{scoreDisplay}/100</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${scoreDisplay}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {LEAD.tags.map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        tag === "Emergency"
                          ? "bg-red-50 text-red-600"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3+: Dispatch routing */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-500",
                step >= 3 ? "max-h-32 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              <div className="p-3 rounded-xl bg-white border border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Same-day dispatch
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Available today:</p>
                <div className="flex gap-2">
                  {["12 PM", "3 PM"].map((slot) => (
                    <span
                      key={slot}
                      className="text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium border border-primary/15"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 4: SMS + lead saved */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-500 space-y-2",
                step >= 4 ? "max-h-64 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
            >
              <div className="p-3 rounded-xl bg-white border border-border/40">
                <div className="flex items-center gap-2 mb-1.5">
                  <Send className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">SMS Sent</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-2 border border-border/20 italic">
                  "{LEAD.sms}"
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-medium text-emerald-700">Lead saved to CRM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between mt-3 px-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => step > 0 && goToStep(step - 1)}
          disabled={step === 0}
          className="h-8 px-3 text-xs rounded-full"
          aria-label="Previous step"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Prev
        </Button>

        <span className="text-xs text-muted-foreground">
          {step + 1} / {STEP_LABELS.length}
        </span>

        <div className="flex items-center gap-2">
          {step === 4 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              className="h-8 px-3 text-xs rounded-full"
              aria-label="Replay simulation"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Replay
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (step < 4 ? goToStep(step + 1) : handleReplay())}
            className="h-8 px-3 text-xs rounded-full"
            aria-label={step === 4 ? "Replay simulation" : "Next step"}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BuiltInCrmSimulation;
