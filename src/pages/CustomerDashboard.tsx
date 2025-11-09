import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { UsageWarningAlert } from "@/components/UsageWarningAlert";
import { PhoneNumberCard } from "@/components/PhoneNumberCard";
import { AssistantCard } from "@/components/AssistantCard";
import { CallRecordingConsentDialog } from "@/components/CallRecordingConsentDialog";
import { ReferralShareInterface } from "@/components/ReferralShareInterface";
import { 
  Phone, Users, Settings, CreditCard, Gift, TrendingUp, 
  Clock, AlertCircle, CheckCircle, Loader2, Sparkles, Check
} from "lucide-react";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [account, setAccount] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [accountCredits, setAccountCredits] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [recordingState, setRecordingState] = useState<any>(null);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      await loadDashboardData(user.id);
    } catch (error) {
      console.error("Auth check failed:", error);
      navigate("/login");
    }
  };

  const loadDashboardData = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, accounts(*)")
        .eq("id", userId)
        .single();

      if (!profileData || !profileData.accounts) {
        throw new Error("Profile or account not found");
      }

      setProfile(profileData);
      setAccount(profileData.accounts);

      const accountId = profileData.account_id;

      // Load phone numbers
      const { data: phonesData } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("account_id", accountId);
      setPhoneNumbers(phonesData || []);

      // Load assistants
      const { data: assistantsData } = await supabase
        .from("assistants")
        .select("*")
        .eq("account_id", accountId);
      setAssistants(assistantsData || []);

      // Load usage logs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: logsData } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("account_id", accountId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      setUsageLogs(logsData || []);

      // Load account credits
      const { data: creditsData } = await supabase
        .from("account_credits")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      setAccountCredits(creditsData || []);

      // Load referrals
      const { data: referralsData } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_account_id", accountId)
        .order("created_at", { ascending: false });
      setReferrals(referralsData || []);

      // Load referral code
      const { data: codeData } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("account_id", accountId)
        .single();
      if (codeData) setReferralCode(codeData.code);

      // Load custom instructions
      if (profileData.accounts.custom_instructions) {
        setCustomInstructions(profileData.accounts.custom_instructions);
      }

      // Load state recording laws if billing_state exists
      if (profileData.accounts.billing_state) {
        const { data: stateData } = await supabase
          .from("state_recording_laws")
          .select("*")
          .eq("state_code", profileData.accounts.billing_state)
          .single();
        setRecordingState(stateData);
      }

    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableRecording = async () => {
    try {
      const { error } = await supabase
        .from("accounts")
        .update({
          call_recording_enabled: true,
          call_recording_consent_accepted: true,
          call_recording_consent_date: new Date().toISOString()
        })
        .eq("id", account.id);

      if (error) throw error;

      setAccount({ ...account, call_recording_enabled: true });
      toast({
        title: "Recording Enabled",
        description: "Call recording has been enabled for your account"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const calculateUsagePercent = () => {
    if (!account) return 0;
    return Math.round((account.monthly_minutes_used / account.monthly_minutes_limit) * 100);
  };

  const calculateRemainingMinutes = () => {
    if (!account) return 0;
    return Math.max(0, account.monthly_minutes_limit - account.monthly_minutes_used);
  };

  const calculateTrialDaysRemaining = () => {
    if (!account || account.subscription_status !== 'trial') return 0;
    const endDate = new Date(account.trial_end_date);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getTotalCreditsBalance = () => {
    return accountCredits
      .filter(credit => credit.status === 'available')
      .reduce((sum, credit) => sum + credit.amount_cents, 0) / 100;
  };

  const getReferralStats = () => {
    const total = referrals.length;
    const converted = referrals.filter(r => r.status === 'converted').length;
    const creditsEarned = accountCredits
      .filter(c => c.source === 'referral')
      .reduce((sum, c) => sum + c.amount_cents, 0) / 100;
    return { total, converted, creditsEarned };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Account Setup in Progress</h2>
          <p className="text-muted-foreground">Your account is being set up. This usually takes a few seconds.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  const usagePercent = calculateUsagePercent();
  const remainingMinutes = calculateRemainingMinutes();
  const trialDaysRemaining = calculateTrialDaysRemaining();
  const creditsBalance = getTotalCreditsBalance();
  const referralStats = getReferralStats();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{account.company_name}</h1>
            <p className="text-muted-foreground">{profile.name} • {profile.phone}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button variant="outline" onClick={async () => {
              await supabase.auth.signOut();
              navigate("/");
            }}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Usage Warning */}
        {usagePercent >= 80 && (
          <div className="mb-6">
            <UsageWarningAlert
              usagePercent={usagePercent}
              remainingMinutes={remainingMinutes}
            />
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 lg:grid-cols-7 mb-8">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="phone-numbers">
              <Phone className="h-4 w-4 mr-2" />
              Phone Numbers
            </TabsTrigger>
            <TabsTrigger value="assistants">
              <Users className="h-4 w-4 mr-2" />
              Assistants
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="referrals">
              <Gift className="h-4 w-4 mr-2" />
              Referrals
            </TabsTrigger>
          </TabsList>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
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
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {account.monthly_minutes_used} / {account.monthly_minutes_limit}
                  </div>
                  <Progress value={usagePercent} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {usagePercent}% used this cycle
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calls This Month</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageLogs.length}</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {usageLogs.filter(l => l.appointment_booked).length} appointments booked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Account Status</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Badge variant={account.subscription_status === 'active' ? 'default' : 'secondary'}>
                    {account.subscription_status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {account.plan_type} plan
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {account.subscription_status === 'trial' ? 'Trial Days Left' : 'Credits Balance'}
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {account.subscription_status === 'trial' ? trialDaysRemaining : `$${creditsBalance.toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {account.subscription_status === 'trial' ? 'Upgrade to continue' : 'Available credits'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Calls Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
              </CardHeader>
              <CardContent>
                {usageLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No calls yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer Phone</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Outcome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageLogs.slice(0, 10).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{log.customer_phone || 'Unknown'}</TableCell>
                          <TableCell>{Math.ceil(log.call_duration_seconds / 60)} min</TableCell>
                          <TableCell>
                            {log.appointment_booked && (
                              <Badge variant="default">Appointment</Badge>
                            )}
                            {log.was_emergency && (
                              <Badge variant="destructive">Emergency</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phone Numbers Tab */}
          <TabsContent value="phone-numbers" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Your Phone Numbers</h2>
              <Button disabled={account.plan_type === 'starter'}>
                {account.plan_type === 'starter' ? 'Upgrade to Add Numbers' : 'Add Phone Number'}
              </Button>
            </div>

            {phoneNumbers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No phone numbers yet. Your number will appear here after provisioning.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {phoneNumbers.map((phone) => (
                  <PhoneNumberCard
                    key={phone.id}
                    number={phone.phone_number}
                    label={phone.label}
                    status={phone.status}
                    isPrimary={phone.is_primary}
                    linkedAssistant={phone.purpose}
                    onEdit={() => {}}
                    onSetPrimary={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Assistants Tab */}
          <TabsContent value="assistants" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Your AI Assistants</h2>
              <Button disabled={account.plan_type !== 'premium'}>
                {account.plan_type === 'premium' ? 'Add Assistant' : 'Premium Feature'}
              </Button>
            </div>

            {assistants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No assistants yet. Your assistant will appear here after setup.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assistants.map((assistant) => (
                  <AssistantCard
                    key={assistant.id}
                    name={assistant.name}
                    gender={assistant.voice_gender || 'female'}
                    status={assistant.status}
                    customInstructions={assistant.custom_instructions}
                    onEdit={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Assistant Customization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customInstructions">Custom Instructions</Label>
                  <Textarea
                    id="customInstructions"
                    placeholder="e.g., Always mention our 24/7 emergency service and family-owned status. Offer 10% discount for first-time customers."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={6}
                    maxLength={500}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className={customInstructions.length > 450 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
                      {customInstructions.length}/500 characters
                    </span>
                    <span className="text-muted-foreground text-xs">Updates take effect on next call</span>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    setSavingInstructions(true);
                    try {
                      const { error } = await supabase
                        .from('accounts')
                        .update({ custom_instructions: customInstructions })
                        .eq('id', account.id);
                      if (error) throw error;
                      setAccount({ ...account, custom_instructions: customInstructions });
                      toast({ title: "Success", description: "Custom instructions updated" });
                    } catch (error: any) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                    } finally {
                      setSavingInstructions(false);
                    }
                  }}
                  disabled={savingInstructions}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {savingInstructions ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save Instructions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call Recording</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.plan_type === 'starter' ? (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold mb-2">Upgrade to Pro or Premium</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Call recording is available on Professional and Premium plans
                    </p>
                    <Button size="sm">Upgrade Now</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Call Recording</Label>
                        <p className="text-sm text-muted-foreground">
                          Record all calls for quality and training
                        </p>
                      </div>
                      <Switch
                        checked={account.call_recording_enabled}
                        onCheckedChange={(checked) => {
                          if (checked && !account.call_recording_consent_accepted) {
                            setShowRecordingConsent(true);
                          }
                        }}
                      />
                    </div>
                    {recordingState && (
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        <p><strong>State:</strong> {recordingState.state_name}</p>
                        <p><strong>Consent Type:</strong> {recordingState.consent_type}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SMS Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!account.sms_enabled ? (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="font-semibold mb-2">SMS Not Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Contact support to enable SMS features
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Appointment Confirmations</Label>
                      <Switch checked={account.sms_appointment_confirmations} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Reminder Messages</Label>
                      <Switch checked={account.sms_reminders} />
                    </div>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="text-sm">
                        Daily Quota: {account.daily_sms_sent} / {account.daily_sms_quota}
                      </p>
                      <Progress 
                        value={(account.daily_sms_sent / account.daily_sms_quota) * 100} 
                        className="mt-2"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Service Area</Label>
                  <Input defaultValue={account.service_area} />
                </div>
                <div>
                  <Label>Emergency Policy</Label>
                  <Textarea defaultValue={account.emergency_policy} rows={4} />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg capitalize">{account.plan_type} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {account.monthly_minutes_limit} minutes/month
                      </p>
                    </div>
                    <Badge>{account.subscription_status}</Badge>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Included Minutes:</span>
                      <span>{account.monthly_minutes_used} / {account.monthly_minutes_limit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overage Minutes:</span>
                      <span>{account.overage_minutes_used}</span>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button>Upgrade Plan</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">${creditsBalance.toFixed(2)}</div>
                {accountCredits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No credits yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountCredits.slice(0, 10).map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell>
                            {new Date(credit.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="capitalize">{credit.source}</TableCell>
                          <TableCell>${(credit.amount_cents / 100).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={credit.status === 'available' ? 'default' : 'secondary'}>
                              {credit.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Referred</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{referralStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Converted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{referralStats.converted}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Credits Earned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${referralStats.creditsEarned.toFixed(2)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Share Interface */}
            <ReferralShareInterface
              referralCode={referralCode}
              accountId={account.id}
            />

            {/* Referral History */}
            <Card>
              <CardHeader>
                <CardTitle>Referral History</CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No referrals yet. Start sharing your link!
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Signup Date</TableHead>
                        <TableHead>Credit Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((referral) => (
                        <TableRow key={referral.id}>
                          <TableCell>{referral.referee_email || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={referral.status === 'converted' ? 'default' : 'secondary'}>
                              {referral.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(referral.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            ${(referral.referrer_credit_cents / 100).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Recording Consent Dialog */}
      {recordingState && (
        <CallRecordingConsentDialog
          open={showRecordingConsent}
          onOpenChange={setShowRecordingConsent}
          stateName={recordingState.state_name}
          consentType={recordingState.consent_type}
          notificationText={recordingState.notification_text}
          onAccept={handleEnableRecording}
        />
      )}
    </div>
  );
}
