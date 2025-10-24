import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, AlertTriangle } from "lucide-react";

export const CompetitorComparison = () => {
  const [selectedCompetitor, setSelectedCompetitor] = useState("CallRail");

  const competitors = [
    { name: "You", highlight: true },
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

  const getIconSmall = (value: string) => {
    if (value === "check") return <Check className="w-4 h-4 text-primary" />;
    if (value === "x") return <X className="w-4 h-4 text-destructive" />;
    if (value === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <span className="text-xs font-semibold">{value}</span>;
  };

  return (
    <section className="py-10 sm:py-14 lg:py-20 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-6xl mx-auto text-center mb-8 sm:mb-12">
          <h2 className="text-fluid-h2 font-bold mb-3 sm:mb-4 leading-tight">How We Stack Up</h2>
          <p className="text-fluid-body text-muted-foreground leading-relaxed">
            Compare features, pricing, and ROI across all major platforms
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block max-w-7xl mx-auto overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Feature</TableHead>
                {competitors.map((comp, idx) => (
                  <TableHead
                    key={idx}
                    className={`text-center ${comp.highlight ? "bg-emerald-50 border-2 border-emerald-500 font-bold" : ""}`}
                  >
                    {comp.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((criterion, rowIdx) => (
                <TableRow key={rowIdx}>
                  <TableCell className="font-medium">{criterion.name}</TableCell>
                  {criterion.values.map((value, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={`text-center ${competitors[colIdx].highlight ? "bg-emerald-50/50" : ""}`}
                    >
                      {getIcon(value)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Side-by-Side Comparison */}
        <div className="lg:hidden space-y-6">
          <Tabs defaultValue="CallRail" value={selectedCompetitor} onValueChange={setSelectedCompetitor} className="w-full">
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7 mb-6 h-auto">
              {competitors.filter(c => !c.highlight).map((comp) => (
                <TabsTrigger
                  key={comp.name}
                  value={comp.name}
                  className="text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {comp.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {competitors.filter(c => !c.highlight).map((comp, compIdx) => {
              const actualIdx = competitors.findIndex(c => c.name === comp.name);
              return (
                <TabsContent key={comp.name} value={comp.name} className="mt-0">
                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Your Solution Column */}
                    <Card className="border-2 border-emerald-500 elevation-3">
                      <CardHeader className="pb-3">
                        <div className="text-center">
                          <div className="inline-block px-2 py-1 bg-primary text-primary-foreground text-xs font-bold rounded mb-2">
                            YOUR SOLUTION
                          </div>
                          <CardTitle className="text-base sm:text-lg text-primary">You</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 px-3">
                        {criteria.map((criterion, critIdx) => {
                          const yourValue = criterion.values[0];
                          return (
                            <div key={critIdx} className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">{criterion.name}</div>
                              <div className="flex items-center justify-center min-h-[28px] p-1 rounded bg-primary/5">
                                {getIconSmall(yourValue)}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    {/* Competitor Column */}
                    <Card className="border elevation-1">
                      <CardHeader className="pb-3">
                        <div className="text-center">
                          <div className="h-6 mb-2"></div>
                          <CardTitle className="text-base sm:text-lg">{comp.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 px-3">
                        {criteria.map((criterion, critIdx) => {
                          const competitorValue = criterion.values[actualIdx];
                          const yourValue = criterion.values[0];
                          const isBetter = (yourValue === "check" && competitorValue !== "check") ||
                                          (yourValue !== "x" && competitorValue === "x");
                          return (
                            <div key={critIdx} className="space-y-1">
                              <div className="text-xs font-medium text-muted-foreground">{criterion.name}</div>
                              <div className={`flex items-center justify-center min-h-[28px] p-1 rounded ${
                                isBetter ? 'bg-destructive/5' : 'bg-muted/50'
                              }`}>
                                {getIconSmall(competitorValue)}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8 max-w-3xl mx-auto">
          Comparison based on publicly available info and typical SMB plans. Features and pricing may vary.
        </p>
      </div>
    </section>
  );
};
