import { useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAdminStaffUsers } from "@/hooks/useAdminData";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type StaffRole = "platform_owner" | "platform_admin" | "support" | "viewer" | "sales";

const ROLE_LABELS: Record<string, string> = {
  platform_owner: "Platform Owner",
  platform_admin: "Platform Admin",
  support: "Support",
  viewer: "Viewer",
  sales: "Sales",
};

function RoleBadge({ role }: { role: string }) {
  if (role === "platform_owner") return <Badge className="bg-purple-900/60 text-purple-400 border border-purple-700/40 text-xs">{ROLE_LABELS[role]}</Badge>;
  if (role === "platform_admin") return <Badge className="bg-blue-900/60 text-blue-400 border border-blue-700/40 text-xs">{ROLE_LABELS[role]}</Badge>;
  if (role === "support") return <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 text-xs">{ROLE_LABELS[role]}</Badge>;
  if (role === "sales") return <Badge className="bg-amber-900/60 text-amber-400 border border-amber-700/40 text-xs">{ROLE_LABELS[role]}</Badge>;
  return <Badge className="bg-gray-800 text-gray-400 border border-gray-700 text-xs capitalize">{ROLE_LABELS[role] ?? role}</Badge>;
}

export function StaffTab() {
  const { data: users = [], isLoading, error } = useAdminStaffUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("viewer");
  const [addingUser, setAddingUser] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, role: StaffRole) => {
    setUpdatingUserId(userId);
    try {
      const { error } = await supabase.functions.invoke("manage-staff-role", {
        body: { target_user_id: userId, new_role: role },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
      toast({ title: "Role updated" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddStaff = async () => {
    if (!newEmail) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    setAddingUser(true);
    try {
      const { error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          email: newEmail,
          name: newName || newEmail.split("@")[0],
          role: newRole,
        },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
      toast({ title: "Staff member added", description: `Password reset email sent to ${newEmail}` });
      setAddDialogOpen(false);
      setNewEmail("");
      setNewName("");
      setNewRole("viewer");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add staff";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  if (error) {
    return (
      <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-4">
        <p className="text-red-400 text-sm">Failed to load staff users. You may need platform_owner access.</p>
      </div>
    );
  }

  const roleCounts = {
    platform_owner: users.filter((u) => u.role === "platform_owner").length,
    platform_admin: users.filter((u) => u.role === "platform_admin").length,
    support: users.filter((u) => u.role === "support").length,
    sales: users.filter((u) => u.role === "sales").length,
    viewer: users.filter((u) => u.role === "viewer").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Internal RingSnap team members and access roles</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-8 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-100">Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs uppercase tracking-wider">Email *</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@getringsnap.com"
                  className="bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs uppercase tracking-wider">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                  className="bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs uppercase tracking-wider">Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-gray-100">
                    {Object.entries(ROLE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddStaff}
                disabled={addingUser}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {addingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Staff Member
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role count summary */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {Object.entries(roleCounts).map(([role, count]) => (
          <div key={role} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
            <p className="text-xl font-bold font-mono text-gray-100">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{ROLE_LABELS[role]}</p>
          </div>
        ))}
      </div>

      {/* Staff table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {["Name", "Email", "Role", "Joined", "Change Role"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No staff members found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-200 font-medium">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.id, v as StaffRole)}
                      disabled={updatingUserId === user.id}
                    >
                      <SelectTrigger className="w-40 h-7 text-xs bg-gray-800 border-gray-700 text-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-gray-100">
                        {Object.entries(ROLE_LABELS).map(([v, label]) => (
                          <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
