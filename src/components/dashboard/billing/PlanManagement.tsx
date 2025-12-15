import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const PLANS = [
    { key: "starter", label: "Starter" },
    { key: "professional", label: "Professional" },
    { key: "premium", label: "Premium" },
];

export function PlanManagement({ account, onUpdate }: { account: any, onUpdate: () => void }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Derived current plan key
    const currentPlan = PLANS.find(p => p.key === account.plan_type) ? account.plan_type : 'starter';

    const handlePlanChange = async (newPlan: string) => {
        if (newPlan === currentPlan) return;

        if (!window.confirm(`Are you sure you want to switch to the ${newPlan} plan? Charges will be prorated.`)) return;

        setLoading(true);
        try {
            const { error } = await supabase.functions.invoke('stripe-subscription-update', {
                body: { account_id: account.id, plan_key: newPlan }
            });

            if (error) throw error;

            toast({ title: "Plan updated successfully" });
            onUpdate();
        } catch (error: any) {
            console.error(error);
            toast({ title: "Failed to update plan", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <Select value={currentPlan} onValueChange={handlePlanChange} disabled={loading}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent>
                    {PLANS.map(plan => (
                        <SelectItem key={plan.key} value={plan.key}>
                            {plan.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
    );
}
