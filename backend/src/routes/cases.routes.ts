import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadCasePhotos } from "../middleware/upload";
import caseService from "../services/case.service";
import matchService from "../services/match.service";
import mlService from "../services/ml.service";
import voiceService from "../services/voice.service";
import { CreateCaseRequest, SearchCasesQuery } from "../types";
import { intakeQueue } from "../queues";

const router = Router();

/**
 * POST /api/cases
 * Create a new case (Sherlock only)
 */
router.post(
  "/",
  authenticate,
  uploadCasePhotos,
  async (req: AuthRequest, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const data: CreateCaseRequest = req.body;

      // Get photo URLs
      const reporter_photo_url = files?.reporter_photo?.[0]?.filename
        ? `/uploads/${files.reporter_photo[0].filename}`
        : undefined;
      const person_photo_url = files?.person_photo?.[0]?.filename
        ? `/uploads/${files.person_photo[0].filename}`
        : undefined;
      const found_person_photo_url = files?.found_person_photo?.[0]?.filename
        ? `/uploads/${files.found_person_photo[0].filename}`
        : undefined;

      // Parse numeric fields from FormData (multipart sends everything as strings)
      const gps_lat = parseFloat(data.gps_lat as any);
      const gps_lng = parseFloat(data.gps_lng as any);
      const person_age = data.person_age
        ? parseInt(data.person_age as any, 10)
        : undefined;
      const person_height = data.person_height
        ? parseInt(data.person_height as any, 10)
        : undefined;

      if (isNaN(gps_lat) || isNaN(gps_lng)) {
        return res
          .status(400)
          .json({ error: "Valid GPS coordinates are required" });
      }

      // Create case
      const newCase = await caseService.createCase({
        ...data,
        gps_lat,
        gps_lng,
        person_age: person_age && !isNaN(person_age) ? person_age : undefined,
        person_height:
          person_height && !isNaN(person_height) ? person_height : undefined,
        reporter_photo_url,
        person_photo_url,
        found_person_photo_url,
        sherlock_id: req.user!.id,
        urgency: data.urgency || "P2",
      });

      // Add to intake queue for processing
      await intakeQueue.add(
        "process-case",
        {
          case_id: newCase.case_id,
          urgency: newCase.urgency,
        },
        {
          priority:
            newCase.urgency === "P1" ? 1 : newCase.urgency === "P2" ? 5 : 10,
        },
      );

      res.status(201).json(newCase);
    } catch (error: any) {
      console.error("Create case error:", error);
      res.status(500).json({ error: error.message || "Failed to create case" });
    }
  },
);

/**
 * POST /api/cases/parse-voice
 * Parse voice transcript and extract form fields using Claude AI
 */
router.post(
  "/parse-voice",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const { transcript, caseType } = req.body;

      if (!transcript || typeof transcript !== "string") {
        return res.status(400).json({ error: "Transcript text is required" });
      }

      if (!["lost", "searching", "found"].includes(caseType)) {
        return res.status(400).json({ error: "Invalid case type" });
      }

      // Limit transcript length to prevent abuse
      const trimmed = transcript.slice(0, 2000);

      const fields = await voiceService.parseTranscript(trimmed, caseType);
      res.json({ fields, transcript: trimmed });
    } catch (error: any) {
      console.error("Voice parse error:", error);
      res.status(500).json({ error: error.message || "Failed to parse voice input" });
    }
  }
);

/**
 * GET /api/cases/:case_id
 * Get case details
 */
router.get("/:case_id", authenticate, async (req, res) => {
  try {
    const caseData = await caseService.getCaseById(req.params.case_id);

    if (!caseData) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Get ML predictions
    const predictions = await mlService.predictZones(caseData.case_id);

    // Get matches
    const matches = await matchService.getMatchesForCase(caseData.case_id);

    res.json({
      ...caseData,
      ml_predictions: predictions,
      potential_matches: matches,
    });
  } catch (error: any) {
    console.error("Get case error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cases
 * Search cases with filters
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const filters: SearchCasesQuery = {
      status: req.query.status as any,
      urgency: req.query.urgency as any,
      zone: req.query.zone as string,
      age: req.query.age ? parseInt(req.query.age as string) : undefined,
      gender: req.query.gender as string,
      has_photo: req.query.has_photo === "true",
      broadcast_active: req.query.broadcast_active === "true",
      text: req.query.text as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await caseService.searchCases(filters);

    res.json(result);
  } catch (error: any) {
    console.error("Search cases error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/cases/:case_id
 * Update case
 */
router.patch("/:case_id", authenticate, async (req, res) => {
  try {
    const updates = req.body;
    const updatedCase = await caseService.updateCase(
      req.params.case_id,
      updates,
    );

    res.json(updatedCase);
  } catch (error: any) {
    console.error("Update case error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/cases/:case_id/still-searching
 * Extend broadcast (Sherlock renewal)
 */
router.post("/:case_id/still-searching", authenticate, async (req, res) => {
  try {
    const { minutes = 30 } = req.body;

    const updatedCase = await caseService.extendBroadcast(
      req.params.case_id,
      minutes,
    );

    res.json({
      message: "Broadcast extended",
      case: updatedCase,
      new_expiry: updatedCase.broadcast_expires_at,
    });
  } catch (error: any) {
    console.error("Extend broadcast error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cases/zone/:zone_id
 * Get cases by zone (Police)
 */
router.get("/zone/:zone_id", authenticate, async (req, res) => {
  try {
    const cases = await caseService.getCasesByZone(
      req.params.zone_id,
      "active",
    );

    res.json(cases);
  } catch (error: any) {
    console.error("Get zone cases error:", error);
    res.status(500).json({ error: error.message });
  }
});
export default router;
