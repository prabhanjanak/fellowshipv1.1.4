import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import programsRouter from "./programs";
import specialitiesRouter from "./specialities";
import unitsRouter from "./units";
import candidatesRouter from "./candidates";
import preferencesRouter from "./preferences";
import documentsRouter from "./documents";
import examsRouter from "./exams";
import questionsRouter from "./questions";
import examAssignmentsRouter from "./exam-assignments";
import attemptsRouter from "./attempts";
import interviewsRouter from "./interviews";
import panelRouter from "./panel";
import doctorsRouter from "./doctors";
import rankingsRouter from "./rankings";
import allocationsRouter from "./allocations";
import dashboardRouter from "./dashboard";
import importExcelRouter from "./import-excel";
import applicationFormsRouter from "./application-forms";
import seatMatrixRouter from "./seat-matrix";
import documentTemplatesRouter from "./document-templates";
import paymentSettingsRouter from "./payment-settings";
import storageRouter from "./storage";
import paymentRouter from "./payment";
import examManagementRouter from "./exam-management";
import debugRouter from "./debug";
import tvAccessRouter from "./tv-access";
import emailSettingsRouter from "./email-settings";
import { db, applicationSubmissionsTable, applicationFormsTable, programsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import path from "path";
import { requireAuth, requireRole } from "../middleware/auth";

const router: IRouter = Router();

router.get("/ping", (req, res) => res.send("pong"));

// Global Print Application Route (Moved here for maximum reliability - TOP PRIORITY)
router.get(
  "/print-application/:id",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const [sub] = await db.select().from(applicationSubmissionsTable).where(eq(applicationSubmissionsTable.id, id));
      if (!sub) return res.status(404).json({ error: "Submission not found" });

      const [form] = await db.select().from(applicationFormsTable).where(eq(applicationFormsTable.id, sub.formId));
      const [program] = form ? await db.select().from(programsTable).where(eq(programsTable.id, form.programId)) : [null];

      const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4',
        info: { Title: `Application - ${sub.fullName}`, Author: 'Sankara Academy of Vision' }
      });
      
      const filename = `Application_${sub.fullName.replace(/\s+/g, '_')}_${id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=${filename}`);
      res.setHeader("Content-Security-Policy", "default-src 'self' 'unsafe-inline' blob: data:; img-src 'self' data: blob:;");
      doc.pipe(res);

      const colors = { primary: '#0f172a', secondary: '#475569', accent: '#2563eb', muted: '#94a3b8', border: '#e2e8f0' };

      const drawSectionHeader = (title: string) => {
        doc.moveDown(1.5);
        const y = doc.y;
        doc.rect(50, y, 500, 20).fill('#f8fafc');
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), 60, y + 5);
        doc.strokeColor(colors.border).lineWidth(0.5).moveTo(50, y + 20).lineTo(550, y + 20).stroke();
        doc.moveDown(0.8);
      };

      const renderRow = (label: string, value: any) => {
        const valText = (value === null || value === undefined || value === "null") ? "—" : String(value);
        doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), { continued: true });
        doc.fillColor(colors.primary).font('Helvetica').fontSize(10).text(` : ${valText}`);
      };

      const parseSpecializations = (spec: string | null | undefined): string[] => {
        if (!spec) return [];
        try {
          const parsed = JSON.parse(spec);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch { }
        return spec.split(",").map((s) => s.trim()).filter(Boolean);
      };

      const parseCenterPreferences = (cp: string | null | undefined, customAnswers?: any, sections?: any[]): Record<string, string> => {
        if (cp) {
          try {
            const parsed = JSON.parse(cp);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
          } catch { }
        }
        if (customAnswers && typeof customAnswers === "object") {
          const prefs: Record<string, string> = {};
          Object.entries(customAnswers).forEach(([key, val]) => {
            if (key.startsWith("unit_") && val) {
              let label = key.replace("unit_", "").replace(/_/g, " ").toUpperCase();
              if (sections) {
                sections.forEach((sec: any) => {
                  sec.fields?.forEach((f: any) => {
                    if (f.id === key) label = f.label.replace(" Preferred Center", "");
                  });
                });
              }
              prefs[label] = Array.isArray(val) ? val.join(", ") : String(val);
            }
          });
          return prefs;
        }
        return {};
      };

      // Header
      doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(22).text('SANKARA ACADEMY OF VISION', { align: 'left' });
      doc.fillColor(colors.primary).font('Helvetica').fontSize(10).text('Educational unit of Sankara Eye Foundation, India', { align: 'left' });
      doc.moveDown(0.2);
      doc.fillColor(colors.muted).fontSize(9).text('FELLOWSHIP PROGRAM ADMISSIONS', { align: 'left' });
      doc.strokeColor(colors.accent).lineWidth(2).moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
      doc.moveDown(2);

      // Photo
      const photoUrl = sub.photoUrl;
      if (photoUrl && photoUrl.startsWith("/objects/")) {
        const localPath = path.join(process.cwd(), "uploads", photoUrl.replace("/objects/", ""));
        try {
          doc.image(localPath, 460, 120, { width: 90, height: 110 });
          doc.rect(460, 120, 90, 110).strokeColor(colors.border).lineWidth(1).stroke();
        } catch (e) {
          doc.rect(460, 120, 90, 110).fill('#f1f5f9');
          doc.fillColor(colors.muted).fontSize(8).text('PHOTO NOT AVAILABLE', 465, 165, { width: 80, align: 'center' });
        }
      } else {
        doc.rect(460, 120, 90, 110).fill('#f1f5f9');
        doc.fillColor(colors.muted).fontSize(8).text('NO PHOTO UPLOADED', 465, 165, { width: 80, align: 'center' });
      }

      doc.y = 120;
      doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(14).text('APPLICATION RECORD');
      doc.moveDown(0.5);
      renderRow('Application ID', id);
      renderRow('Program', program?.name || 'Fellowship Program');
      renderRow('Submission Date', sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('en-GB') : '—');
      renderRow('Status', sub.status.toUpperCase());
      
      drawSectionHeader('Personal Details');
      renderRow('Full Name', sub.fullName);
      renderRow('Email Address', sub.email);
      renderRow('Phone Number', sub.phone);
      renderRow('Date of Birth', sub.dateOfBirth);
      renderRow('Permanent Address', sub.permanentAddress);

      drawSectionHeader('Qualifications');
      renderRow('Degree', sub.degree);
      renderRow('College', sub.medicalCollege);
      renderRow('University', sub.university);
      renderRow('Reg No', sub.medicalCouncilNumber);

      drawSectionHeader('Specialization & Centers');
      const specs = parseSpecializations(sub.specialization);
      const centerPrefs = parseCenterPreferences(sub.centerPreference, sub.customAnswers, form?.sectionsConfig);
      specs.forEach((sp, idx) => {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text(`${idx + 1}. ${sp}`, { continued: true });
        doc.fillColor(colors.secondary).font('Helvetica').fontSize(9).text(` - Center: ${centerPrefs[sp] || 'No preference'}`);
        doc.moveDown(0.2);
      });

      drawSectionHeader('Declaration');
      renderRow('Payment ID', sub.paymentId || '—');
      doc.moveDown(0.5);
      doc.fillColor(colors.secondary).font('Helvetica-Oblique').fontSize(8).text('I hereby declare that the information provided is true.');

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(colors.muted).fontSize(8).text(`Page ${i + 1} of ${range.count}`, 50, 780, { align: 'center' });
      }

      doc.end();
    } catch (e) {
      console.error("[print-gen] error:", e);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
);

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(programsRouter);
router.use(specialitiesRouter);
router.use(unitsRouter);
router.use(candidatesRouter);
router.use(preferencesRouter);
router.use(documentsRouter);
router.use(examsRouter);
router.use(questionsRouter);
router.use(examAssignmentsRouter);
router.use(attemptsRouter);
router.use(interviewsRouter);
router.use(panelRouter);
router.use(doctorsRouter);
router.use(rankingsRouter);
router.use(allocationsRouter);
router.use(dashboardRouter);
router.use(importExcelRouter);
router.use(applicationFormsRouter);
router.use(seatMatrixRouter);
router.use(documentTemplatesRouter);
router.use(paymentSettingsRouter);
router.use(storageRouter);
router.use(paymentRouter);
router.use(examManagementRouter);
router.use(debugRouter);
router.use(tvAccessRouter);
router.use(emailSettingsRouter);

export default router;
