import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, Users } from "lucide-react";

export const ObjectionHandling = () => {
  const objections = [
    {
      icon: AlertCircle,
      question: "What if customers don't like talking to AI?",
      answer: "89% of callers can't tell it's AI. The voice is natural, responsive, and industry-trained.",
      stat: "89%",
      statLabel: "can't tell it's AI"
    },
    {
      icon: Clock,
      question: "How fast can I get this running?",
      answer: "10 minutes. Forward your number, add your calendar link, and you're live. No training needed.",
      stat: "10 min",
      statLabel: "setup time"
    },
    {
      icon: Users,
      question: "Will I lose the personal touch?",
      answer: "You choose which calls transfer to you. VIP customers, complex jobs, or life-threatening emergencies always reach you directly.",
      stat: "100%",
      statLabel: "control retained"
    }
  ];

  return (
    <section className="section-spacer-compact bg-muted/30">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4">
            Common Questions <span style={{color: 'hsl(var(--primary))'}}>Answered</span>
          </h2>
          <p className="text-body-default">
            Real concerns from contractors like you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {objections.map((objection, index) => (
            <Card key={index} className="card-tier-3">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <objection.icon className="w-6 h-6 text-primary" />
                </div>
                
                <h3 className="font-bold text-base sm:text-lg">{objection.question}</h3>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {objection.answer}
                </p>
                
                <div className="pt-3 border-t">
                  <div className="text-2xl sm:text-3xl font-bold text-primary text-metric">
                    {objection.stat}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {objection.statLabel}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
