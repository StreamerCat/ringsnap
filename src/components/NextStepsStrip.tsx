import { ArrowRightCircle, Calculator, Headphones } from "lucide-react";

const steps = [
  {
    icon: Headphones,
    title: "Hear the AI",
    description: "Run the 60-second live demo to feel the call quality.",
    anchor: "#demo",
  },
  {
    icon: Calculator,
    title: "See your ROI",
    description: "Drop in call volume to quantify the revenue RingSnap recovers.",
    anchor: "#calculator",
  },
  {
    icon: ArrowRightCircle,
    title: "Start your trial",
    description: "Flip it on in 10 minutes and never miss a high-intent call again.",
    anchor: "#pricing",
  },
];

export const NextStepsStrip = () => (
  <section className="bg-primary/5">
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">Here’s what to do next</p>
          <h3 className="text-xl sm:text-2xl font-semibold text-charcoal mt-2">
            Follow the 3-step path contractors use to switch in under a week.
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 w-full sm:w-auto">
          {steps.map((step) => (
            <a
              key={step.title}
              href={step.anchor}
              className="group rounded-2xl border border-primary/20 bg-white/80 p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <step.icon className="h-4 w-4" aria-hidden="true" />
                {step.title}
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed group-hover:text-charcoal">
                {step.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default NextStepsStrip;
