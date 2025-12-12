import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Users, UserPlus, Trash2, Shield, Loader2 } from "lucide-react";

interface TeamMember {
    id: string;
    user_id: string;
    role: string;
    profiles: {
        name: string;
        email: string;
        phone?: string;
    };
}

interface TeamTabProps {
    accountId: string;
}

export function TeamTab({ accountId }: TeamTabProps) {
    const { toast } = useToast();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [inviting, setInviting] = useState(false);

    // Invite form state
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [invitePhone, setInvitePhone] = useState("");
    const [inviteRole, setInviteRole] = useState("member");

    // Load team members
    const loadMembers = async () => {
        try {
            const { data, error } = await supabase
                .from("account_members")
                .select(`
          id,
          user_id,
          role,
          profiles (
            name,
            email,
            phone
          )
        `)
                .eq("account_id", accountId)
                .order("role", { ascending: true });

            if (error) throw error;
            setMembers(data as any || []);
        } catch (error: any) {
            console.error("Failed to load team members:", error);
            toast({
                title: "Error",
                description: "Failed to load team members",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Fixed: was incorrectly using useState instead of useEffect
    useEffect(() => {
        loadMembers();
    }, [accountId]);

    const handleInviteMember = async () => {
        if (!inviteEmail || !inviteName) {
            toast({
                title: "Validation Error",
                description: "Email and name are required",
                variant: "destructive"
            });
            return;
        }

        setInviting(true);
        try {
            const { data, error } = await supabase.functions.invoke("manage-team-member", {
                body: {
                    action: "invite",
                    email: inviteEmail,
                    name: inviteName,
                    phone: invitePhone,
                    new_role: inviteRole
                }
            });

            if (error) throw error;

            toast({
                title: "Success",
                description: `Invitation sent to ${inviteEmail}`
            });

            setShowInviteDialog(false);
            setInviteEmail("");
            setInviteName("");
            setInvitePhone("");
            setInviteRole("member");
            loadMembers();
        } catch (error: any) {
            console.error("Failed to invite member:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to send invitation",
                variant: "destructive"
            });
        } finally {
            setInviting(false);
        }
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase.functions.invoke("manage-team-member", {
                body: {
                    action: "update_role",
                    target_user_id: userId,
                    new_role: newRole
                }
            });

            if (error) throw error;

            toast({
                title: "Success",
                description: "Role updated successfully"
            });

            loadMembers();
        } catch (error: any) {
            console.error("Failed to update role:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to update role",
                variant: "destructive"
            });
        }
    };

    const handleRemoveMember = async (userId: string, memberName: string) => {
        if (!window.confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
            return;
        }

        try {
            // Note: manage-team-member doesn't have a remove action yet
            // For now, we'll update the role to 'removed' or delete directly
            const { error } = await supabase
                .from("account_members")
                .delete()
                .eq("user_id", userId)
                .eq("account_id", accountId);

            if (error) throw error;

            toast({
                title: "Success",
                description: `${memberName} removed from team`
            });

            loadMembers();
        } catch (error: any) {
            console.error("Failed to remove member:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to remove member",
                variant: "destructive"
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Team Management</h2>
                    <p className="text-muted-foreground">Manage team members and their access levels</p>
                </div>
                <Button onClick={() => setShowInviteDialog(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Member
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Team Members ({members.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No team members yet</p>
                            <p className="text-sm mt-2">Invite team members to collaborate on your account</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                            {member.profiles?.name || "Unknown"}
                                        </TableCell>
                                        <TableCell>{member.profiles?.email || "N/A"}</TableCell>
                                        <TableCell>{member.profiles?.phone || "N/A"}</TableCell>
                                        <TableCell>
                                            {member.role === "owner" ? (
                                                <Badge variant="default" className="gap-1">
                                                    <Shield className="h-3 w-3" />
                                                    Owner
                                                </Badge>
                                            ) : (
                                                <Select
                                                    value={member.role}
                                                    onValueChange={(value) => handleChangeRole(member.user_id, value)}
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="member">Member</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {member.role !== "owner" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveMember(member.user_id, member.profiles?.name)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Invite Dialog */}
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation to a new team member. They'll receive an email with login instructions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="invite-email">Email *</Label>
                            <Input
                                id="invite-email"
                                type="email"
                                placeholder="member@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invite-name">Name *</Label>
                            <Input
                                id="invite-name"
                                placeholder="John Doe"
                                value={inviteName}
                                onChange={(e) => setInviteName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invite-phone">Phone (optional)</Label>
                            <Input
                                id="invite-phone"
                                type="tel"
                                placeholder="+1 (555) 123-4567"
                                value={invitePhone}
                                onChange={(e) => setInvitePhone(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="invite-role">Role</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                <SelectTrigger id="invite-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleInviteMember} disabled={inviting}>
                            {inviting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                "Send Invitation"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
