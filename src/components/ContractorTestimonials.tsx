import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, TrendingUp } from "lucide-react";

export const ContractorTestimonials = () => {
  const testimonials = [
    {
      quote: "We were missing 60% of after-hours calls. First month with RingSnap we booked 11 jobs we would've lost — that's $23,400 recovered in 30 days.",
      name: "Tommy Chen",
      business: "Tommy's Plumbing",
      location: "Austin, TX",
      metric: "+$23,400 MRR",
      metricLabel: "Monthly Revenue",
      avatar: "TC",
      trade: "Plumbing"
    },
    {
      quote: "HVAC emergencies at 2am, quote requests on Sundays — RingSnap handles them all. $31,000 captured in the first month. My dispatcher now only deals with jobs already booked.",
      name: "Sarah Martinez",
      business: "Arctic Heating & Cooling",
      location: "Denver, CO",
      metric: "+$31,000",
      metricLabel: "First Month",
      avatar: "SM",
      trade: "HVAC"
    },
    {
      quote: "I'm always on a ladder or in a panel box. Can't answer calls while I'm working. RingSnap books 127 jobs a month while I'm heads-down. My competitors are still going to voicemail.",
      name: "Mike Johnson",
      business: "Bolt Electric",
      location: "Phoenix, AZ",
      metric: "127 calls",
      metricLabel: "Booked/Month",
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
            Real numbers from real contractors in plumbing, HVAC, and electrical. No actors, no aggregated stats.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="card-tier-1">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Star Rating */}
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 sm:w-5 h-4 sm:h-5 fill-primary text-primary" />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-xs sm:text-sm leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>

                {/* Metric Badge */}
                <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-primary text-metric">{testimonial.metric}</div>
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
                    <div className="text-sm text-muted-foreground">{testimonial.business}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.location} · {testimonial.trade}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Bar */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-muted-foreground mb-4">Trusted by contractors across the US</p>
          <div className="flex flex-wrap justify-center gap-8 text-sm font-medium">
            <span>🔧 327 Plumbers</span>
            <span>❄️ 241 HVAC</span>
            <span>⚡ 189 Electricians</span>
            <span>🏠 90 Roofing</span>
          </div>
        </div>
      </div>
    </section>
  );
};
