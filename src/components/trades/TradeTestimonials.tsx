import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, TrendingUp } from "lucide-react";
import { TradeConfig } from "./tradeConfig";

interface TradeTestimonialsProps {
  config: TradeConfig;
}

export const TradeTestimonials = ({ config }: TradeTestimonialsProps) => {
  return (
    <section className="section-spacer bg-muted/30">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div 
            className="w-10 h-1 mx-auto mb-4 rounded-full"
            style={{ background: `hsl(${config.accentColor})` }}
          />
          <h2 className="text-h2 mb-4">
            Real {config.name} contractors see these results every day
          </h2>
          <p className="text-body-default text-muted-foreground">
            Proof before the pitch: {config.name.toLowerCase()} crews across the US rely on RingSnap to sound human, capture emergencies, and convert calls into booked jobs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {config.testimonials.map((testimonial, index) => (
            <Card key={index} className="card-tier-1">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Star Rating */}
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-4 sm:w-5 h-4 sm:h-5 fill-current"
                      style={{ color: `hsl(${config.accentColor})` }}
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-xs sm:text-sm leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>

                {/* Metric Badge */}
                <div 
                  className="p-3 sm:p-4 rounded-lg border"
                  style={{ 
                    background: `hsl(${config.accentColor} / 0.1)`,
                    borderColor: `hsl(${config.accentColor} / 0.2)`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div 
                        className="text-xl sm:text-2xl font-bold text-metric"
                        style={{ color: `hsl(${config.accentColor})` }}
                      >
                        {testimonial.metric}
                      </div>
                      <div className="text-xs text-muted-foreground">{testimonial.metricLabel}</div>
                    </div>
                    <TrendingUp 
                      className="w-6 sm:w-8 h-6 sm:h-8"
                      style={{ color: `hsl(${config.accentColor})` }}
                    />
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar 
                    className="border-2"
                    style={{ borderColor: `hsl(${config.accentColor})` }}
                  >
                    <AvatarFallback 
                      className="font-bold text-white"
                      style={{ background: `hsl(${config.accentColor})` }}
                    >
                      {testimonial.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.business}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.location}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust Bar */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Trusted by {config.stats.contractorCount}+ {config.name.toLowerCase()} contractors across the US
          </p>
          <div className="flex justify-center gap-4">
            <div className="px-6 py-3 rounded-full bg-white border shadow-sm">
              <div 
                className="text-2xl font-bold text-metric"
                style={{ color: `hsl(${config.accentColor})` }}
              >
                {config.stats.emergencyRate}
              </div>
              <div className="text-xs text-muted-foreground">are emergencies</div>
            </div>
            <div className="px-6 py-3 rounded-full bg-white border shadow-sm">
              <div 
                className="text-2xl font-bold text-metric"
                style={{ color: `hsl(${config.accentColor})` }}
              >
                ${config.stats.avgJobValue}
              </div>
              <div className="text-xs text-muted-foreground">avg job value</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
