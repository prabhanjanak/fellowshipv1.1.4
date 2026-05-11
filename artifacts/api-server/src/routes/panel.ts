import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, candidatesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { sql } from "drizzle-orm";

const router: Router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function getPanels(isMockMode: boolean = false) {
  const panels = (await db.execute(sql`
    SELECT ip.id, ip.name, ip.room_number, ip.program_id, ip.is_active, ip.created_at
    FROM interview_panels ip
    WHERE ip.is_mock = ${isMockMode}
    ORDER BY ip.room_number
  `)).rows as Array<Record<string, unknown>>;

  const members = (await db.execute(sql`
    SELECT ipm.panel_id, ipm.doctor_id, ipm.is_main,
           u.full_name as doctor_name, u.email as doctor_email
    FROM interview_panel_members ipm
    JOIN users u ON u.id = ipm.doctor_id
  `)).rows as Array<Record<string, unknown>>;

  return panels.map((p) => ({
    id: p["id"],
    name: p["name"],
    roomNumber: p["room_number"],
    programId: p["program_id"],
    isActive: p["is_active"],
    createdAt: p["created_at"],
    members: members
      .filter((m) => m["panel_id"] === p["id"])
      .map((m) => ({
        doctorId: m["doctor_id"],
        doctorName: m["doctor_name"],
        doctorEmail: m["doctor_email"],
        isMain: m["is_main"],
      })),
  }));
}

async function getPanelQueue(panelId: number) {
  return (await db.execute(sql`
    SELECT pq.id, pq.panel_id, pq.candidate_id, pq.queue_position, pq.status, pq.called_at, pq.created_at,
           c.full_name as candidate_name, c.candidate_code
    FROM panel_queue pq
    JOIN candidates c ON c.id = pq.candidate_id
    WHERE pq.panel_id = ${panelId}
    ORDER BY pq.queue_position ASC, pq.created_at ASC
  `)).rows as Array<Record<string, unknown>>;
}

// ── Panel CRUD ────────────────────────────────────────────────────────────────

router.get("/panels",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator", "doctor", "display_operator" as never),
  async (req: any, res) => {
    res.json(await getPanels(req.isMockMode));
  }
);

router.post("/panels",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const { name, roomNumber, programId, doctorIds, mainDoctorId } = req.body as {
      name: string; roomNumber: string; programId?: number;
      doctorIds?: number[]; mainDoctorId?: number;
    };
    if (!name || !roomNumber) return res.status(400).json({ error: "name and roomNumber required" });

    const [panel] = (await db.execute(sql`
      INSERT INTO interview_panels (name, room_number, program_id)
      VALUES (${name}, ${roomNumber}, ${programId ?? null})
      RETURNING *
    `)).rows as Array<Record<string, unknown>>;

    if (doctorIds?.length) {
      for (const did of doctorIds) {
        await db.execute(sql`
          INSERT INTO interview_panel_members (panel_id, doctor_id, is_main)
          VALUES (${panel!["id"]}, ${did}, ${did === mainDoctorId})
          ON CONFLICT (panel_id, doctor_id) DO NOTHING
        `);
      }
    }
    res.status(201).json((await getPanels((req as any).isMockMode)).find((p) => p.id === panel!["id"]));
  }
);

router.patch("/panels/:id",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const id = Number(req.params["id"]);
    const { name, roomNumber, isActive } = req.body as { name?: string; roomNumber?: string; isActive?: boolean };
    const parts: string[] = [];
    if (name !== undefined) parts.push(`name = '${name.replace(/'/g, "''")}'`);
    if (roomNumber !== undefined) parts.push(`room_number = '${roomNumber.replace(/'/g, "''")}'`);
    if (isActive !== undefined) parts.push(`is_active = ${isActive}`);
    if (parts.length) {
      await db.execute(sql.raw(`UPDATE interview_panels SET ${parts.join(", ")} WHERE id = ${id}`));
    }
    res.json((await getPanels((req as any).isMockMode)).find((p) => p.id === id) ?? { error: "Not found" });
  }
);

router.delete("/panels/:id",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const id = Number(req.params["id"]);
    await db.execute(sql`DELETE FROM panel_queue WHERE panel_id = ${id}`);
    await db.execute(sql`DELETE FROM interview_panel_members WHERE panel_id = ${id}`);
    await db.execute(sql`DELETE FROM interview_panels WHERE id = ${id}`);
    res.json({ success: true });
  }
);

