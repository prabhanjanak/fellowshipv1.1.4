import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

import { db, applicationSubmissionsTable, applicationFormsTable, programsTable, candidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { requireAuth, requireRole } from "./middleware/auth";
import { attachMockMode } from "./middleware/mock";

const app: Express = express();
app.use(attachMockMode);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// GUARANTEED PRINT ROUTE (Directly on app to avoid router conflicts)
app.get(
  "/api/v2/generate-print/:id",
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
      
      let candidateCode = "PENDING";
      if (sub.email) {
        const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.email, sub.email));
        if (candidate) candidateCode = candidate.candidateCode;
      }

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
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
      }

      doc.y = 120;
      doc.fillColor(colors.accent).font('Helvetica-Bold').fontSize(14).text('APPLICATION RECORD');
      doc.moveDown(0.5);
      renderRow('Registration No.', candidateCode);
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
      const centerPrefs = parseCenterPreferences(sub.centerPreference, sub.customAnswers, form?.sectionsConfig ?? undefined);
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

app.use("/objects", express.static(path.join(process.cwd(), "uploads")));

const examDist = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../fellowship-exam/dist",
);

if (fs.existsSync(examDist)) {
  // Serve static files from the build directory
  app.use(express.static(examDist));

  // Handle SPA routing: any non-API route serves index.html
  app.use((req, res, next) => {
    // Skip API and static objects
    if (req.path.startsWith("/api") || req.path.startsWith("/objects")) {
      return next();
    }
    res.sendFile(path.join(examDist, "index.html"));
  });
}

export default app;
