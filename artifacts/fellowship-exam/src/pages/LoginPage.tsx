import { useState, useEffect, useRef } from "react";
import logoUrl from "../assets/seh_sav_logo_1777703794142.jpg";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Loader2, Eye, EyeOff, PhoneCall, ShieldCheck, Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import ParticleCanvas from "../components/ParticleCanvas";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden select-none flex items-center justify-center p-6 bg-gradient-to-br from-[#020617] via-[#0b1329] to-[#030712]">
      {/* Dynamic Animated Background Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-5%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            x: [0, -20, 0],
            y: [0, 20, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-orange-500/5 rounded-full blur-[120px]"
        />
      </div>

      <ParticleCanvas count={35} color="255, 255, 255" connectionColor="255, 255, 255" maxDistance={0} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[480px] space-y-6"
      >
        {/* Branding Section */}
        <div className="text-center space-y-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative inline-block group cursor-pointer"
          >
            <div className="absolute -inset-1.5 bg-gradient-to-r from-orange-500 via-white to-blue-500 rounded-3xl blur opacity-35 group-hover:opacity-60 transition duration-500"></div>
            <img
              src={logoUrl}
              alt="Sankara Eye Foundation"
              className="relative w-full h-auto max-h-24 mx-auto rounded-2xl shadow-2xl object-contain bg-white p-4 transition-all duration-500"
            />
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none flex flex-col items-center gap-0 drop-shadow-lg">
              <span className="text-orange-500">Sankara</span>
              <span className="text-white text-base tracking-widest uppercase not-italic font-black mt-0.5">Academy of Vision</span>
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60" />
              <p className="text-[9px] font-black text-blue-100 uppercase tracking-[0.4em]">Fellowship Operations</p>
              <div className="h-[1px] w-10 bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-60" />
            </div>
          </div>
        </div>

        {/* Interactive Login Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Card className="relative border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] bg-white/5 backdrop-blur-2xl rounded-3xl overflow-hidden border-t-4 border-t-orange-500">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2.5 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 text-blue-100 text-[9px] font-black uppercase tracking-widest border border-blue-400/20 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  Authorized Personnel Only
                </div>
                <h2 className="text-xl font-black text-white tracking-tight drop-shadow-md">System Login</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Alert className="bg-red-500/10 border-red-500/50 text-red-200 rounded-xl border-l-4 animate-in shake-in duration-500 shadow-sm overflow-hidden backdrop-blur-md">
                        <AlertDescription className="text-xs font-black text-center uppercase tracking-wide py-1">{error}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <div className="space-y-1.5 group/input">
                    <Label htmlFor="email" className="text-[9px] font-black uppercase tracking-widest text-blue-200 ml-1.5 group-focus-within/input:text-orange-400 transition-colors">Credential ID (Email)</Label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-blue-950/50 border border-white/5 flex items-center justify-center transition-all group-focus-within/input:bg-orange-500 group-focus-within/input:border-orange-400 group-focus-within/input:scale-105 shadow-sm">
                        <Mail className="h-3.5 w-3.5 text-blue-400 group-focus-within/input:text-white transition-colors" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@sankaraeye.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-13 pl-14 rounded-xl bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all text-xs font-bold shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 group/input">
                    <div className="flex items-center justify-between ml-1.5">
                      <Label htmlFor="password" className="text-[9px] font-black uppercase tracking-widest text-blue-200 group-focus-within/input:text-blue-400 transition-colors">Secure Key</Label>
                      <button type="button" className="text-[9px] font-black uppercase tracking-widest text-orange-400 hover:text-orange-300 hover:underline transition-all" onClick={() => setForgotOpen(true)}>Recovery</button>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-blue-950/50 border border-white/5 flex items-center justify-center transition-all group-focus-within/input:bg-blue-600 group-focus-within/input:border-blue-400 group-focus-within/input:scale-105 shadow-sm">
                        <Lock className="h-3.5 w-3.5 text-blue-400 group-focus-within/input:text-white transition-colors" />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-13 pl-14 pr-12 rounded-xl bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all text-xs font-bold shadow-inner"
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full h-13 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-500/10 transition-all border-none relative overflow-hidden group/btn"
                    disabled={loading}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"
                    />
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span>Initialize Protocol</span>
                        <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </motion.div>
              </form>
            </CardContent>

            <div className="bg-white/5 backdrop-blur-md p-4 border-t border-white/10 flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-200">
                Secure Server Connection Active
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Footer */}
        <div className="text-center space-y-1.5 pt-2">
          <div className="h-[1px] w-12 bg-white/10 mx-auto rounded-full mb-1" />
          <p className="text-[8.5px] font-black uppercase tracking-[0.25em] text-slate-400">
            Sri Kanchi Kamakoti Medical Trust, Sankara Eye Hospitals, India
          </p>
          <p className="text-[7.5px] font-extrabold uppercase tracking-[0.2em] text-blue-300/40">
            Developed by Information Systems, Sankara Eye Hospital
          </p>
        </div>
      </motion.div>

      {/* Support Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md rounded-[3rem] bg-slate-900 border border-white/10 p-10 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-orange-500 to-white" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4 text-2xl font-black text-white tracking-tight">
              <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400 shadow-sm border border-orange-500/30">
                <PhoneCall className="h-6 w-6" />
              </div>
              Protocol Recovery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8 pt-6">
            <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-inner">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/10 w-fit px-4 py-1.5 rounded-full shadow-sm border border-orange-500/20">
                <Sparkles className="h-3 w-3" />
                Security Notice
              </div>
              <p className="text-sm text-slate-300 leading-relaxed font-bold italic">
                "For institutional security, password resets are handled exclusively via the IT Department."
              </p>
            </div>

            <div className="rounded-[2rem] bg-black/40 p-8 space-y-6 text-white shadow-2xl relative overflow-hidden border border-white/5">
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="space-y-2 relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Chief System Admin</p>
                <p className="text-xl font-black tracking-tighter">PRABHANJAN</p>
              </div>
              <div className="pt-2 relative z-10">
                <a href="mailto:prabhanjan@sankaraeye.com" className="group flex items-center gap-4 text-sm font-bold text-slate-300 hover:text-white transition-all">
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-orange-500 transition-colors shadow-lg">
                    <Mail className="h-5 w-5" />
                  </div>
                  prabhanjan@sankaraeye.com
                </a>
              </div>
            </div>

            <Button className="w-full h-16 rounded-[1.5rem] bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-[0.98]" onClick={() => setForgotOpen(false)}>
              Close Recovery Window
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
