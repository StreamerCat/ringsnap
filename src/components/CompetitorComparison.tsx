import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X } from "lucide-react";

export const CompetitorComparison = () => {
  const competitors = [
    { name: "RingSnap", highlight: true },
    { name: "CallRail", highlight: false },
    { name: "Hatch", highlight: false },
    { name: "Call Center", highlight: false },
    { name: "Voicemail", highlight: false },
  ];

  const criteria = [
    {
      name: "Voice realism",
      values: ["check", "warning", "warning", "check", "x"],
    },
    {
      name: "Setup time",
      values: ["10 min", "1-2 days", "1 day", "1-2 weeks", "Instant"],
    },
    {
      name: "Monthly cost",
      values: ["$297+", "$500+", "$600+", "$1500+", "Free"],
    },
    {
      name: "24/7 coverage",
      values: ["check", "check", "check", "check", "x"],
    },
    {
      name: "Appointment booking",
      values: ["Auto", "Manual", "Auto", "Manual", "x"],
    },
    {
      name: "Emergency routing",
      values: ["Smart", "Basic", "Basic", "Basic", "x"],
    },
  ];

  const getIcon = (value: string) => {
    if (value === "check") return <Check className="w-5 h-5 text-primary mx-auto" />;
    if (value === "x") return <X className="w-5 h-5 text-red-500 mx-auto" />;
    if (value === "warning") return <span className="text-yellow-500 mx-auto block text-center">~</span>;
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
            Quick comparison of the top solutions
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block max-w-5xl mx-auto overflow-x-auto">
          <div className="card-tier-2 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="w-40 text-white font-bold">Feature</TableHead>
                  {competitors.map((comp, idx) => (
                    <TableHead
                      key={idx}
                      className={`text-center font-bold border-l text-white ${
                        comp.highlight ? 'bg-primary' : 'bg-primary/90'
                      }`}
                      style={{borderLeftColor: 'hsl(var(--charcoal) / 0.1)'}}
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
                          <span className="text-yellow-500 mx-auto block text-center text-lg">~</span>
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

        {/* Mobile - Horizontal Scroll Table */}
        <div className="md:hidden overflow-x-auto -mx-4 px-4">
          <div className="card-tier-2 min-w-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-white font-bold text-xs sticky left-0 bg-primary z-10">Feature</TableHead>
                  {competitors.map((comp, idx) => (
                    <TableHead
                      key={idx}
                      className={`text-center font-bold text-xs border-l text-white ${
                        comp.highlight ? 'bg-primary' : 'bg-primary/90'
                      }`}
                      style={{borderLeftColor: 'hsl(var(--charcoal) / 0.1)'}}
                    >
                      {comp.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {criteria.map((criterion, rowIdx) => (
                  <TableRow key={rowIdx}>
                    <TableCell className="font-medium text-xs sticky left-0 bg-white z-10" style={{color: 'hsl(var(--charcoal))'}}>
                      {criterion.name}
                    </TableCell>
                    {criterion.values.map((value, colIdx) => (
                      <TableCell
                        key={colIdx}
                        className={`text-center border-l text-xs ${
                          competitors[colIdx].highlight ? "bg-cream/30" : ""
                        }`}
                        style={{borderLeftColor: 'hsl(var(--charcoal) / 0.1)'}}
                      >
                        {value === "check" ? (
                          <Check className={`w-4 h-4 mx-auto ${
                            competitors[colIdx].highlight ? 'text-primary' : 'text-muted-foreground'
                          }`} />
                        ) : value === "x" ? (
                          <X className="w-4 h-4 text-red-500 mx-auto" />
                        ) : value === "warning" ? (
                          <span className="text-yellow-500 mx-auto block text-center">~</span>
                        ) : (
                          <span className="text-xs text-center block" style={{color: 'hsl(var(--charcoal) / 0.75)'}}>
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
          <p className="text-xs text-center text-muted-foreground mt-2">← Swipe to compare →</p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6 max-w-3xl mx-auto">
          Based on publicly available pricing and features
        </p>
      </div>
    </section>
  );
};
