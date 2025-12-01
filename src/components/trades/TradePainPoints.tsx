import { AlertTriangle } from "lucide-react";
import { TradeConfig } from "./tradeConfig";

interface TradePainPointsProps {
  config: TradeConfig;
}

export const TradePainPoints = ({ config }: TradePainPointsProps) => {
  return (
    <section className="section-spacer" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div 
            className="w-10 h-1 mx-auto mb-4 rounded-full"
            style={{ background: `hsl(${config.accentColor})` }}
          />
          <h2 className="text-h2 mb-4">{config.painPoints.title}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {config.painPoints.items.map((item, index) => (
            <div 
              key={index} 
              className="card-tier-2 space-y-4 hover:shadow-xl transition-all"
            >
              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-full flex-shrink-0"
                  style={{ background: `hsl(${config.accentColor} / 0.1)` }}
                >
                  <AlertTriangle 
                    className="w-6 h-6"
                    style={{ color: `hsl(${config.accentColor})` }}
                  />
                </div>
                <div className="flex-1">
                  <div 
                    className="text-4xl font-bold mb-2 text-metric"
                    style={{ color: `hsl(${config.accentColor})` }}
                  >
                    {item.stat}
                  </div>
                  <p className="text-base font-medium text-foreground mb-3">
                    {item.problem}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    {item.emotion}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-lg text-muted-foreground mb-4">
            The average {config.name.toLowerCase()} contractor misses{" "}
            <span 
              className="font-bold"
              style={{ color: `hsl(${config.accentColor})` }}
            >
              23 calls per month
            </span>
            {" "}worth{" "}
            <span 
              className="font-bold"
              style={{ color: `hsl(${config.accentColor})` }}
            >
              ${(config.stats.avgJobValue * 23).toLocaleString()}
            </span>
            . RingSnap captures them all.
          </p>
        </div>
      </div>
    </section>
  );
};
