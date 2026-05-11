import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../hooks/use-toast";
import { 
  Mail, 
  Settings, 
  ShieldCheck, 
  Send, 
  Loader2, 
  Save, 
  Bell,
  MailCheck,
  FileText,
  FileCode2,
} from "lucide-react";

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["email-settings"],
    queryFn: () => api.get<any>("/settings/email"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch("/settings/email", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-settings"] });
      toast({ title: "Settings Saved", description: "Email configuration updated successfully." });
    },
    onError: (e: Error) => toast({ title: "Save Failed", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: (to: string) => api.post("/settings/email/test", { to }),
    onSuccess: () => toast({ title: "Test Email Sent", description: `Check ${testEmail} for the test message.` }),
    onError: (e: Error) => toast({ title: "Test Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    // Convert switch values
    data.useSsl = fd.get("useSsl") === "on";
    data.enabled = fd.get("enabled") === "on";
    saveMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Configuration</h1>
          <p className="text-muted-foreground">Manage SMTP settings and Google Docs document templates.</p>
        </div>
        <BadgeCheck className="h-10 w-10 text-primary/20" />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <CardTitle>SMTP Server Settings</CardTitle>
            </div>
            <CardDescription>Configure your outgoing mail server (SMTP) for system notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Allow the system to send automated emails.</p>
              </div>
              <Switch name="enabled" defaultChecked={settings?.enabled} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host</Label>
                <Input id="host" name="host" defaultValue={settings?.host} placeholder="smtp.gmail.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input id="port" name="port" type="number" defaultValue={settings?.port} placeholder="465 or 587" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user">Username / Email</Label>
                <Input id="user" name="user" defaultValue={settings?.user} placeholder="notifications@yourdomain.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Password</Label>
                <Input id="pass" name="pass" type="password" defaultValue={settings?.pass} placeholder="••••••••" />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch id="useSsl" name="useSsl" defaultChecked={settings?.useSsl} />
              <Label htmlFor="useSsl">Use SSL/TLS (Recommended for port 465)</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Sender Details</CardTitle>
            </div>
            <CardDescription>How the emails will appear in the candidate's inbox.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">Sender Name</Label>
              <Input id="fromName" name="fromName" defaultValue={settings?.fromName} placeholder="Sankara Academy of Vision" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Sender Email</Label>
              <Input id="fromEmail" name="fromEmail" defaultValue={settings?.fromEmail} placeholder="admissions@sankaraeye.com" required />
            </div>
          </CardContent>
        </Card>

        {/* Google Docs Template Integration */}
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Google Docs API Template</CardTitle>
            </div>
            <CardDescription>Generate professional PDF offer letters from a Google Doc template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="googleDocsTemplateId">Google Doc Template ID</Label>
              <Input 
                id="googleDocsTemplateId" 
                name="googleDocsTemplateId" 
                defaultValue={settings?.googleDocsTemplateId} 
                placeholder="1aBc2DeFgHiJkLmNoPqRsTuVwXyZ..." 
              />
              <p className="text-[10px] text-muted-foreground italic">
                The document must have placeholders like <strong>{`{{candidateName}}`}</strong>, <strong>{`{{specialization}}`}</strong>, etc.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="googleServiceAccountJson" className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-primary" />
                Service Account JSON
              </Label>
              <Textarea 
                id="googleServiceAccountJson" 
                name="googleServiceAccountJson" 
                defaultValue={settings?.googleServiceAccountJson} 
                placeholder='{ "type": "service_account", ... }'
                className="font-mono text-xs h-32"
              />
              <p className="text-[10px] text-muted-foreground">
                Paste the contents of your Google Cloud Service Account JSON file. Ensure the service account has access to the template doc.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-md sticky bottom-6 z-50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">Verify your settings before sending offers.</p>
          </div>
          <Button type="submit" size="lg" className="gap-2 px-10 font-black uppercase tracking-widest text-xs" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Configuration
          </Button>
        </div>
      </form>

      <Separator />

      <Card className="border-blue-100 bg-blue-50/20 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">Test Connection</CardTitle>
          </div>
          <CardDescription>Send a test email to verify your SMTP settings are correct.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input 
              placeholder="Enter recipient email..." 
              value={testEmail} 
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-md"
            />
            <Button 
              variant="secondary" 
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700 font-bold" 
              onClick={() => testMutation.mutate(testEmail)}
              disabled={!testEmail || testMutation.isPending}
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              Send Test Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeCheck({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
