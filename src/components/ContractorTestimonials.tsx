import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, TrendingUp } from "lucide-react";

export const ContractorTestimonials = () => {
  const metrics = [
    { value: "4.9", label: "out of 5", sublabel: "from 247 contractors", icon: "star" },
    { value: "<1 sec", label: "Answer time", sublabel: "Instant pickup", icon: "clock" },
    { value: "95%", label: "Call capture", sublabel: "vs your 55-60%", icon: "phone" }
  ];

  const testimonials = [
    {
      quote: "We went from missing 40% of after-hours calls to capturing 98%. That's an extra $23,400 in monthly revenue. The AI paid for itself in 3 days.",
      name: "Tommy Chen",
      business: "Tommy's Plumbing",
      location: "Austin, TX",
      metric: "+$23,400 MRR",
      metricLabel: "Monthly Revenue",
      avatar: "TC",
      trade: "Plumbing"
    },
    {
      quote: "Emergency HVAC calls come in when it's 95 degrees or 15 degrees—never during office hours. AI captured $31,000 worth of emergency repairs in the first month alone.",
      name: "Sarah Martinez",
      business: "Arctic Heating & Cooling",
      location: "Denver, CO",
      metric: "+$31,000",
      metricLabel: "First Month",
      avatar: "SM",
      trade: "HVAC"
    },
    {
      quote: "I'm always on a ladder or in a panel box. AI books 127 emergency calls while I work. My competitor is still missing calls—I'm not.",
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
        
        {/* Ratings Strip */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mb-8 sm:mb-12 p-4 sm:p-6 bg-white rounded-2xl border elevation-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <Star className="w-6 sm:w-8 h-6 sm:h-8 fill-primary text-primary" />
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-metric">4.9</div>
              <div className="text-xs sm:text-sm text-slate-600">out of 5</div>
            </div>
          </div>
          
          <div className="h-8 sm:h-12 w-px bg-slate-200 hidden sm:block" />
          
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-metric">247</div>
            <div className="text-xs sm:text-sm text-slate-600">Contractors</div>
          </div>
          
          <div className="h-8 sm:h-12 w-px bg-slate-200 hidden sm:block" />
          
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-primary text-metric">&lt;1s</div>
            <div className="text-xs sm:text-sm text-slate-600">Answer time</div>
          </div>
          
          <div className="h-8 sm:h-12 w-px bg-slate-200 hidden sm:block" />
          
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-primary text-metric">95%</div>
            <div className="text-xs sm:text-sm text-slate-600">Capture rate</div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4">Real Results from Real Contractors</h2>
          <p className="text-body-default">
            847 plumbers, HVAC techs, electricians, and roofers capture 95% of emergency calls with AI
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
