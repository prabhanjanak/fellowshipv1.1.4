import { useState, useEffect, useCallback } from "react";
import logoUrl from "../assets/seh_sav_logo_1777703794142.jpg";
import { Loader2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, ChevronDown, CreditCard } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";

// Ensure Razorpay type exists
declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
}

const API = "/api";

const INITIAL_FORM = {
  fullName: "", email: "", phone: "", dateOfBirth: "", maritalStatus: "", spouseDetails: "",
  specialization: "",
  centerPreference: "",
  referralSource: "", referredByName: "", mediaSource: "",
  permanentAddress: "", mailingAddress: "",
  medicalConditions: [] as string[],
  previousApplicationMonthYear: "", appearedEarlier: "No",
  degree: "", medicalCollege: "", university: "", pgQualification: "",
  qualificationMatrix: {} as Record<string, string>,
  doDetails: "", msMdDetails: "", dnbDetails: "",
  medicalCouncilNumber: "", otherCertifications: "",
  diagnosticSkills: {} as Record<string, string>,
  surgicalExperience: {} as Record<string, string>,
  publications: "", presentations: "",
  lor1RefName: "", lor1RefContact: "", lor1RefEmail: "",
  lor2RefName: "", lor2RefContact: "", lor2RefEmail: "",
  additionalInfo: "", declarationAccepted: false,
};

