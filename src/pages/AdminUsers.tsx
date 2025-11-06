import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, Shield, Users as UsersIcon } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  role: string;
  created_at: string;
  profile_name?: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

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

      // Check if user is owner
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "Only owners can access this page",
          variant: "destructive"
        });
        navigate("/admin/monitoring");
        return;
      }

      await loadUsers();
    } catch (error) {
      console.error("Access check failed:", error);
      navigate("/login");
    }
  };

  const loadUsers = async () => {
    try {
      // Get all users from auth.users via profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Combine data
      const usersWithRoles: UserWithRole[] = [];
      
      if (profiles) {
        for (const profile of profiles) {
          const userRole = roles?.find(r => r.user_id === profile.id);
          
          // Get email from auth metadata (requires additional query)
          const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
          
          if (user) {
            usersWithRoles.push({
              id: profile.id,
              email: user.email || 'No email',
              role: userRole?.role || 'none',
              created_at: user.created_at,
              profile_name: profile.name
            });
          }
        }
      }

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUser(userId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff-role', {
        body: {
          target_user_id: userId,
          new_role: newRole,
          action: newRole === 'none' ? 'remove' : 'update'
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully"
      });

      await loadUsers();
    } catch (error: any) {
      console.error("Role update failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive"
      });
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'user': return 'outline';
      default: return 'destructive';
    }
  };

  const getRoleCount = (role: string) => {
    return users.filter(u => u.role === role).length;
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
          <Button variant="ghost" onClick={() => navigate("/admin/monitoring")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Internal Staff Management</h1>
            <p className="text-muted-foreground">Manage RingSnap team access and roles</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Owners</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRoleCount('owner')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRoleCount('admin')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No Access</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRoleCount('none')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.profile_name || 'No name'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={updatingUser === user.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="none">No Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
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
