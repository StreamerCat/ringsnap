import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, Phone, Check, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { carrierData } from "@/lib/carrierData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CarrierForwardingInstructionsProps {
  phoneNumber: string;
  companyName?: string;
}

export const CarrierForwardingInstructions = ({ 
  phoneNumber, 
  companyName 
}: CarrierForwardingInstructionsProps) => {
  const [selectedCarrier, setSelectedCarrier] = useState("default");
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [showConditional, setShowConditional] = useState(false);

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const formatCode = (code: string) => {
    return code.replace("[your RingSnap number]", phoneNumber);
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopiedNumber(true);
    toast.success("Phone number copied to clipboard!");
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyInstructions = () => {
    const instructions = carrierData[selectedCarrier];
    let text = `📞 Forward Your Business Phone to RingSnap\n\n`;
    text += `Your RingSnap Number: ${formatPhone(phoneNumber)}\n\n`;
    text += `${instructions.name} Instructions:\n\n`;
    
    instructions.steps.forEach((step, index) => {
      text += `${index + 1}. ${step.title}\n`;
      text += `   ${step.content}\n`;
      if (step.code) {
        text += `   Code: ${formatCode(step.code)}\n`;
      }
      if (step.details) {
        step.details.forEach(detail => {
          text += `   • ${detail}\n`;
        });
      }
      text += `\n`;
    });

    if (instructions.notes) {
      text += `Note: ${instructions.notes}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedInstructions(true);
    toast.success("Instructions copied to clipboard!");
    setTimeout(() => setCopiedInstructions(false), 2000);
  };

  const currentInstructions = carrierData[selectedCarrier];

  return (
    <div className="space-y-6">
      {/* Phone Number Hero */}
      <Card className="border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-cream/30">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="default" className="animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
              Active
            </Badge>
          </div>
          <CardTitle className="text-2xl sm:text-3xl mb-2">Your RingSnap Phone Number</CardTitle>
          <CardDescription className="text-base">Forward your business line to this number</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 pb-6">
          <div className="text-5xl sm:text-6xl lg:text-7xl font-bold text-primary tracking-wide">
            {formatPhone(phoneNumber)}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              size="lg"
              onClick={handleCopyNumber}
              className="h-12 px-6 text-base font-semibold"
            >
              {copiedNumber ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-5 w-5" />
                  Copy Number
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 px-6 text-base font-semibold border-2"
            >
              <a href={`tel:${phoneNumber}`}>
                <Phone className="mr-2 h-5 w-5" />
                Call Now to Test
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Carrier Selector */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Select Your Phone Carrier
          </CardTitle>
          <CardDescription>
            Choose your carrier for specific forwarding instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
            <SelectTrigger className="w-full h-14 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">I don't know my carrier / Not listed</SelectItem>
              <SelectItem value="att">AT&T</SelectItem>
              <SelectItem value="verizon">Verizon</SelectItem>
              <SelectItem value="tmobile">T-Mobile</SelectItem>
              <SelectItem value="uscellular">U.S. Cellular</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Instructions Panel */}
      <Card className="shadow-md border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{currentInstructions.name}</CardTitle>
            {currentInstructions.activateCode && (
              <Badge variant="secondary" className="font-mono text-sm">
                {currentInstructions.activateCode}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentInstructions.steps.map((step, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-base">{step.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.content}</p>
                  {step.code && (
                    <div className="bg-charcoal text-green-400 px-4 py-3 rounded-lg font-mono text-sm overflow-x-auto">
                      {formatCode(step.code)}
                    </div>
                  )}
                  {step.details && step.details.length > 0 && (
                    <ul className="space-y-1.5 mt-2">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {index < currentInstructions.steps.length - 1 && (
                <div className="border-b border-border/50 ml-11" />
              )}
            </div>
          ))}

          {currentInstructions.conditionalOptions && (
            <Collapsible open={showConditional} onOpenChange={setShowConditional}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="font-semibold">Advanced: Conditional Forwarding Options</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showConditional ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-4">
                {currentInstructions.conditionalOptions.map((option, idx) => (
                  <div key={idx} className="bg-muted p-4 rounded-lg">
                    <h5 className="font-semibold text-sm mb-2">{option.label}</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Activate: </span>
                        <code className="bg-charcoal text-green-400 px-2 py-1 rounded">
                          {formatCode(option.activate + phoneNumber + '#')}
                        </code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Deactivate: </span>
                        <code className="bg-charcoal text-green-400 px-2 py-1 rounded">
                          {option.deactivate}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {currentInstructions.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> {currentInstructions.notes}
              </p>
            </div>
          )}

          <Button
            onClick={handleCopyInstructions}
            variant="outline"
            size="lg"
            className="w-full mt-4 h-12 font-semibold"
          >
            {copiedInstructions ? (
              <>
                <Check className="mr-2 h-5 w-5" />
                Instructions Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-5 w-5" />
                Copy These Instructions
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
