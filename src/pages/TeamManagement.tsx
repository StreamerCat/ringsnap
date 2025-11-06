import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, UserPlus, Users as UsersIcon } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  is_primary: boolean;
  created_at: string;
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user"
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get profile and account
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        toast({
          title: "Error",
          description: "Profile not found",
          variant: "destructive"
        });
        navigate("/dashboard");
        return;
      }

      setAccountId(profile.account_id);

      // Check if user is owner
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      setIsOwner(!!roleData);

      await loadTeamMembers(profile.account_id);
    } catch (error) {
      console.error("Access check failed:", error);
      navigate("/login");
    }
  };

  const loadTeamMembers = async (accountId: string) => {
    try {
      // Get all profiles in this account
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone, is_primary, created_at")
        .eq("account_id", accountId);

      if (!profiles) {
        setTeamMembers([]);
        return;
      }

      // Get roles for each user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map(p => p.id));

      // Get emails from auth
      const members: TeamMember[] = [];
      for (const profile of profiles) {
        const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
        const userRole = roles?.find(r => r.user_id === profile.id);
        
        if (user) {
          members.push({
            id: profile.id,
            name: profile.name,
            phone: profile.phone,
            email: user.email || 'No email',
            role: userRole?.role || 'user',
            is_primary: profile.is_primary,
            created_at: profile.created_at
          });
        }
      }

      setTeamMembers(members);
    } catch (error) {
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

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: {
          action: 'invite',
          email: inviteForm.email,
          name: inviteForm.name,
          phone: inviteForm.phone,
          role: inviteForm.role
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member invited successfully"
      });

      setShowInviteDialog(false);
      setInviteForm({ name: "", email: "", phone: "", role: "user" });
      await loadTeamMembers(accountId);
    } catch (error: any) {
      console.error("Invite failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite team member",
        variant: "destructive"
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingMember(userId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-team-member', {
        body: {
          action: 'update_role',
          target_user_id: userId,
          new_role: newRole
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully"
      });

      await loadTeamMembers(accountId);
    } catch (error: any) {
      console.error("Role update failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive"
      });
    } finally {
      setUpdatingMember(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">Manage your team members and their roles</p>
          </div>
          {isOwner && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInviteMember} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={inviting}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Card */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </CardContent>
        </Card>

        {/* Team Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {isOwner && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.is_primary && (
                        <Badge variant="outline">Primary Contact</Badge>
                      )}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.id, value)}
                          disabled={updatingMember === member.id || member.is_primary}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
