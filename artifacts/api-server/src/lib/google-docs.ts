import { google } from "googleapis";

export type GoogleDocsReplacements = {
  letter_date: string;
  name: string;
  address: string;
  interview_date: string;
  specialization: string;
  unit: string;
  duration: string;
  start_date: string;
  reporting_date: string;
  induction_dates: string;
  stipend: string;
  stipend_words: string;
  reporting_doctor: string;
  signing_authority: string;
};

export async function processGoogleDocTemplate(opts: {
  templateId: string;
  serviceAccountJson: string;
  replacements: GoogleDocsReplacements;
}) {
  const credentials = JSON.parse(opts.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  // 1. Create a temporary copy of the template
  const copyResp = await drive.files.copy({
    fileId: opts.templateId,
    requestBody: {
      name: `Offer Letter - ${opts.replacements.candidateName}`,
    },
  });

  const documentId = copyResp.data.id;
  if (!documentId) throw new Error("Failed to copy template document");

  try {
    // 2. Apply search and replace
    const requests = Object.entries(opts.replacements).map(([key, value]) => ({
      replaceAllText: {
        containsText: {
          text: `{{${key}}}`,
          matchCase: false,
        },
        replaceText: value,
      },
    }));

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    // 3. Export as PDF
    const exportResp = await drive.files.export(
      {
        fileId: documentId,
        mimeType: "application/pdf",
      },
      { responseType: "arraybuffer" }
    );

    return Buffer.from(exportResp.data as ArrayBuffer);
  } finally {
    // 4. Delete the temporary copy
    await drive.files.delete({ fileId: documentId }).catch(e => console.error("[google-docs] failed to cleanup temp file", e));
  }
}
