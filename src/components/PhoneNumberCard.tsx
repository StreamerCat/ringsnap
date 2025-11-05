import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Edit2, Star } from "lucide-react";

interface PhoneNumberCardProps {
  number: string;
  label?: string;
  status: string;
  isPrimary: boolean;
  linkedAssistant?: string;
  onEdit: () => void;
  onSetPrimary?: () => void;
}

export function PhoneNumberCard({
  number,
  label,
  status,
  isPrimary,
  linkedAssistant,
  onEdit,
  onSetPrimary
}: PhoneNumberCardProps) {
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Card className="card-tier-2 hover:shadow-lg transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-bold text-lg">{formatPhoneNumber(number)}</div>
              {label && <div className="text-sm text-muted-foreground">{label}</div>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>
              {status}
            </Badge>
          </div>

          {linkedAssistant && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Assistant</span>
              <span className="text-sm font-medium">{linkedAssistant}</span>
            </div>
          )}

          {isPrimary && (
            <div className="flex items-center gap-1 text-primary mt-3">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-semibold">Primary Number</span>
            </div>
          )}

          {!isPrimary && onSetPrimary && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={onSetPrimary}
            >
              Set as Primary
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
