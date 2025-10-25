import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, AlertTriangle, Clock, DollarSign, ShieldCheck, Zap, Lock } from "lucide-react";

export const CompetitorComparison = () => {
  // Updated comparison data - v2024
  const competitors = [
    { name: "RingSnap", highlight: true },
    { name: "CallRail", highlight: false },
    { name: "Hatch", highlight: false },
    { name: "ServiceTitan Voice", highlight: false },
    { name: "Call Center", highlight: false },
    { name: "Conversica", highlight: false },
    { name: "AnswerConnect", highlight: false },
    { name: "Voicemail", highlight: false },
  ];

  const criteria = [
    {
      name: "Voice realism",
      values: ["check", "warning", "warning", "check", "check", "warning", "check", "x"],
    },
    {
      name: "24/7 coverage",
      values: ["check", "check", "check", "check", "check", "check", "check", "x"],
    },
    {
      name: "Appointment booking",
      values: ["Automatic", "Manual", "Automatic", "Manual", "Manual", "Automatic", "Manual", "N/A"],
    },
    {
      name: "Emergency routing",
      values: ["Smart", "Basic", "Basic", "Smart", "Basic", "Basic", "Basic", "N/A"],
    },
    {
      name: "Setup time",
      values: ["10 min", "1-2 days", "1 day", "2-4 weeks", "1-2 weeks", "1 day", "1-2 days", "Instant"],
    },
    {
      name: "CRM flexibility",
      values: ["Any CRM", "Limited", "Limited", "Locked", "Any CRM", "Limited", "Any CRM", "N/A"],
    },
    {
      name: "Monthly cost",
      values: ["$297-1497", "$500-2000", "$600-1800", "$2000+", "$1500-3000", "$800-2500", "$800-2000", "Free"],
    },
    {
      name: "ROI speed",
      values: ["Days", "Weeks", "Weeks", "Months", "Months", "Weeks", "Weeks", "N/A"],
    },
    {
      name: "Scalability",
      values: ["Unlimited", "Per-user", "Per-user", "Caps", "Per-user", "Unlimited", "Per-user", "N/A"],
    },
    {
      name: "Reliability",
      values: ["99.9%", "95%", "95%", "99%", "Variable", "98%", "96%", "100%"],
    },
  ];

  const getIcon = (value: string) => {
    if (value === "check") return <Check className="w-5 h-5 text-primary mx-auto" />;
    if (value === "x") return <X className="w-5 h-5 text-destructive mx-auto" />;
    if (value === "warning") return <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto" />;
    return <span className="text-sm text-center block">{value}</span>;
  };

  return (
    <section className="section-spacer bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-6xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4">Why Contractors Choose RingSnap</h2>
          <p className="text-body-default">
            Compare features, pricing, and ROI across all major platforms
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block max-w-7xl mx-auto overflow-x-auto">
          <div className="card-tier-2 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="w-40 text-white font-bold">Feature</TableHead>
                  {competitors.map((comp, idx) => (
                    <TableHead
                      key={idx}
                      className={`text-center font-bold border-l bg-primary text-white`}
                      style={comp.highlight ? {} : {borderLeftColor: 'hsl(var(--charcoal) / 0.1)'}}
                    >
                      {comp.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((criterion, rowIdx) => (
                  <TableRow key={rowIdx} className="hover:bg-muted/30">
                    <TableCell className="font-medium" style={{color: 'hsl(var(--charcoal))'}}>
                      {criterion.name}
                    </TableCell>
                    {criterion.values.map((value, colIdx) => (
                      <TableCell
                        key={colIdx}
                        className={`text-center border-l ${
                          competitors[colIdx].highlight ? "bg-cream/30" : ""
                        }`}
                        style={{borderLeftColor: 'hsl(var(--charcoal) / 0.1)'}}
                      >
                        {value === "check" ? (
                          <Check className={`w-5 h-5 mx-auto ${
                            competitors[colIdx].highlight ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                        ) : value === "x" ? (
                          <X className="w-5 h-5 text-red-500 mx-auto" />
                        ) : value === "warning" ? (
                          <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto" />
                        ) : (
                          <span className="text-sm text-center block" style={{color: 'hsl(var(--charcoal) / 0.75)'}}>
                            {value}
                          </span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4 sm:space-y-6">
          {competitors.map((comp, idx) => (
            <Card key={idx} className={comp.highlight ? "card-tier-1 relative" : "card-tier-2"}>
              {comp.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                  YOUR SOLUTION
                </div>
              )}
              <CardHeader>
                <CardTitle className={comp.highlight ? "text-primary" : ""}>{comp.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                {criteria.map((criterion, critIdx) => {
                  const value = criterion.values[idx];
                  const isGood = value === "check" || (value !== "x" && value !== "warning" && value !== "N/A");
                  return (
                    <div key={critIdx} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="text-xs sm:text-sm font-medium">{criterion.name}</span>
                      <div className="flex items-center gap-2">
                        {value === "check" || value === "x" || value === "warning" ? (
                          getIcon(value)
                        ) : (
                          <span className={`text-xs sm:text-sm font-semibold px-2 py-1 rounded ${
                            isGood ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {value}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8 max-w-3xl mx-auto">
          Comparison based on publicly available info and typical SMB plans. Features and pricing may vary.
        </p>
      </div>
    </section>
  );
};
