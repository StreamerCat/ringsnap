
import { OperatorOverview } from "@/components/dashboard/OperatorOverview";

interface TodayTabProps {
    accountId: string;
}

export function TodayTab({ accountId }: TodayTabProps) {
    return (
        <div className="space-y-6">
            <OperatorOverview accountId={accountId} />
        </div>
    );
}
