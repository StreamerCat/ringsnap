import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StaffRole = 'platform_owner' | 'platform_admin' | 'support' | 'viewer';

interface StaffUser {
  id: string;
  email: string;
  role: StaffRole | null;
  created_at: string;
  profile_name?: string;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('viewer');

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

      // Check if user is platform owner
      const { data: staffRole } = await supabase
        .from('staff_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'platform_owner')
        .single();

      if (!staffRole) {
        navigate('/login');
        return;
      }

      loadUsers();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Get all staff roles with user info
      const { data: staffRoles, error: rolesError } = await supabase
        .from('staff_roles' as any)
        .select('user_id, role, created_at');

      if (rolesError) throw rolesError;

      // Get auth users and profiles for these staff members
      const userIds = staffRoles?.map((r: any) => r.user_id) || [];
      
      const { data: { users: authUsers }, error: usersError } = await supabase.auth.admin.listUsers();
      if (usersError) throw usersError;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      // Combine data
      const staffUsers: StaffUser[] = (staffRoles || []).map((staffRole: any) => {
        const authUser = authUsers.find((u: any) => u.id === staffRole.user_id);
        const profile = profiles?.find((p: any) => p.id === staffRole.user_id);
        
        return {
          id: staffRole.user_id,
          email: authUser?.email || 'Unknown',
          role: staffRole.role as StaffRole,
          created_at: staffRole.created_at,
          profile_name: profile?.name
        };
      });

      setUsers(staffUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load staff users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: StaffRole) => {
    try {
      setUpdatingUser(userId);

      const { data, error } = await supabase.functions.invoke('manage-staff-role', {
        body: { target_user_id: userId, new_role: newRole }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff role updated successfully",
      });

      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update staff role",
        variant: "destructive",
      });
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleAddStaff = async () => {
    try {
      if (!newStaffEmail || !newStaffRole) {
        toast({
          title: "Error",
          description: "Email and role are required",
          variant: "destructive",
        });
        return;
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: newStaffEmail,
        email_confirm: true,
        user_metadata: { name: newStaffName }
      });

      if (createError) throw createError;

      // Create staff role
      const { error: roleError } = await supabase
        .from('staff_roles' as any)
        .insert({
          user_id: newUser.user.id,
          role: newStaffRole
        });

      if (roleError) throw roleError;

      // Optionally create profile (without account_id)
      if (newStaffName) {
        await supabase
          .from('profiles')
          .insert({
            id: newUser.user.id,
            name: newStaffName,
            phone: '',
            account_id: null
          });
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(newStaffEmail, {
        redirectTo: `${window.location.origin}/onboarding`
      });

      if (resetError) {
        console.error("Failed to send password reset email:", resetError);
        toast({
          title: "Warning",
          description: `Staff member added, but failed to send password reset email. Please send manually.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Staff member ${newStaffName || newStaffEmail} added. Password reset email sent to ${newStaffEmail}`,
        });
      }

      setAddDialogOpen(false);
      setNewStaffEmail('');
      setNewStaffName('');
      setNewStaffRole('viewer');
      loadUsers();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: StaffRole | null) => {
    if (!role) return "secondary";
    switch (role) {
      case 'platform_owner': return "default";
      case 'platform_admin': return "default";
      case 'support': return "secondary";
      case 'viewer': return "outline";
      default: return "secondary";
    }
  };

  const getRoleCount = (role: StaffRole) => {
    return users.filter(u => u.role === role).length;
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/monitoring')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">RingSnap Staff Management</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="staff@getringsnap.com"
                />
              </div>
              <div>
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={newStaffRole} onValueChange={(value) => setNewStaffRole(value as StaffRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_owner">Platform Owner</SelectItem>
                    <SelectItem value="platform_admin">Platform Admin</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddStaff} className="w-full">
                Add Staff Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Staff</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Platform Owners</div>
          <div className="text-2xl font-bold">{getRoleCount('platform_owner')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Admins</div>
          <div className="text-2xl font-bold">{getRoleCount('platform_admin')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Support</div>
          <div className="text-2xl font-bold">{getRoleCount('support')}</div>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Current Role</th>
                <th className="text-left p-4">Joined</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="p-4">{user.profile_name || '-'}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role?.replace('_', ' ').toUpperCase() || 'No Role'}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Select
                      value={user.role || 'viewer'}
                      onValueChange={(value) => handleRoleChange(user.id, value as StaffRole)}
                      disabled={updatingUser === user.id}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="platform_owner">Platform Owner</SelectItem>
                        <SelectItem value="platform_admin">Platform Admin</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminUsers;
