
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function TeamTab() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Team Management</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        Manage your team members and their access levels.
                    </p>
                    <Button onClick={() => navigate("/dashboard/team")}>
                        Go to Team Management
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
