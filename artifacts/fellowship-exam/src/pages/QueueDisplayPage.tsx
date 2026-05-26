import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fmtTime, fmtDate } from "../lib/dateUtils";
import { 
  Loader2, 
  Building2, 
  Clock, 
  Activity, 
  Info,
  ShieldCheck,
  UserCheck,
  Clock3
} from "lucide-react";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

/**
 * QueueDisplayPage - Premium Enterprise Board
 * Highly creative, space-efficient, and professional.
 * Removes redundant inline labels, enlarges column headers, 
 * and tightens highlight boxes to look elegant rather than oversized.
 */

export default function QueueDisplayPage() {
  const [time, setTime] = useState(new Date());
  const [isVerified, setIsVerified] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("tv_verified");
    if (stored === "true") setIsVerified(true);
  }, []);

  const { data: panels = [], isLoading: isLoadingPanels } = useQuery({
    queryKey: ["display-live"],
    queryFn: () => api.get<any[]>("/display/live"),
    refetchInterval: 4000, 
    enabled: isVerified,
  });

  const { data: specialities = [] } = useQuery<any[]>({
    queryKey: ["specialities-public"],
    queryFn: () => api.get("/specialities"),
    enabled: isVerified,
  });

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
      setError(e.message || "Unauthorized");
    } finally {
      setVerifying(false);
    }
  };

  if (!isVerified) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black">
        <div className="bg-slate-900/60 border border-slate-700/50 backdrop-blur-2xl p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md text-white">
          <div className="text-center mb-10">
            <ShieldCheck size={64} className="text-orange-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-3xl font-black uppercase tracking-wider text-orange-400">TV Board Terminal</h1>
            <p className="text-slate-400 font-semibold mt-1">Secure pairing required for Waiting Hall.</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-6">
            <Input
              autoFocus
              type="text"
              placeholder="000000"
              maxLength={6}
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); setError(""); }}
              className="h-20 text-center text-5xl font-black tracking-[0.4em] rounded-2xl bg-black/40 border-slate-700 text-white placeholder-slate-700 focus:border-orange-500 focus:ring-orange-500"
            />
            {error && <p className="text-red-500 font-bold text-center uppercase text-xs">{error}</p>}
            <Button type="submit" disabled={verifying || accessCode.length < 6} className="w-full h-16 text-xl font-black uppercase rounded-2xl shadow-lg bg-orange-600 hover:bg-orange-500 transition-all">
              {verifying ? "Syncing..." : "Connect Display"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoadingPanels) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-16 w-16 animate-spin text-orange-500" />
          <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Initializing Board...</p>
        </div>
      </div>
    );
  }

  // Segment Split Logic
  const getPanelSegment = (panel: any) => {
    if (!panel.specialityId) return "Anterior"; // Default fallback
    const spec = specialities.find(s => s.id === panel.specialityId);
    const nameLower = spec?.name.toLowerCase() || "";
    const codeLower = spec?.code.toLowerCase() || "";
    if (nameLower.includes("retina") || nameLower.includes("vitreo") || codeLower.includes("vr") || codeLower.includes("mr")) {
      return "Retina";
    }
    return "Anterior";
  };

  const retinaPanels = panels.filter(p => getPanelSegment(p) === "Retina");
  const anteriorPanels = panels.filter(p => getPanelSegment(p) === "Anterior");

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      
      {/* 1. PREMIUM BRANDED HEADER */}
      <header className="h-[120px] bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-8 overflow-hidden">
          <div className="h-16 bg-white/10 px-4 py-2 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
            <span className="text-2xl font-black tracking-tight text-white uppercase bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">SAV ACADEMY</span>
          </div>
          <div className="h-12 w-[1px] bg-slate-800 flex-shrink-0" />
          <div className="overflow-hidden">
            <h1 className="text-4xl font-extrabold text-white uppercase tracking-tight leading-none">
              Live Queue Status Board
            </h1>
            <div className="flex items-center gap-4 mt-2">
               <span className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-950/50 border border-emerald-800/40 px-3 py-1 rounded-full flex items-center gap-2 flex-shrink-0 shadow-sm shadow-emerald-950">
                 <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                 Broadcasting Live
               </span>
               <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase truncate">
                  <Building2 size={14} className="flex-shrink-0" /> <span className="truncate">{panels[0]?.batch?.venue || "Bangalore Campus"}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-10 flex-shrink-0">
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 text-white px-8 py-4 rounded-3xl shadow-2xl">
             <Clock size={32} className="text-orange-500" />
             <span className="text-5xl font-black tabular-nums tracking-tight leading-none bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {fmtTime(time)}
             </span>
          </div>
        </div>
      </header>

      {/* 2. SPLIT SEGMENT COLUMNS */}
      <main className="flex-1 flex p-6 gap-6 overflow-hidden">
        
        {/* ================= RETINA SEGMENT ================= */}
        <section className="flex-1 flex flex-col rounded-3xl bg-indigo-950/20 border border-indigo-900/30 backdrop-blur-xl p-4 overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none rounded-3xl" />
          
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-850 border border-indigo-700/50 px-6 py-4 rounded-2xl shadow-lg shrink-0 mb-4">
            <h2 className="text-2xl font-black uppercase tracking-wider text-indigo-200">Retina Segment Services</h2>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-950/40 text-xs font-black uppercase px-3 py-1">
              {retinaPanels.length} Panels Active
            </Badge>
          </div>

          {/* Table Headers */}
          <div className="flex w-full items-center px-6 py-3 bg-slate-900/40 rounded-xl shrink-0 border border-slate-800/30 mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <div className="w-[20%]">Station</div>
            <div className="w-[45%] text-indigo-400">Current Assessment</div>
            <div className="w-[17%]">Next</div>
            <div className="w-[18%] text-right">Status</div>
          </div>

          {/* Cards Queue */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 scrollbar-none">
            {retinaPanels.length === 0 ? (
              <div className="flex-1 flex items-center justify-center flex-col opacity-25">
                 <Activity size={60} strokeWidth={1.5} className="text-indigo-400 mb-4 animate-pulse" />
                 <p className="text-lg font-black text-indigo-300 uppercase tracking-widest">No Active Panels</p>
              </div>
            ) : (
              retinaPanels.map((panel: any) => {
                const current = panel.current;
                const queue = panel.nextQueue || [];
                return (
                  <div key={panel.panelId} className={`flex w-full items-center px-6 py-4 bg-slate-900/60 border rounded-2xl transition-all shadow-lg ${current ? 'border-indigo-500/30 shadow-indigo-950/20 bg-indigo-950/10' : 'border-slate-850 bg-slate-900/20'}`}>
                    <div className="w-[20%] font-black text-3xl text-white tracking-tight">{panel.roomNumber}</div>
                    <div className="w-[45%]">
                      {current ? (
                        <div className="inline-flex flex-col bg-indigo-600/90 text-white px-5 py-2 rounded-xl shadow-lg border border-indigo-400/20 max-w-full">
                          <span className="text-3xl font-black tracking-tight leading-none font-mono">{current.candidateCode}</span>
                          <span className="text-[10px] opacity-75 font-semibold mt-1 truncate max-w-[150px]">{current.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-base font-bold text-slate-600 uppercase tracking-wider italic">No Candidate</span>
                      )}
                    </div>
                    <div className="w-[17%] font-mono text-xl font-bold text-indigo-200">
                      {queue[0]?.candidateCode || "—"}
                    </div>
                    <div className="w-[18%] flex justify-end">
                      {current ? (
                        <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-ping"></span>
                          Live
                        </span>
                      ) : (
                        <span className="bg-slate-800/40 border border-slate-700/30 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-black uppercase">
                          Free
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ================= ANTERIOR SEGMENT ================= */}
        <section className="flex-1 flex flex-col rounded-3xl bg-emerald-950/20 border border-emerald-900/30 backdrop-blur-xl p-4 overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none rounded-3xl" />
          
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-900 to-emerald-850 border border-emerald-700/50 px-6 py-4 rounded-2xl shadow-lg shrink-0 mb-4">
            <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-200">Anterior Segment Services</h2>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40 text-xs font-black uppercase px-3 py-1">
              {anteriorPanels.length} Panels Active
            </Badge>
          </div>

          {/* Table Headers */}
          <div className="flex w-full items-center px-6 py-3 bg-slate-900/40 rounded-xl shrink-0 border border-slate-800/30 mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <div className="w-[20%]">Station</div>
            <div className="w-[45%] text-emerald-400">Current Assessment</div>
            <div className="w-[17%]">Next</div>
            <div className="w-[18%] text-right">Status</div>
          </div>

          {/* Cards Queue */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 scrollbar-none">
            {anteriorPanels.length === 0 ? (
              <div className="flex-1 flex items-center justify-center flex-col opacity-25">
                 <Activity size={60} strokeWidth={1.5} className="text-emerald-400 mb-4 animate-pulse" />
                 <p className="text-lg font-black text-emerald-300 uppercase tracking-widest">No Active Panels</p>
              </div>
            ) : (
              anteriorPanels.map((panel: any) => {
                const current = panel.current;
                const queue = panel.nextQueue || [];
                return (
                  <div key={panel.panelId} className={`flex w-full items-center px-6 py-4 bg-slate-900/60 border rounded-2xl transition-all shadow-lg ${current ? 'border-emerald-500/30 shadow-emerald-950/20 bg-emerald-950/10' : 'border-slate-850 bg-slate-900/20'}`}>
                    <div className="w-[20%] font-black text-3xl text-white tracking-tight">{panel.roomNumber}</div>
                    <div className="w-[45%]">
                      {current ? (
                        <div className="inline-flex flex-col bg-emerald-600/90 text-white px-5 py-2 rounded-xl shadow-lg border border-emerald-400/20 max-w-full">
                          <span className="text-3xl font-black tracking-tight leading-none font-mono">{current.candidateCode}</span>
                          <span className="text-[10px] opacity-75 font-semibold mt-1 truncate max-w-[150px]">{current.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-base font-bold text-slate-600 uppercase tracking-wider italic">No Candidate</span>
                      )}
                    </div>
                    <div className="w-[17%] font-mono text-xl font-bold text-emerald-200">
                      {queue[0]?.candidateCode || "—"}
                    </div>
                    <div className="w-[18%] flex justify-end">
                      {current ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shadow-sm">
                          <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                          Live
                        </span>
                      ) : (
                        <span className="bg-slate-800/40 border border-slate-700/30 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-black uppercase">
                          Free
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>

      {/* 3. PREMIUM ANNOUNCEMENT FOOTER */}
      <footer className="h-[80px] bg-orange-600 flex items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-10">
         <div className="h-full px-12 bg-slate-900 flex items-center gap-4 text-white font-black text-2xl uppercase italic z-20 shadow-2xl relative border-r-4 border-white/10">
            <Info size={32} className="text-orange-400" />
            ATTENTION
         </div>
         <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-primary to-transparent z-10" />
            <div className="flex items-center whitespace-nowrap animate-marquee text-white font-bold text-3xl uppercase tracking-widest">
               <span className="mx-24">KINDLY REPORT TO YOUR RESPECTIVE ROOMS 5 MINUTES BEFORE YOUR TURN</span>
               <span className="mx-24 text-slate-950">PLEASE KEEP YOUR MOBILE PHONES IN SILENT MODE</span>
               <span className="mx-24">ALL THE BEST TO ALL CANDIDATES FROM SANKARA ACADEMY OF VISION</span>
            </div>
         </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .tabular-nums {
          font-variant-numeric: tabular-nums;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}


