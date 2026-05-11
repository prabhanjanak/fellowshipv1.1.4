import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Loader2,
  Users,
  Monitor,
  Clock,
  DoorOpen,
  UserCheck,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function QueueDisplayPage() {
  const [time, setTime] = useState(new Date());
  const [isVerified, setIsVerified] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("tv_verified");
    if (stored === "true") setIsVerified(true);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode) return;
    setVerifying(true);
    setError("");
    try {
      const res = await api.post("/tv-access/verify", { code: accessCode });
      if (res.data?.success) {
        setIsVerified(true);
        sessionStorage.setItem("tv_verified", "true");
      }
    } catch (e: any) {
      setError(e.response?.data?.error || "Invalid access code");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: panels = [], isLoading: isLoadingPanels } = useQuery({
    queryKey: ["display-live"],
    queryFn: () => api.get<any[]>("/display/live"),
    refetchInterval: 5000, // Refresh every 5 seconds for live feel
    enabled: isVerified,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["batches"],
    queryFn: () => api.get<any[]>("/batches"),
    enabled: isVerified,
  });

  const activeBatch = batches.find((b: any) => b.isActive) || { name: "FP-JUL-2026", academicYear: "2026-27" };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" />
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative z-10">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto bg-white p-3 rounded-2xl w-24 h-24 flex items-center justify-center shadow-lg shadow-black/50">
              <img src="/logo.png" alt="SAV Logo" className="w-16 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <CardTitle className="text-2xl font-black text-white tracking-tight">Waiting Hall Display</CardTitle>
            <p className="text-sm text-slate-400 font-medium">Please enter the 6-character access code to authorize this display.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="space-y-2">
                <Input
                  autoFocus
                  type="text"
                  placeholder="e.g. A7K2P9"
                  maxLength={6}
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); setError(""); }}
                  className="bg-slate-950 border-slate-800 h-14 text-center text-3xl font-black tracking-[0.25em] text-white uppercase placeholder:text-slate-700 focus-visible:ring-primary/50"
                />
                {error && <p className="text-red-400 text-xs font-bold text-center mt-2">{error}</p>}
              </div>
              <Button type="submit" disabled={verifying || accessCode.length < 6} className="w-full h-12 text-base font-black tracking-widest uppercase">
                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize Display"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingPanels) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-6">
           <div className="bg-white p-2 rounded-2xl">
             <img src="/logo.png" alt="SAV Logo" className="h-16 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
           </div>
           <div>
            <div className="flex items-center gap-3 text-primary mb-1">
              <Monitor className="h-8 w-8" />
              <h1 className="text-4xl font-black uppercase tracking-tighter">Interview Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary text-white font-black px-3 py-1 text-lg">{activeBatch.name}</Badge>
              <p className="text-slate-400 text-xl font-medium">
                Academic Year {activeBatch.academicYear} — Sankara Academy of Vision
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-7xl font-black tracking-tighter tabular-nums text-emerald-400 leading-none">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-slate-500 font-bold uppercase tracking-widest mt-2 text-lg">
            {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-hidden">
        {panels.map((panel: any) => {
          const currentCandidate = panel.current;
          const waitingQueue = panel.nextQueue || [];
          
          return (
            <Card key={panel.panelId} className={`bg-slate-900 border-2 shadow-2xl overflow-hidden relative flex flex-col ${currentCandidate ? 'border-primary/50' : 'border-slate-800'}`}>
              {panel.isActive && (
                <div className="absolute top-4 right-4 z-10">
                   <Badge className="bg-emerald-500 text-slate-950 animate-pulse font-black text-sm px-3">LIVE</Badge>
                </div>
              )}
              
              <CardHeader className="bg-slate-800/50 border-b border-slate-700 p-6">
                <CardTitle className="flex items-center gap-4 text-3xl font-black">
                  <div className="bg-primary text-white h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-primary/20 shrink-0">
                    {panel.roomNumber}
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-0.5">Interview Panel</div>
                    <div className="truncate text-2xl">{panel.panelName}</div>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                {/* Now Interviewing */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm uppercase tracking-widest">
                    <UserCheck className="h-5 w-5" /> Now Interviewing
                  </div>
                  <div className={`rounded-3xl p-6 border transition-all duration-500 ${currentCandidate ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-800/50 border-slate-700'}`}>
                    {currentCandidate ? (
                      <div className="space-y-2 text-center">
                        <div className="text-5xl font-black text-white tracking-tight break-words">{currentCandidate.candidateCode}</div>
                        <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                          PLEASE ENTER ROOM
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl font-black text-slate-600 italic py-4 text-center">ROOM VACANT</div>
                    )}
                  </div>
                </div>

                {/* Next In Line */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-sm uppercase tracking-widest">
                    <Zap className="h-5 w-5" /> Next In Queue
                  </div>
                  <div className="space-y-3">
                    {waitingQueue.slice(0, 3).map((candidate: any, i: number) => (
                      <div key={candidate.candidateCode} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${i === 0 ? 'bg-amber-400/10 border-amber-400/30' : 'bg-slate-800/30 border-slate-800'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-black ${i === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-400'}`}>
                            {i + 1}
                          </div>
                          <div className={`font-mono text-2xl font-black ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {candidate.candidateCode}
                          </div>
                        </div>
                        {i === 0 && <Badge className="bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5">READY</Badge>}
                      </div>
                    ))}
                    {waitingQueue.length === 0 && (
                      <div className="text-slate-600 font-bold text-center py-6 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                        NO CANDIDATES WAITING
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer / Ticker */}
      <div className="fixed bottom-0 left-0 right-0 bg-primary p-4 overflow-hidden">
        <div className="flex items-center whitespace-nowrap animate-marquee text-white font-black uppercase tracking-widest text-lg">
          <span className="mx-8">PLEASE KEEP YOUR MOBILE PHONES SILENT</span>
          <span className="mx-8">KINDLY REPORT TO YOUR RESPECTIVE ROOMS 5 MINUTES BEFORE YOUR TURN</span>
          <span className="mx-8">FOR ANY ASSISTANCE CONTACT THE HELP DESK AT RECEPTION</span>
          <span className="mx-8">ALL THE BEST TO ALL CANDIDATES</span>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}