// ── Panel Members ──────────────────────────────────────────────────────────────

router.post("/panels/:id/members",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const { doctorId, isMain } = req.body as { doctorId: number; isMain?: boolean };
    await db.execute(sql`
      INSERT INTO interview_panel_members (panel_id, doctor_id, is_main)
      VALUES (${panelId}, ${doctorId}, ${isMain ?? false})
      ON CONFLICT (panel_id, doctor_id) DO UPDATE SET is_main = ${isMain ?? false}
    `);
    if (isMain) {
      await db.execute(sql`
        UPDATE interview_panel_members SET is_main = FALSE
        WHERE panel_id = ${panelId} AND doctor_id != ${doctorId}
      `);
    }
    res.json({ success: true });
  }
);

router.delete("/panels/:id/members/:doctorId",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const doctorId = Number(req.params["doctorId"]);
    await db.execute(sql`
      DELETE FROM interview_panel_members WHERE panel_id = ${panelId} AND doctor_id = ${doctorId}
    `);
    res.json({ success: true });
  }
);

// ── Queue Management ───────────────────────────────────────────────────────────

router.get("/panels/:id/queue",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator", "doctor", "display_operator" as never),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const rows = await getPanelQueue(panelId);
    res.json(rows.map((r) => ({
      id: r["id"], panelId: r["panel_id"], candidateId: r["candidate_id"],
      candidateName: r["candidate_name"], candidateCode: r["candidate_code"],
      queuePosition: r["queue_position"], status: r["status"],
      calledAt: r["called_at"], createdAt: r["created_at"],
    })));
  }
);

router.post("/panels/:id/queue",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const { candidateId } = req.body as { candidateId: number };

    // Get max position
    const [maxRow] = (await db.execute(sql`
      SELECT COALESCE(MAX(queue_position), -1) as max_pos FROM panel_queue WHERE panel_id = ${panelId}
    `)).rows as Array<Record<string, unknown>>;
    const nextPos = Number(maxRow!["max_pos"]) + 1;

    await db.execute(sql`
      INSERT INTO panel_queue (panel_id, candidate_id, queue_position, status)
      VALUES (${panelId}, ${candidateId}, ${nextPos}, 'waiting')
      ON CONFLICT (panel_id, candidate_id) DO NOTHING
    `);
    res.json({ success: true });
  }
);

router.patch("/panels/:id/queue/:candidateId",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator", "doctor"),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const candidateId = Number(req.params["candidateId"]);
    const { status } = req.body as { status: "waiting" | "in_progress" | "done" };

    if (status === "in_progress") {
      // Mark any existing in_progress as done first
      await db.execute(sql`
        UPDATE panel_queue SET status = 'done' WHERE panel_id = ${panelId} AND status = 'in_progress'
      `);
      await db.execute(sql`
        UPDATE panel_queue SET status = 'in_progress', called_at = NOW()
        WHERE panel_id = ${panelId} AND candidate_id = ${candidateId}
      `);
      // Update doctor_panel_status for all panel members
      const members = (await db.execute(sql`
        SELECT doctor_id FROM interview_panel_members WHERE panel_id = ${panelId}
      `)).rows as Array<Record<string, unknown>>;
      for (const m of members) {
        await db.execute(sql`
          INSERT INTO doctor_panel_status (doctor_id, is_engaged, engaged_since, current_candidate_id, updated_at)
          VALUES (${m["doctor_id"]}, TRUE, NOW(), ${candidateId}, NOW())
          ON CONFLICT (doctor_id) DO UPDATE
            SET is_engaged = TRUE, engaged_since = NOW(), current_candidate_id = ${candidateId}, updated_at = NOW()
        `);
      }
    } else if (status === "done") {
      await db.execute(sql`
        UPDATE panel_queue SET status = 'done' WHERE panel_id = ${panelId} AND candidate_id = ${candidateId}
      `);
      const members = (await db.execute(sql`
        SELECT doctor_id FROM interview_panel_members WHERE panel_id = ${panelId}
      `)).rows as Array<Record<string, unknown>>;
      for (const m of members) {
        await db.execute(sql`
          UPDATE doctor_panel_status SET is_engaged = FALSE, current_candidate_id = NULL, updated_at = NOW()
          WHERE doctor_id = ${m["doctor_id"]}
        `);
      }
    } else {
      await db.execute(sql`
        UPDATE panel_queue SET status = ${status} WHERE panel_id = ${panelId} AND candidate_id = ${candidateId}
      `);
    }
    res.json({ success: true });
  }
);

