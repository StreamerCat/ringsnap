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

type StaffRole = 'platform_owner' | 'platform_admin' | 'support' | 'viewer' | 'sales';

interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  name: string;
  phone: string;
  created_at: string;
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

      // Call edge function to get staff users
      const { data, error } = await supabase.functions.invoke('list-staff-users');

      if (error) throw error;

      setUsers(data.users || []);
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

      // Call edge function to create staff user
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email: newStaffEmail,
          name: newStaffName || newStaffEmail.split('@')[0],
          role: newStaffRole
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Staff member ${newStaffName || newStaffEmail} added. Password reset email sent to ${newStaffEmail}`,
      });

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

  const getRoleBadgeVariant = (role: StaffRole) => {
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
                        <SelectItem value="sales">Sales</SelectItem>
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
                  <td className="p-4">{user.name || '-'}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Select
                      value={user.role}
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
                            <SelectItem value="sales">Sales</SelectItem>
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
