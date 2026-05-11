import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Loader2,
  Users,
  Monitor,
  DoorOpen,
  UserCheck,
  Zap,
  Building2,
  CalendarDays,
  Info,
  Clock8,
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
      const res = await api.post<{ success: boolean }>("/tv-access/verify", { code: accessCode });
      if (res.success) {
        setIsVerified(true);
        sessionStorage.setItem("tv_verified", "true");
      }
    } catch (e: any) {
      setError(e.message || "Invalid access code");
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
    refetchInterval: 5000, 
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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md bg-white border-slate-200 shadow-2xl rounded-3xl overflow-hidden">
          <div className="bg-primary p-8 text-center text-white">
            <div className="mx-auto bg-white p-4 rounded-2xl w-24 h-24 flex items-center justify-center mb-4 shadow-lg">
              <img src="/logo.png" alt="SAV Logo" className="w-16 object-contain" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Display Console</h2>
            <p className="text-primary-foreground/80 text-sm font-medium mt-1">Authorization Required</p>
          </div>
          <CardContent className="p-10">
            <form onSubmit={handleVerify} className="space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest text-center block">Enter 6-Digit TV Access Code</label>
                <Input
                  autoFocus
                  type="text"
                  placeholder="------"
                  maxLength={6}
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); setError(""); }}
                  className="h-20 text-center text-5xl font-black tracking-[0.4em] uppercase bg-slate-50 border-2 border-slate-200 focus:border-primary rounded-2xl"
                />
              </div>
              {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}
              <Button type="submit" disabled={verifying || accessCode.length < 6} className="w-full h-16 text-xl font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95">
                {verifying ? "Verifying..." : "Authorize TV"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingPanels) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
          <p className="text-slate-400 font-black uppercase tracking-widest animate-pulse">Syncing Hall Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f1f5f9] text-[#1e293b] font-sans flex flex-col overflow-hidden select-none">
      {/* INSTITUTIONAL HEADER - FIXED HEIGHT */}
      <header className="h-[120px] bg-white border-b-4 border-primary shadow-lg flex items-center px-12 z-50">
        <div className="flex items-center gap-10 flex-1">
          <img src="/logo.png" alt="SAV Logo" className="h-16 w-auto object-contain" />
          <div className="h-12 w-[2px] bg-slate-200" />
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Fellowship Admissions 2026</h1>
            <div className="flex items-center gap-4">
              <Badge className="bg-primary/10 text-primary border-0 text-sm font-black px-3 py-0.5 rounded-md">
                {panels[0]?.batch?.name || activeBatch.name}
              </Badge>
              <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                <Building2 className="h-4 w-4 text-primary" />
                {panels[0]?.batch?.venue || "Sankara Academy of Vision"}
                {panels[0]?.batch?.segment && (
                  <span className="text-slate-300 mx-2">|</span>
                )}
                {panels[0]?.batch?.segment && (
                  <span className="text-primary font-black uppercase">{panels[0].batch.segment} Interviews</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-right border-r-2 border-slate-100 pr-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Date</p>
            <div className="flex items-center gap-2 text-slate-600 font-bold">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xl uppercase">{time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-primary">
            <Clock8 className="h-8 w-8" />
            <div className="text-6xl font-black tracking-tighter tabular-nums leading-none">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
      </header>

      {/* UNIFORM GRID LAYOUT */}
      <main className="flex-1 p-10 overflow-hidden">
        <div className="h-full grid grid-cols-4 gap-8">
          {panels.slice(0, 4).map((panel: any) => {
            const currentCandidate = panel.current;
            const waitingQueue = panel.nextQueue || [];
            
            return (
              <div key={panel.panelId} className="h-full flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                {/* ROOM HEADER - UNIFORM SIZE */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 text-center shrink-0">
                  <div className="inline-flex items-center gap-3 bg-white px-6 py-2 rounded-2xl shadow-sm border border-slate-200 mb-3">
                    <DoorOpen className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-black text-slate-900">ROOM {panel.roomNumber}</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest truncate">
                    {panel.panelName}
                  </h3>
                </div>

                {/* DOCTORS - FIXED HEIGHT SECTION */}
                <div className="h-[80px] px-8 flex items-center justify-center border-b border-slate-50 shrink-0">
                  <div className="flex flex-wrap justify-center gap-2">
                    {panel.members?.length > 0 ? (
                      panel.members.slice(0, 2).map((m: string) => (
                        <Badge key={m} variant="outline" className="bg-slate-50/50 text-slate-500 border-slate-100 font-bold text-[10px] px-3 py-1">
                          DR. {m.toUpperCase()}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Awaiting Assignment</span>
                    )}
                  </div>
                </div>

                {/* NOW CALLING - CENTRAL FOCUS */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 bg-white">
                  <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                    <UserCheck className="h-4 w-4" /> Current Interview
                  </div>
                  
                  {currentCandidate ? (
                    <div className="text-center space-y-4 w-full">
                      <div className="text-8xl font-black text-slate-900 tracking-tighter tabular-nums leading-none animate-in fade-in zoom-in duration-500">
                        {currentCandidate.candidateCode}
                      </div>
                      <div className="inline-block bg-emerald-500 text-white font-black text-xs px-6 py-2 rounded-full shadow-lg shadow-emerald-200 animate-pulse uppercase tracking-[0.2em]">
                        Please Enter Room
                      </div>
                    </div>
                  ) : (
                    <div className="text-center opacity-20">
                      <div className="text-6xl font-black text-slate-400 italic">VACANT</div>
                    </div>
                  )}
                </div>

                {/* QUEUE LIST - UNIFORM SPACING */}
                <div className="bg-slate-50/50 p-8 border-t border-slate-100 shrink-0">
                  <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-6">
                    <Zap className="h-4 w-4" /> Up Next
                  </div>
                  
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => {
                      const candidate = waitingQueue[i];
                      return (
                        <div key={i} className={`flex items-center gap-5 p-4 rounded-2xl border-2 transition-all ${candidate && i === 0 ? 'bg-white border-primary shadow-md' : 'bg-white/40 border-transparent opacity-40'}`}>
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-black ${candidate && i === 0 ? 'bg-primary text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                            {i + 1}
                          </div>
                          <div className={`text-3xl font-black tracking-tight ${candidate && i === 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                            {candidate?.candidateCode || "----"}
                          </div>
                          {candidate && i === 0 && (
                            <div className="ml-auto bg-primary/10 text-primary font-black text-[8px] px-2 py-1 rounded uppercase">Ready</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* CLEAN MARQUEE FOOTER */}
      <footer className="h-16 bg-slate-900 flex items-center overflow-hidden shrink-0">
        <div className="bg-primary h-full px-10 flex items-center gap-3 text-white font-black text-xl italic skew-x-[-20deg] ml-[-20px] pr-12 z-10 shadow-2xl">
          <Info className="h-6 w-6 skew-x-[20deg]" /> 
          <span className="skew-x-[20deg]">NOTICE</span>
        </div>
        <div className="flex-1 overflow-hidden">
           <div className="flex items-center whitespace-nowrap animate-marquee text-white font-bold text-2xl uppercase tracking-[0.1em] opacity-80">
              <span className="mx-20">KINDLY REPORT TO YOUR RESPECTIVE ROOMS 5 MINUTES BEFORE YOUR TURN</span>
              <span className="mx-20">PLEASE KEEP YOUR MOBILE PHONES IN SILENT MODE</span>
              <span className="mx-20">ALL THE BEST TO ALL CANDIDATES FROM SANKARA ACADEMY OF VISION</span>
              <span className="mx-20">CONTACT THE HELP DESK FOR ANY QUERIES OR ASSISTANCE</span>
           </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 50s linear infinite;
        }
      `}</style>
    </div>
  );
}