// ── Particle Canvas Component ─────────────────────────────────────────────
function ParticleCanvas({ className }: { className?: string }) {
  const mountRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 80;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2.5 + 1,
      color: [`rgba(16,185,129,`, `rgba(5,150,105,`, `rgba(52,211,153,`, `rgba(110,231,183,`][Math.floor(Math.random() * 4)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw connection lines
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(16,185,129,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      // Draw dots
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "0.6)";
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={mountRef}
      className={`fixed inset-0 pointer-events-none ${className || ""}`}
      style={{ zIndex: 0 }}
    />
  );
}

export default function ApplyPage({ token }: { token: string }) {
  const [formInfo, setFormInfo] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, any>>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [files, setFiles] = useState<Record<string, File>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Post-payment confirmation state
  const [paymentVerified, setPaymentVerified] = useState<{paymentId: string; finalForm: Record<string,any>; verifyResponse: any} | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{ amount: number; currency: string; description: string; mock: boolean } | null>(null);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    fetch(`${API}/apply/${token}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? "Form not found");
        }
        return r.json();
      })
      .then((data) => {
        setFormInfo(data);
        if (data.sectionsConfig && data.sectionsConfig.length > 0) {
           const initial: Record<string, any> = { ...INITIAL_FORM };
           data.sectionsConfig.forEach((sec: any) => {
             sec.fields.forEach((f: any) => {
               if (f.defaultValue !== undefined) initial[f.id] = f.defaultValue;
             });
           });
           setForm(initial);
        }
      })
      .catch((e: Error) => setFormError(e.message))
      .finally(() => setLoading(false));

    // Load payment config
    fetch(`${API}/apply/${token}/payment-config`)
      .then(r => r.json())
      .then(data => setPaymentConfig(data))
      .catch(e => console.error("Failed to load payment config", e));

    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [token]);

  const set = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const onFileChange = (field: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [field]: file }));
      setErrors(prev => {
         const next = { ...prev };
         delete next[field];
         return next;
      });
    }
  };

  const validateStep = (currentStep: number) => {
    const section = formInfo.sectionsConfig[currentStep];
    if (!section) return true;
    const newErrors: Record<string, string> = {};
    let hasError = false;

    section.fields.forEach((f: any) => {
      if (f.required) {
        if (f.type === 'file') {
          if (!files[f.id]) {
            newErrors[f.id] = `${f.label} is required`;
            hasError = true;
          }
        } else {
          const val = form[f.id];
          if (val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
            newErrors[f.id] = `${f.label} is required`;
            hasError = true;
          }
        }
      }
    });

    setErrors(newErrors);
    return !hasError;
  };

  const handlePaymentAndSubmit = async () => {
    if (!validateStep(step)) return;
    
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload files via correct two-step local upload route
      const uploadedUrls: Record<string, string> = {};
      for (const [field, file] of Object.entries(files)) {
        // Step 1a: Request a signed upload URL
        const urlRes = await fetch(`${API}/apply/${token}/request-upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            contentType: file.type,
            size: file.size,
            candidateName: form.fullName || "candidate",
          }),
        });
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}));
          throw new Error(err.error || `Failed to get upload URL for ${field}`);
        }
        const { uploadURL, objectPath } = await urlRes.json();

        // Step 1b: PUT the file directly to the returned URL
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Failed to upload ${field}`);

        uploadedUrls[field] = objectPath;
      }
      const finalForm = { ...form, ...uploadedUrls };

      // 2. Create Order
      const specCount = Array.isArray(form.specialization) ? form.specialization.length : 1;
      const orderRes = await fetch(`${API}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, specializationCount: specCount }),
      });
      
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to initiate payment");

      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Sankara Academy of Vision",
        description: orderData.description || "Fellowship Application Fee",
        order_id: orderData.order.id,
        handler: async (response: any) => {
          try {
            // 3. Verify Payment signature
            const verifyRes = await fetch(`${API}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...response, token }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

            // 4. Show payment confirmation screen (user sees Payment ID, then confirms)
            setPaymentVerified({
              paymentId: response.razorpay_payment_id,
              finalForm,
              verifyResponse: verifyData,
            });
            window.scrollTo(0, 0);
          } catch (e: any) {
            setSubmitError(e.message);
          } finally {
            setSubmitting(false);
          }
        },
        prefill: {
          name: finalForm.fullName || "",
          email: finalForm.email || "",
          contact: finalForm.phone || "",
        },
        theme: { color: "#ea580c" },
        modal: { ondismiss: () => setSubmitting(false) }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      setSubmitError(e.message);
      setSubmitting(false);
    }
  };

  const next = async () => {
    if (!validateStep(step)) return;
    if (step === (formInfo.sectionsConfig?.length || 0) - 1) {
      await handlePaymentAndSubmit();
      return;
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const prev = () => {
    setStep(s => Math.max(0, s - 1));
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (formError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <Card className="max-w-md w-full text-center p-8 border-orange-100 shadow-xl shadow-orange-900/5">
          <AlertCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Unavailable</h2>
          <p className="text-slate-600 mb-6">{formError}</p>
          <Button onClick={() => window.location.reload()} className="bg-orange-600 hover:bg-orange-700">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // ── Payment Verified Confirmation Screen ────────────────────────────────
  if (paymentVerified && !submitted) {
    const { paymentId, finalForm } = paymentVerified;

    const handleFinalSubmit = async () => {
      setConfirming(true);
      setConfirmError(null);
      try {
        const submitRes = await fetch(`${API}/apply/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...finalForm, payment_id: paymentId }),
        });
        if (!submitRes.ok) {
          const errData = await submitRes.json();
          throw new Error(errData.error || "Submission failed. Please contact support with Payment ID: " + paymentId);
        }
        const resData = await submitRes.json();
        setSubmissionId(resData.submissionId ? String(resData.submissionId) : null);
        setSubmitted(true);
        window.scrollTo(0, 0);
      } catch (e: any) {
        setConfirmError(e.message);
      } finally {
        setConfirming(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          {/* Payment Verified Banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center shadow-lg shadow-green-100">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-1">Payment Successful!</h2>
            <p className="text-sm text-green-700">
              Your payment of <strong>{paymentConfig ? `${paymentConfig.currency} ${((paymentConfig.amount * (Array.isArray(finalForm.specialization) ? finalForm.specialization.length : 1)) / 100).toLocaleString("en-IN")}` : `Rs. ${(2750 * (Array.isArray(finalForm.specialization) ? finalForm.specialization.length : 1)).toLocaleString("en-IN")}`}</strong> has been verified by Razorpay.
              {Array.isArray(finalForm.specialization) && finalForm.specialization.length > 1 && ` (Rs. 2,750 x ${finalForm.specialization.length} specializations)`}
            </p>
          </div>

          {/* Payment ID Box */}
          <div className="bg-white border-2 border-orange-200 rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-bold text-orange-900 uppercase tracking-wider">Your Razorpay Payment ID</span>
            </div>
            <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-4">
              <code className="text-lg font-mono font-bold text-orange-700 tracking-wider select-all">{paymentId}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(paymentId); }}
                className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
              >Copy</button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              ⚠️ <strong>Save this Payment ID</strong> — you will need it for any future correspondence or refund requests. It was also shown inside the Razorpay popup.
            </p>
          </div>

          {/* Error if any */}
          {confirmError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <strong>Error:</strong> {confirmError}
            </div>
          )}

          {/* Final Submit Button */}
          <button
            onClick={handleFinalSubmit}
            disabled={confirming}
            className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all duration-300 shadow-lg flex items-center justify-center gap-3 "
            style={{ background: confirming ? '#16a34a99' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 8px 24px rgba(22,163,74,0.35)' }}
          >
            {confirming ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Application...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Confirm & Submit Application</>
            )}
          </button>
          <p className="text-center text-xs text-slate-400">By clicking above, your application will be officially submitted to Sankara Academy of Vision.</p>
        </div>
      </div>
    );
  }

  // ── Final Success / Printable Application Document ─────────────────────
  if (submitted) {
    const allSections = formInfo.sectionsConfig || [];
    const appForm = paymentVerified?.finalForm || form;

    // Helper: render a field value as readable text
    const renderValue = (field: any, value: any): string | null => {
      if (value === null || value === undefined || value === "" || value === false) return null;
      if (field.type === "file") return null; // skip file paths
      if (field.type === "info") return null;
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (Array.isArray(value)) return value.length ? value.join(", ") : null;
      if (typeof value === "object") {
        // For surgery_table / qualification_matrix / skills_table
        const lines = Object.entries(value).map(([k, v]: any) => {
          if (typeof v === "object" && v !== null) {
            return `${k}: Supervision=${v.supervision ?? 0}, Independent=${v.independent ?? 0}`;
          }
          return `${k}: ${v}`;
        });
        return lines.length ? lines.join("\n") : null;
      }
      return String(value);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4 md:p-8 print:bg-white print:p-0 relative overflow-hidden">
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

        {/* Particle Canvas Background */}
        <ParticleCanvas className="no-print" />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Header */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-green-200/60 overflow-hidden print:shadow-none print:rounded-none">

            {/* Title Bar */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-8 text-white text-center print:bg-green-700">
              <div className="flex justify-center mb-6 no-print">
                <img src={logoUrl} alt="Sankara Logo" className="h-20 w-auto rounded-xl shadow-lg bg-white p-2" />
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 no-print">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Fellowship Application — Submitted</h1>
              <p className="text-green-100 text-sm">Sankara Academy of Vision · {formInfo.title}</p>
              {submissionId && <p className="text-xs text-green-200 mt-1 font-mono">Application Ref: #{submissionId}</p>}
              <p className="text-xs text-green-200 mt-1">Date: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* Payment Block */}
              {paymentVerified && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h3 className="text-xs font-bold text-green-800 uppercase tracking-widest mb-3">✓ Payment Confirmed</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Razorpay Payment ID</span>
                      <p className="font-mono font-bold text-green-700 text-base">{paymentVerified.paymentId}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Amount Paid</span>
                      <p className="font-bold text-green-700 text-base">
                        {paymentConfig ? `${paymentConfig.currency} ${((paymentConfig.amount * (Array.isArray(appForm.specialization) ? appForm.specialization.length : 1)) / 100).toLocaleString("en-IN")}` : `Rs. ${(2750 * (Array.isArray(appForm.specialization) ? appForm.specialization.length : 1)).toLocaleString("en-IN")}`} /-
                        {Array.isArray(appForm.specialization) && appForm.specialization.length > 1 && <span className="text-[10px] ml-1 opacity-70">(Rs. 2,750 x {appForm.specialization.length})</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* All Sections */}
              {allSections.map((section: any) => {
                const visibleFields = section.fields.filter((f: any) =>
                  f.type !== "info" && f.type !== "file" && appForm[f.id] !== undefined && appForm[f.id] !== "" && appForm[f.id] !== null
                );
                if (visibleFields.length === 0) return null;

                return (
                  <div key={section.id} className="border border-slate-100 rounded-xl overflow-hidden">
                    {/* Section Header */}
                    <div className="bg-slate-800 px-5 py-3">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{section.title}</h3>
                    </div>

                    {/* Fields Grid */}
                    <div className="divide-y divide-slate-50">
                      {visibleFields.map((field: any) => {
                        const raw = appForm[field.id];
                        const rendered = renderValue(field, raw);
                        if (!rendered) return null;
                        const isMultiline = rendered.includes("\n");

                        return (
                          <div key={field.id} className={`px-5 py-3 ${isMultiline ? "" : "flex items-start gap-4"}`}>
                            <span className={`text-xs text-slate-500 font-medium ${isMultiline ? "block mb-1" : "w-48 flex-shrink-0 pt-0.5"}`}>
                              {field.label?.replace(" *", "")}
                            </span>
                            {isMultiline ? (
                              <pre className="text-sm text-slate-800 font-sans whitespace-pre-wrap bg-slate-50 rounded-lg p-3 mt-1">
                                {rendered}
                              </pre>
                            ) : (
                              <span className="text-sm font-semibold text-slate-800 flex-1">{rendered}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Next Steps */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-3">What Happens Next?</h3>
                <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
                  <li>Your application will be reviewed by the Selection Committee.</li>
                  <li>A written test (MCQ) and interview will be scheduled.</li>
                  <li>Carry all original educational certificates, registration license, and a passport-size photograph.</li>
                  <li>For queries, contact Sankara Academy of Vision, Coimbatore.</li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-xl border-2 border-green-600 text-green-700 font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                >
                  🖨 Print / Save as PDF
                </button>
              </div>

              <div className="text-center py-6 no-print">
                <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-8 py-4">
                  <span className="text-2xl">✓</span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-700">Application complete</p>
                    <p className="text-xs text-slate-500">You may close this window</p>
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        If there are any issues, contact: <br />
                        <a href="mailto:radhika@sankaraeye.com" className="text-blue-600 hover:underline">radhika@sankaraeye.com</a> & <a href="mailto:tejaswini@sankaraeye.com" className="text-blue-600 hover:underline">tejaswini@sankaraeye.com</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sections = formInfo.sectionsConfig || [];
  const currentSection = sections[step];
  if (!currentSection) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
          <Card className="max-w-md w-full text-center p-8 border-orange-100 shadow-xl">
            <AlertCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Form Configuration Missing</h2>
            <p className="text-slate-600 mb-6">This application form has no sections configured yet. Please contact the administrator.</p>
            <Button onClick={() => window.location.href = "/"} className="bg-orange-600 hover:bg-orange-700">
              Go to Homepage
            </Button>
          </Card>
        </div>
     );
  }
  const progress = ((step + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-sm bg-white/80">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Sankara Logo" className="h-12 w-auto rounded-lg shadow-sm bg-white p-1.5 shrink-0" />
              <div>
                <Badge variant="outline" className="mb-1 border-orange-200 text-orange-700 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  {formInfo.programName}
                </Badge>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-1">{formInfo.title}</h1>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium text-slate-500 mb-1">Step {step + 1} of {sections.length}</div>
              <div className="text-xs font-bold text-orange-600">{Math.round(progress)}% Complete</div>
            </div>
          </div>
          {formInfo.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap mb-4">{formInfo.description}</p>
          )}
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(234,88,12,0.3)]" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        <Card className="border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
          <div className="bg-slate-50/50 px-6 py-8 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentSection.title}</h2>
            {currentSection.description && (
              <div 
                className="text-slate-600 leading-relaxed prose prose-sm max-w-none prose-slate"
                dangerouslySetInnerHTML={{ __html: currentSection.description }}
              />
            )}
          </div>
          
          <CardContent className="p-6 md:p-8 space-y-8">
             {currentSection.fields.map((field: any) => {
               // Conditional visibility logic
               if (field.visibleIf) {
                 const targetValue = form[field.visibleIf.field];
                 const conditionValue = field.visibleIf.contains || field.visibleIf.equals;
                 
                 // Handle nested key checks (e.g., qualification_matrix.DNB)
                 if (field.visibleIf.key) {
                    const nestedVal = targetValue?.[field.visibleIf.key];
                    if (nestedVal !== conditionValue) return null;
                 } else if (field.visibleIf.contains) {
                    if (!targetValue || !targetValue.includes(conditionValue)) return null;
                 } else if (field.visibleIf.equals) {
                    if (targetValue !== conditionValue) return null;
                 }
               }

               return (
                 <div key={field.id} className="space-y-3">
                   {field.type !== 'info' && field.type !== 'heading' && field.type !== 'static_text' && (
                     <Label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                       {field.label}
                       {field.required && <span className="text-orange-600">*</span>}
                     </Label>
                   )}

                  {field.type === 'info' && (
                      <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl shadow-sm">
                         <div className="flex items-start gap-4">
                           <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                             <CreditCard className="w-5 h-5 text-orange-600" />
                           </div>
                           <div>
                             <h4 className="text-sm font-bold text-orange-900 uppercase tracking-wider mb-1">{field.label || "Instruction"}</h4>
                             <div 
                               className="text-sm text-orange-800 leading-relaxed font-medium prose prose-sm max-w-none prose-orange"
                               dangerouslySetInnerHTML={{ __html: field.defaultValue || "" }}
                             />
                           </div>
                         </div>
                      </div>
                    )}

                 {field.type === 'heading' && (
                   <div className="pt-4 pb-2 border-b border-slate-200">
                     <h3 className="text-xl font-bold text-slate-800">{field.label}</h3>
                     {field.description && <p className="text-sm text-slate-500 mt-1">{field.description}</p>}
                   </div>
                 )}

                 {field.type === 'static_text' && (
                   <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                     {field.label}
                   </div>
                 )}

                 {field.type === 'phone' && (
                   <div className="flex gap-2">
                     <div className="relative group">
                       <div className="h-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3 cursor-pointer hover:border-orange-300 transition-all shadow-sm">
                         <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 flex-shrink-0 shadow-sm relative">
                           {/* Indian Flag SVG */}
                           <div className="absolute inset-0 flex flex-col">
                             <div className="flex-1 bg-[#FF9933]"></div>
                             <div className="flex-1 bg-white flex items-center justify-center">
                               <div className="w-1.5 h-1.5 rounded-full border-[0.5px] border-[#000080] flex items-center justify-center">
                                 <div className="w-[0.5px] h-full bg-[#000080] rotate-0"></div>
                                 <div className="w-[0.5px] h-full bg-[#000080] rotate-45 absolute"></div>
                                 <div className="w-[0.5px] h-full bg-[#000080] rotate-90 absolute"></div>
                                 <div className="w-[0.5px] h-full bg-[#000080] rotate-135 absolute"></div>
                               </div>
                             </div>
                             <div className="flex-1 bg-[#128807]"></div>
                           </div>
                         </div>
                         <span className="text-sm font-bold text-slate-700 tracking-tight">+91</span>
                         <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-orange-500 transition-colors" />
                       </div>
                     </div>
                     <input
                       type="text"
                       value={form[field.id] || ""}
                       onChange={(e) => {
                         const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                         set(field.id, val);
                       }}
                       className={`flex-1 px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-medium tracking-wider`}
                       placeholder="10 digit mobile number"
                     />
                   </div>
                 )}

                 {field.type === 'text' && (
                   <input
                     type="text"
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                     placeholder={field.placeholder || field.label}
                   />
                 )}

                 {field.type === 'email' && (
                   <input
                     type="email"
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                     placeholder={field.placeholder || "example@domain.com"}
                   />
                 )}

                 {field.type === 'textarea' && (
                   <textarea
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     rows={4}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                     placeholder={field.label}
                   />
                 )}

                 {field.type === 'select' && (
                   <select
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none bg-white`}
                   >
                     <option value="">Select Option</option>
                     {field.options.map((opt: string) => (
                       <option key={opt} value={opt}>{opt}</option>
                     ))}
                   </select>
                 )}

                 {field.type === 'radio' && (
                   <div className="flex flex-wrap gap-4">
                     {field.options.map((opt: string) => (
                       <label key={opt} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${form[field.id] === opt ? 'border-orange-600 bg-orange-50 text-orange-700 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                         <input
                           type="radio"
                           name={field.id}
                           checked={form[field.id] === opt}
                           onChange={() => set(field.id, opt)}
                           className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500"
                         />
                         <span className="text-sm font-medium">{opt}</span>
                       </label>
                     ))}
                   </div>
                 )}

                 {field.type === 'date' && (
                   <input
                     type="date"
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                   />
                 )}

                 {field.type === 'time' && (
                   <input
                     type="time"
                     value={form[field.id] || ""}
                     onChange={(e) => set(field.id, e.target.value)}
                     className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                   />
                 )}

                 {field.type === 'checkbox' && (
                   <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!form[field.id]}
                        onChange={(e) => set(field.id, e.target.checked)}
                        className="mt-1 w-5 h-5 rounded text-orange-600 border-slate-300 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors leading-relaxed">
                        {field.label}
                      </span>
                   </label>
                 )}

                 {field.type === 'checkbox_group' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {field.options.map((opt: string) => (
                        <label key={opt} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${form[field.id]?.includes(opt) ? 'border-orange-600 bg-orange-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <input
                            type="checkbox"
                            checked={form[field.id]?.includes(opt)}
                            onChange={(e) => {
                               let current = form[field.id] || [];
                               if (e.target.checked) {
                                  if (opt === "None of the Above") {
                                    current = [opt];
                                  } else {
                                    current = current.filter((i: string) => i !== "None of the Above");
                                    current.push(opt);
                                  }
                               } else {
                                  current = current.filter((i: string) => i !== opt);
                               }
                               set(field.id, current);
                            }}
                            className="w-5 h-5 rounded text-orange-600 border-slate-300 focus:ring-orange-500"
                          />
                          <span className="text-sm font-medium text-slate-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                 )}

                 {field.type === 'file' && (
                    <div className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${files[field.id] ? 'border-green-400 bg-green-50/30' : errors[field.id] ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-orange-400 bg-slate-50/30'}`}>
                      <input
                        type="file"
                        onChange={(e) => onFileChange(field.id, e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <div className="text-center">
                        {files[field.id] ? (
                          <>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="text-sm font-bold text-green-700">{files[field.id].name}</p>
                            <p className="text-xs text-green-600 mt-1">File selected successfully</p>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Loader2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600">Click to upload or drag & drop</p>
                            <p className="text-xs text-slate-400 mt-1">PDF or Image (Max 10MB)</p>
                          </>
                        )}
                      </div>
                    </div>
                 )}

                 {field.type === 'skills_table' && (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Skill</th>
                            {field.options.map((opt: string) => (
                              <th key={opt} className="px-4 py-3 text-center font-bold text-slate-700">{opt}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {field.rows.map((row: string) => (
                            <tr key={row} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-medium text-slate-800">{row}</td>
                              {field.options.map((opt: string) => (
                                <td key={opt} className="px-4 py-3 text-center">
                                  <input
                                    type="radio"
                                    name={`${field.id}_${row}`}
                                    checked={form[field.id]?.[row] === opt}
                                    onChange={() => {
                                      const current = form[field.id] || {};
                                      set(field.id, { ...current, [row]: opt });
                                    }}
                                    className="w-4 h-4 text-orange-600"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 )}

                 {field.type === 'qualification_matrix' && (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">Qualification</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700">Yes</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700">No</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700">N/A</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {['DO (Diploma Ophthlmology)', 'MS/MD ( Masters in Ophthalmology)', 'DNB'].map((q: string) => (
                            <tr key={q}>
                              <td className="px-4 py-3 font-medium text-slate-800">{q}</td>
                              {['Yes', 'No', 'N/A'].map((v: string) => (
                                <td key={v} className="px-4 py-3 text-center">
                                  <input
                                    type="radio"
                                    name={`${field.id}_${q}`}
                                    checked={form[field.id]?.[q] === v}
                                    onChange={() => {
                                       const current = form[field.id] || {};
                                       set(field.id, { ...current, [q]: v });
                                    }}
                                    className="w-4 h-4 text-orange-600"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 )}

                 {field.type === 'surgery_table' && (
                    <div className="space-y-6">
                      <div className="overflow-x-auto border rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-wider">Surgery Type</th>
                              <th className="px-6 py-4 text-center font-bold text-slate-700 uppercase tracking-wider bg-orange-50/30">Under Supervision</th>
                              <th className="px-6 py-4 text-center font-bold text-slate-700 uppercase tracking-wider bg-green-50/30">Independently</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {field.rows.map((row: string) => (
                              <tr key={row} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-800">{row}</td>
                                <td className="px-6 py-4 bg-orange-50/10">
                                  <input
                                    type="number"
                                    min="0"
                                    value={form[field.id]?.[row]?.supervision || ""}
                                    onChange={(e) => {
                                      const current = form[field.id] || {};
                                      const rowData = current[row] || {};
                                      set(field.id, { ...current, [row]: { ...rowData, supervision: parseInt(e.target.value) || 0 } });
                                    }}
                                    className="w-full px-3 py-2 text-center rounded-lg border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all font-medium"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-6 py-4 bg-green-50/10">
                                  <input
                                    type="number"
                                    min="0"
                                    value={form[field.id]?.[row]?.independent || ""}
                                    onChange={(e) => {
                                      const current = form[field.id] || {};
                                      const rowData = current[row] || {};
                                      set(field.id, { ...current, [row]: { ...rowData, independent: parseInt(e.target.value) || 0 } });
                                    }}
                                    className="w-full px-3 py-2 text-center rounded-lg border border-slate-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-900 text-white border-t border-slate-800">
                            <tr>
                              <td className="px-6 py-4 font-bold">SECTION TOTALS</td>
                              <td className="px-6 py-4 text-center font-bold text-orange-400 text-lg">
                                {Number(Object.values(form[field.id] || {}).reduce((acc: number, curr: any) => acc + (curr.supervision || 0), 0))}
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-green-400 text-lg">
                                {Number(Object.values(form[field.id] || {}).reduce((acc: number, curr: any) => acc + (curr.independent || 0), 0))}
                              </td>
                            </tr>
                            <tr className="bg-slate-800/50">
                              <td colSpan={3} className="px-6 py-3 text-right text-xs font-medium text-slate-400 italic uppercase tracking-widest">
                                Combined Global Total: <span className="text-white font-bold ml-1">{
                                  Number(Object.values(form[field.id] || {}).reduce((acc: number, curr: any) => acc + (curr.supervision || 0) + (curr.independent || 0), 0))
                                }</span> Surgeries
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                 {field.type === 'number' && (
                    <input
                      type="number"
                      value={form[field.id] || ""}
                      onChange={(e) => set(field.id, e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border ${errors[field.id] ? 'border-red-500 shadow-sm shadow-red-100' : 'border-slate-200'} focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none`}
                      placeholder="0"
                    />
                 )}

                 {errors[field.id] && (
                   <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                     <AlertCircle className="w-3 h-3" /> {errors[field.id]}
                   </p>
                 )}
                 </div>
               );
             })}

             {step === sections.length - 1 && (
               <div className="mb-6 p-5 bg-orange-50 border-2 border-orange-200 rounded-2xl shadow-sm">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                       <CreditCard className="w-5 h-5 text-orange-600" />
                     </div>
                     <div>
                       <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">Total Amount to Pay</p>
                       <p className="text-[10px] text-orange-600">Rs. 2,750 x {Array.isArray(form.specialization) ? form.specialization.length : 1} Specialization{Array.isArray(form.specialization) && form.specialization.length > 1 ? 's' : ''}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <span className="text-2xl font-black text-orange-900">
                       Rs. {(2750 * (Array.isArray(form.specialization) ? form.specialization.length : 1)).toLocaleString("en-IN")}
                     </span>
                   </div>
                 </div>
               </div>
             )}

             {submitError && (
               <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                 <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                 <p className="text-sm font-medium text-red-800">{submitError}</p>
               </div>
             )}
          </CardContent>

          <div className="bg-slate-50 p-6 flex items-center justify-between border-t border-slate-100">
            <Button
              variant="outline"
              onClick={prev}
              disabled={step === 0 || submitting}
              className="h-12 px-6 border-slate-300 hover:bg-white font-semibold"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Previous
            </Button>

            <Button 
              onClick={next} 
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-6 rounded-xl flex items-center gap-2 text-lg font-bold transition-all shadow-lg shadow-orange-200 active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : step === sections.length - 1 ? (
                <>Submit & Pay <ChevronRight className="w-5 h-5" /></>
              ) : (
                <>Next Step <ChevronRight className="w-5 h-5" /></>
              )}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

