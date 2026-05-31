import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, Quote } from "lucide-react";

export const ContractorTestimonials = () => {
  const testimonials = [
    {
      quote: "We were missing most of our after-hours calls. First month with RingSnap we booked jobs we would've lost — paid for itself in the first week.",
      name: "Tommy C.",
      tradeRegion: "Plumbing · Texas",
      metric: "Paid for itself in week 1",
      metricLabel: "Time to ROI",
      avatar: "TC",
      trade: "Plumbing"
    },
    {
      quote: "HVAC emergencies at 2am, quote requests on Sundays — RingSnap handles them all. My dispatcher now only deals with jobs already booked.",
      name: "Sarah M.",
      tradeRegion: "HVAC · Colorado",
      metric: "Zero missed calls",
      metricLabel: "After-hours coverage",
      avatar: "SM",
      trade: "HVAC"
    },
    {
      quote: "I'm always on a ladder or in a panel box — can't answer calls while I'm working. RingSnap books jobs while I'm heads-down. My competitors are still going to voicemail.",
      name: "Mike J.",
      tradeRegion: "Electrical · Arizona",
      metric: "Always-on coverage",
      metricLabel: "While on jobsite",
      avatar: "MJ",
      trade: "Electrical"
    }
  ];

  return (
    <section className="section-spacer bg-muted/30">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4">What contractors say after their first month</h2>
          <p className="text-body-default text-muted-foreground">
            Stories from plumbing, HVAC, and electrical contractors who switched from voicemail to RingSnap.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="card-tier-1">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Quote icon instead of star rating */}
                <Quote className="w-6 h-6 text-primary/40" aria-hidden="true" />

                {/* Quote */}
                <blockquote className="text-xs sm:text-sm leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>

                {/* Outcome Badge */}
                <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base sm:text-lg font-bold text-primary">{testimonial.metric}</div>
                      <div className="text-xs text-muted-foreground">{testimonial.metricLabel}</div>
                    </div>
                    <TrendingUp className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar className="border-2 border-primary">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {testimonial.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.tradeRegion}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-8">
          Representative customer outcomes. Individual results vary based on call volume, trade, and market.
        </p>
      </div>
    </section>
  );
};
