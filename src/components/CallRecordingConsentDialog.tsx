import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CallRecordingConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stateName: string;
  consentType: string;
  notificationText: string;
  onAccept: () => void;
}

export function CallRecordingConsentDialog({
  open,
  onOpenChange,
  stateName,
  consentType,
  notificationText,
  onAccept
}: CallRecordingConsentDialogProps) {
  const [checkedItems, setCheckedItems] = useState({
    location: false,
    understanding: false,
    notification: false
  });

  const allChecked = Object.values(checkedItems).every(Boolean);

  const handleAccept = () => {
    if (allChecked) {
      onAccept();
      onOpenChange(false);
      setCheckedItems({ location: false, understanding: false, notification: false });
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCheckedItems({ location: false, understanding: false, notification: false });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">
            Call Recording Consent Required
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base space-y-4 pt-4">
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <p className="font-semibold text-foreground mb-2">
                ⚠️ Important Legal Notice
              </p>
              <p className="text-foreground">
                Before enabling call recording, you must understand and comply with your state's recording laws.
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">State:</div>
                <div>{stateName}</div>
                <div className="font-semibold">Consent Type:</div>
                <div className="capitalize">{consentType}</div>
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-2">What this means:</p>
              <p className="text-foreground">
                {consentType === 'one-party' ? (
                  <>
                    <strong>One-party consent:</strong> You can record calls as long as you (your business) 
                    are a party to the conversation. However, you should still notify callers as a best practice.
                  </>
                ) : (
                  <>
                    <strong>Two-party consent:</strong> You must obtain explicit consent from all parties 
                    before recording. This typically means playing an announcement at the beginning of each call.
                  </>
                )}
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="font-semibold text-foreground">Required Notification:</p>
              <div className="bg-primary/5 p-3 rounded border border-primary/20">
                <p className="text-sm italic text-foreground">"{notificationText}"</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="location"
              checked={checkedItems.location}
              onCheckedChange={(checked) =>
                setCheckedItems(prev => ({ ...prev, location: checked as boolean }))
              }
            />
            <Label htmlFor="location" className="text-sm font-normal cursor-pointer">
              I confirm my business is located in <strong>{stateName}</strong> and I understand 
              the recording laws for this state.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="understanding"
              checked={checkedItems.understanding}
              onCheckedChange={(checked) =>
                setCheckedItems(prev => ({ ...prev, understanding: checked as boolean }))
              }
            />
            <Label htmlFor="understanding" className="text-sm font-normal cursor-pointer">
              I understand this state requires <strong>{consentType} consent</strong> for call recording 
              and I will comply with all applicable laws.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="notification"
              checked={checkedItems.notification}
              onCheckedChange={(checked) =>
                setCheckedItems(prev => ({ ...prev, notification: checked as boolean }))
              }
            />
            <Label htmlFor="notification" className="text-sm font-normal cursor-pointer">
              I will ensure proper notification is provided to all callers as shown above, 
              and I accept full responsibility for compliance.
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleAccept} disabled={!allChecked}>
            I Agree - Enable Recording
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
