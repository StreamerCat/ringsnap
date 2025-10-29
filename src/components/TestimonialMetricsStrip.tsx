import { Star } from "lucide-react";

const metricChips = [
  { value: "4.9", label: "out of 5", helper: "247 contractors reviewed" },
  { value: "<1s", label: "Answer time", helper: "Average speed to pickup" },
  { value: "95%", label: "Capture rate", helper: "Calls secured vs. voicemail" },
];

export const TestimonialMetricsStrip = () => (
  <section className="bg-muted/30">
    <div className="container mx-auto px-4 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-left">
          <div className="rounded-full bg-white p-3 shadow-sm">
            <Star className="w-6 h-6 text-primary fill-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">Proven with contractors</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-charcoal">
              "RingSnap feels like our best receptionist—on every call."
            </h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-center sm:divide-x sm:divide-slate-200">
          {metricChips.map((metric) => (
            <div key={metric.value} className="text-center px-2 sm:px-6">
              <div className="text-2xl font-bold text-metric">{metric.value}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-xs text-muted-foreground/80">{metric.helper}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default TestimonialMetricsStrip;