router.delete("/panels/:id/queue/:candidateId",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const panelId = Number(req.params["id"]);
    const candidateId = Number(req.params["candidateId"]);
    await db.execute(sql`
      DELETE FROM panel_queue WHERE panel_id = ${panelId} AND candidate_id = ${candidateId}
    `);
    res.json({ success: true });
  }
);

// ── Public Display Endpoint (display_operator or admin) ────────────────────────

router.get("/display/live", async (req: any, res) => {
    try {
      // Use the middleware-populated isMockMode or fallback to setting
      let isMock = req.isMockMode;
      if (isMock === undefined) {
        const [setting] = await db.select().from(globalSettingsTable).where(eq(globalSettingsTable.key, "mock_mode"));
        isMock = setting?.value === "true";
      }

      const panels = (await db.execute(sql`
        SELECT ip.id, ip.name, ip.room_number, ip.is_active, ip.program_id
        FROM interview_panels ip
        WHERE ip.is_active = TRUE AND ip.is_mock = ${isMock}
        ORDER BY ip.room_number
      `)).rows as Array<Record<string, unknown>>;

      const result = await Promise.all(panels.map(async (p) => {
        const panelId = Number(p["id"]);
        const programId = p["program_id"] ? Number(p["program_id"]) : null;

        const inProgress = (await db.execute(sql`
          SELECT pq.candidate_id, pq.called_at, c.candidate_code, c.full_name
          FROM panel_queue pq
          JOIN candidates c ON c.id = pq.candidate_id
          WHERE pq.panel_id = ${panelId} AND pq.status = 'in_progress'
          LIMIT 1
        `)).rows as Array<Record<string, unknown>>;

        const nextUp = (await db.execute(sql`
          SELECT pq.candidate_id, c.candidate_code, c.full_name, pq.queue_position
          FROM panel_queue pq
          JOIN candidates c ON c.id = pq.candidate_id
          WHERE pq.panel_id = ${panelId} AND pq.status = 'waiting'
          ORDER BY pq.queue_position ASC
          LIMIT 3
        `)).rows as Array<Record<string, unknown>>;

        const members = (await db.execute(sql`
          SELECT u.full_name as doctor_name
          FROM interview_panel_members ipm
          JOIN users u ON u.id = ipm.doctor_id
          WHERE ipm.panel_id = ${panelId}
          ORDER BY ipm.is_main DESC
        `)).rows as Array<Record<string, unknown>>;

        let batch = null;
        if (programId) {
          const batches = (await db.execute(sql`
            SELECT name, segment, date, timing, venue
            FROM batches
            WHERE program_id = ${programId} AND is_mock = ${isMock}
            LIMIT 1
          `)).rows as Array<Record<string, unknown>>;
          batch = batches[0] ?? null;
        }

        const current = inProgress[0] ?? null;
        return {
          panelId,
          panelName: p["name"],
          roomNumber: p["room_number"],
          isActive: p["is_active"],
          members: members.map(m => m.doctor_name),
          batch: batch,
          current: current ? {
            candidateCode: current["candidate_code"],
            fullName: current["full_name"],
            calledAt: current["called_at"],
          } : null,
          nextQueue: nextUp.map((n) => ({ 
            candidateCode: n["candidate_code"],
            fullName: n["full_name"]
          })),
        };
      }));

      res.json(result);
    } catch (error) {
      logger.error({ error }, "Display live failed");
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// ── Legacy doctor panel status (preserved) ─────────────────────────────────────

async function getLegacyPanelStatus() {
  const rows = await db.execute(sql`
    SELECT dps.id, dps.doctor_id, dps.is_engaged, dps.engaged_since, dps.current_candidate_id, dps.updated_at,
           u.full_name as doctor_name, u.email as doctor_email, u.unit_id,
           un.name as unit_name,
           c.full_name as current_candidate_name, c.candidate_code as current_candidate_code
    FROM doctor_panel_status dps
    JOIN users u ON u.id = dps.doctor_id
    LEFT JOIN units un ON un.id = u.unit_id
    LEFT JOIN candidates c ON c.id = dps.current_candidate_id
    ORDER BY u.full_name
  `);
  return rows.rows;
}

router.get("/panel/live", requireAuth, requireRole("central_exam_coordinator", "super_admin", "program_admin"), async (req, res) => {
  const doctors = await db.select().from(usersTable).where(eq(usersTable.role, "doctor"));
  for (const d of doctors) {
    await db.execute(sql`INSERT INTO doctor_panel_status (doctor_id) VALUES (${d.id}) ON CONFLICT (doctor_id) DO NOTHING`);
  }
  const fresh = await getLegacyPanelStatus();
  res.json(fresh.map((r: Record<string, unknown>) => ({
    doctorId: r["doctor_id"], doctorName: r["doctor_name"], doctorEmail: r["doctor_email"],
    unitId: r["unit_id"], unitName: r["unit_name"],
    isEngaged: r["is_engaged"], engagedSince: r["engaged_since"],
    currentCandidateId: r["current_candidate_id"], currentCandidateName: r["current_candidate_name"],
    currentCandidateCode: r["current_candidate_code"], updatedAt: r["updated_at"],
  })));
});

router.patch("/panel/status", requireAuth, requireRole("doctor"), async (req, res) => {
  const doctorId = req.user!.userId;
  const { isEngaged, candidateId } = req.body as { isEngaged: boolean; candidateId?: number | null };
  await db.execute(sql`INSERT INTO doctor_panel_status (doctor_id) VALUES (${doctorId}) ON CONFLICT (doctor_id) DO NOTHING`);
  if (isEngaged) {
    await db.execute(sql`
      UPDATE doctor_panel_status SET is_engaged = true, engaged_since = now(), current_candidate_id = ${candidateId ?? null}, updated_at = now()
      WHERE doctor_id = ${doctorId}
    `);
  } else {
    await db.execute(sql`
      UPDATE doctor_panel_status SET is_engaged = false, engaged_since = null, current_candidate_id = null, updated_at = now()
      WHERE doctor_id = ${doctorId}
    `);
  }
  const [row] = (await db.execute(sql`
    SELECT dps.*, c.full_name as candidate_name
    FROM doctor_panel_status dps LEFT JOIN candidates c ON c.id = dps.current_candidate_id
    WHERE dps.doctor_id = ${doctorId}
  `)).rows;
  res.json({ doctorId, isEngaged: (row as Record<string, unknown>)["is_engaged"], currentCandidateId: (row as Record<string, unknown>)["current_candidate_id"], currentCandidateName: (row as Record<string, unknown>)["candidate_name"] });
});

router.get("/panel/my-status", requireAuth, requireRole("doctor"), async (req, res) => {
  const doctorId = req.user!.userId;
  await db.execute(sql`INSERT INTO doctor_panel_status (doctor_id) VALUES (${doctorId}) ON CONFLICT (doctor_id) DO NOTHING`);
  const [row] = (await db.execute(sql`
    SELECT dps.*, c.full_name as candidate_name, c.candidate_code,
           ip.name as panel_name, ip.room_number
    FROM doctor_panel_status dps
    LEFT JOIN candidates c ON c.id = dps.current_candidate_id
    LEFT JOIN interview_panel_members ipm ON ipm.doctor_id = ${doctorId}
    LEFT JOIN interview_panels ip ON ip.id = ipm.panel_id
    WHERE dps.doctor_id = ${doctorId}
    LIMIT 1
  `)).rows;
  res.json({
    isEngaged: (row as Record<string, unknown>)["is_engaged"] ?? false,
    currentCandidateId: (row as Record<string, unknown>)["current_candidate_id"],
    currentCandidateName: (row as Record<string, unknown>)["candidate_name"],
    currentCandidateCode: (row as Record<string, unknown>)["candidate_code"],
    panelName: (row as Record<string, unknown>)["panel_name"],
    roomNumber: (row as Record<string, unknown>)["room_number"],
  });
});

export default router;
