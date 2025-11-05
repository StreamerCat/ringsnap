import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, UserCircle2, Edit2 } from "lucide-react";

interface AssistantCardProps {
  name: string;
  gender: string;
  status: string;
  phoneNumber?: string;
  customInstructions?: string;
  onEdit: () => void;
}

export function AssistantCard({
  name,
  gender,
  status,
  phoneNumber,
  customInstructions,
  onEdit
}: AssistantCardProps) {
  const getAvatar = () => {
    if (gender === 'female') {
      return <UserCircle2 className="h-8 w-8 text-primary" />;
    }
    return <User className="h-8 w-8 text-primary" />;
  };

  return (
    <Card className="card-tier-2 hover:shadow-lg transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {getAvatar()}
            </div>
            <div>
              <div className="font-bold text-lg">{name}</div>
              <div className="text-sm text-muted-foreground capitalize">{gender} Voice</div>
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

          {phoneNumber && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Phone</span>
              <span className="text-sm font-medium">{phoneNumber}</span>
            </div>
          )}

          {customInstructions && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Custom Instructions</div>
              <div className="text-sm line-clamp-2">{customInstructions}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
