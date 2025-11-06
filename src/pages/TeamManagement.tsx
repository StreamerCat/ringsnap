import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, UserPlus } from "lucide-react";

type AccountRole = 'owner' | 'admin' | 'member';

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: AccountRole;
  is_primary: boolean;
  created_at: string;
}

const TeamManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<AccountRole>('member');
  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Get user's account
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('id', user.id)
        .single();

      if (!profile?.account_id) {
        navigate('/dashboard');
        return;
      }

      setAccountId(profile.account_id);

      // Check if user is owner
      const { data: memberRole } = await supabase
        .from('account_members' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('account_id', profile.account_id)
        .single();

      setIsOwner((memberRole as any)?.role === 'owner');
      loadTeamMembers(profile.account_id);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    }
  };

  const loadTeamMembers = async (accountId: string) => {
    try {
      setLoading(true);

      // Get all members for this account
      const { data: members, error: membersError } = await supabase
        .from('account_members' as any)
        .select('user_id, role, created_at')
        .eq('account_id', accountId);

      if (membersError) throw membersError;

      // Get profiles for these members
      const userIds = members?.map((m: any) => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone, is_primary')
        .in('id', userIds);

      // Get auth users for emails
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

      // Combine data
      const teamMembersData: TeamMember[] = (members || []).map((member: any) => {
        const profile = profiles?.find((p: any) => p.id === member.user_id);
        const authUser = authUsers.find((u: any) => u.id === member.user_id);
        
        return {
          id: member.user_id,
          name: profile?.name || 'Unknown',
          phone: profile?.phone || '',
          email: authUser?.email || 'Unknown',
          role: member.role as AccountRole,
          is_primary: profile?.is_primary || false,
          created_at: member.created_at
        };
      });

      setTeamMembers(teamMembersData);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase.functions.invoke('manage-team-member', {
        body: {
          action: 'invite',
          email: inviteEmail,
          name: inviteName,
          phone: invitePhone,
          new_role: inviteRole
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member invited successfully",
      });

      setInviteDialogOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteRole('member');
      loadTeamMembers(accountId);
    } catch (error) {
      console.error('Error inviting member:', error);
      toast({
        title: "Error",
        description: "Failed to invite team member",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: AccountRole) => {
    try {
      const { error } = await supabase.functions.invoke('manage-team-member', {
        body: {
          action: 'update_role',
          target_user_id: userId,
          new_role: newRole
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });

      loadTeamMembers(accountId);
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: AccountRole) => {
    switch (role) {
      case 'owner': return "default";
      case 'admin': return "secondary";
      case 'member': return "outline";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Team Management</h1>
        {isOwner && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="ml-auto">
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
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+1234567890"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AccountRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Send Invitation
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Team Overview</h2>
        <p className="text-muted-foreground">Total Members: {teamMembers.length}</p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Phone</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Primary</th>
                <th className="text-left p-4">Joined</th>
                {isOwner && <th className="text-left p-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="p-4">{member.name}</td>
                  <td className="p-4">{member.email}</td>
                  <td className="p-4">{member.phone}</td>
                  <td className="p-4">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4">{member.is_primary ? 'Yes' : 'No'}</td>
                  <td className="p-4">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  {isOwner && (
                    <td className="p-4">
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value as AccountRole)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TeamManagement;
