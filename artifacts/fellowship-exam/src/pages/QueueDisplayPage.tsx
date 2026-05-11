import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
    refetchInterval: 5000, 
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
      <div className="h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="text-center mb-10">
            <ShieldCheck size={64} className="text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-black text-slate-900 uppercase">Board Terminal</h1>
            <p className="text-slate-400 font-bold">Secure access required for sync.</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-6">
            <Input
              autoFocus
              type="text"
              placeholder="000000"
              maxLength={6}
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); setError(""); }}
              className="h-20 text-center text-5xl font-black tracking-[0.4em] rounded-2xl bg-slate-50 border-2 border-slate-200"
            />
            {error && <p className="text-red-500 font-bold text-center uppercase text-xs">{error}</p>}
            <Button type="submit" disabled={verifying || accessCode.length < 6} className="w-full h-16 text-xl font-black uppercase rounded-2xl shadow-lg">
              {verifying ? "Syncing..." : "Connect Display"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoadingPanels) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden select-none">
      
      {/* 1. PREMIUM BRANDED HEADER */}
      <header className="h-[120px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-8 overflow-hidden">
          <img src="/logo.png" alt="SAV" className="h-16 object-contain flex-shrink-0" />
          <div className="h-12 w-[2px] bg-slate-100 flex-shrink-0" />
          <div className="overflow-hidden">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">
              Live Queue Status
            </h1>
            <div className="flex items-center gap-4 mt-2">
               <span className="text-xs font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full flex items-center gap-2 flex-shrink-0">
                 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 System Active
               </span>
               <div className="flex items-center gap-2 text-slate-400 font-bold text-sm uppercase truncate">
                  <Building2 size={16} className="flex-shrink-0" /> <span className="truncate">{panels[0]?.batch?.venue || "Central Campus"}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-10 flex-shrink-0">
          <div className="flex items-center gap-4 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-xl shadow-slate-900/20">
             <Clock size={32} className="text-primary" />
             <span className="text-5xl font-black tabular-nums tracking-tight leading-none">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
             </span>
          </div>
        </div>
      </header>

      {/* 2. ELEGANT TABLE LAYOUT */}
      <main className="flex-1 flex flex-col p-8 overflow-hidden bg-white">
        
        {/* LARGE, CLEAR TABLE HEADERS */}
        <div className="flex w-full items-center px-8 py-5 bg-slate-100/50 rounded-2xl shrink-0 border border-slate-100 mb-4">
          <div className="w-[25%] flex-shrink-0 px-4 text-lg lg:text-xl font-black uppercase tracking-widest text-slate-500">Room Station</div>
          <div className="w-[30%] flex-shrink-0 px-4 text-lg lg:text-xl font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <UserCheck size={24} /> Currently Inside
          </div>
          <div className="w-[18%] flex-shrink-0 px-4 text-lg lg:text-xl font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <Clock3 size={24} /> Next
          </div>
          <div className="w-[15%] flex-shrink-0 px-4 text-lg lg:text-xl font-black uppercase tracking-widest text-slate-500">Upcoming</div>
          <div className="w-[12%] flex-shrink-0 px-4 text-lg lg:text-xl font-black uppercase tracking-widest text-slate-500 text-right">Status</div>
        </div>

        {/* DATA ROWS - TRUE SINGLE LINE, NO CLUTTER */}
        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {panels.length === 0 ? (
            <div className="flex-1 flex items-center justify-center flex-col opacity-30 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
               <Activity size={80} strokeWidth={1} className="text-slate-400 mb-6" />
               <p className="text-3xl font-black text-slate-500 uppercase tracking-widest">No Active Interviews</p>
            </div>
          ) : (
            panels.map((panel: any) => {
              const current = panel.current;
              const queue = panel.nextQueue || [];
              const isActive = !!current;

              return (
                <div 
                  key={panel.panelId} 
                  className="flex w-full items-center px-8 flex-1 min-h-[6rem] max-h-[8rem] bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 transition-all hover:shadow-md hover:border-slate-200"
                >
                  
                  {/* ROOM NO. */}
                  <div className="w-[25%] flex-shrink-0 px-4 overflow-hidden">
                    <span className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tight truncate block" title={panel.roomNumber}>
                      {panel.roomNumber}
                    </span>
                  </div>

                  {/* CURRENT CANDIDATE - AUTO WIDTH BADGE */}
                  <div className="w-[30%] flex-shrink-0 px-4 flex items-center overflow-hidden">
                    {current ? (
                      <div className="inline-flex items-center bg-emerald-500 text-white px-8 py-3 rounded-2xl shadow-lg shadow-emerald-500/30 max-w-full">
                        <span className="text-5xl lg:text-6xl font-black tracking-tighter tabular-nums truncate leading-none">
                          {current.candidateCode}
                        </span>
                      </div>
                    ) : (
                      <span className="text-3xl font-black text-slate-300 italic uppercase tracking-widest">Available</span>
                    )}
                  </div>

                  {/* NEXT CANDIDATE */}
                  <div className="w-[18%] flex-shrink-0 px-4 overflow-hidden border-l-2 border-slate-50">
                    <span className={`text-4xl lg:text-5xl font-black tracking-tighter tabular-nums truncate block ${queue[0] ? 'text-slate-700' : 'text-slate-200'}`}>
                      {queue[0]?.candidateCode || "----"}
                    </span>
                  </div>

                  {/* UPCOMING CANDIDATE */}
                  <div className="w-[15%] flex-shrink-0 px-4 overflow-hidden border-l-2 border-slate-50">
                    <span className={`text-3xl lg:text-4xl font-black tracking-tighter tabular-nums truncate block ${queue[1] ? 'text-slate-400' : 'text-slate-100'}`}>
                      {queue[1]?.candidateCode || "----"}
                    </span>
                  </div>

                  {/* STATUS */}
                  <div className="w-[12%] flex-shrink-0 px-4 flex justify-end overflow-hidden">
                    {current ? (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-5 py-2.5 rounded-xl flex items-center gap-2 max-w-full shadow-sm">
                        <Activity size={20} className="animate-pulse flex-shrink-0" />
                        <span className="text-sm lg:text-base font-black uppercase tracking-widest truncate">Live</span>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 text-slate-400 px-5 py-2.5 rounded-xl max-w-full">
                        <span className="text-sm lg:text-base font-black uppercase tracking-widest truncate">Wait</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 3. PREMIUM ANNOUNCEMENT FOOTER */}
      <footer className="h-[80px] bg-primary flex items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-10">
         <div className="h-full px-12 bg-slate-900 flex items-center gap-4 text-white font-black text-2xl uppercase italic z-20 shadow-2xl relative border-r-4 border-white/10">
            <Info size={32} className="text-primary" />
            ATTENTION
         </div>
         <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-primary to-transparent z-10" />
            <div className="flex items-center whitespace-nowrap animate-marquee text-white font-bold text-3xl uppercase tracking-widest">
               <span className="mx-24">KINDLY REPORT TO YOUR RESPECTIVE ROOMS 5 MINUTES BEFORE YOUR TURN</span>
               <span className="mx-24 text-slate-900">PLEASE KEEP YOUR MOBILE PHONES IN SILENT MODE</span>
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
      `}</style>
    </div>
  );
}
