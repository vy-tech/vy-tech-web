import { Router } from "express";

import { EventsData } from "../../../data/events.js";
import { LocationsData } from "../../../data/locations.js";
import { ChunksData } from "../../../data/chunk.js";
import Hierarchy from "../../../util/hierarchy.js";
import { getFetchUrl } from "../helpers.js";

const router = Router();

// Get a list of events associated with this org, optionally filtered by location
router.get("/", async (req, res) => {
    try {
        const { oid } = req.apiKey;
        const status = req.query.status || "available";
        const locationParam = req.query.location;

        let locationId;
        if (locationParam) {
            const locationsData = new LocationsData();
            let location;

            if (/^\w{20}$/.test(locationParam)) {
                location = await locationsData.getById(locationParam);
                if (!location) {
                    location = await locationsData.getByToken(oid, locationParam);
                }
            } else {
                location = await locationsData.getByToken(oid, locationParam);
            }

            if (!location) {
                return res.status(404).json({
                    error: "Not Found",
                    message: "Location not found",
                });
            }
            locationId = location.id;
        }

        const eventsData = new EventsData();
        const events = await eventsData.getByOrg(oid, { status, location: locationId });

        const results = events.map((event) => ({
            id: event.id,
            hierarchy: event.hierarchy,
            location: event.location,
            name: event.name,
            status: event.status,
            begin: event.begin?.toDate?.() ?? event.begin,
            end: event.end?.toDate?.() ?? event.end,
            duration: event.summary?.seconds,
            cameras: event.summary?.cameras,
        }));

        return res.status(200).json({ events: results });
    } catch (err) {
        console.error("Error fetching events:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch events",
        });
    }
});

async function buildEventDetailResponse(event, camera) {
    const hierarchy = new Hierarchy(event.hierarchy);
    hierarchy.camera = parseInt(camera);

    const chunkData = new ChunksData();
    const chunks = await chunkData.getByHierarchy(hierarchy);
    const chunkResult = chunks.map((chunk) => ({
        id: chunk.id,
        date: chunk.date,
        minuteOfDay: chunk.minuteOfDay,
        duration: chunk.duration,
        startTime: chunk.startTime,
        playbackMetadata: {
            segments: chunk.playbackSegments,
            durations: chunk.playbackDurations,
            bitrates: chunk.playbackBitrates,
            qualities: chunk.playbackQualities,
            prefix: chunk.playbackPrefix,
        },
        expressionsUrl: getFetchUrl(chunk.storage, chunk.expressionsPath),
        demographicsUrl: getFetchUrl(chunk.storage, chunk.demographicsPath),
    }));

    const summaryPath =
        `summaries/${hierarchy.toFileOrEventString("/")}` +
        `/summary-${hierarchy.toString("-")}.json`;
    const summaryUrl = getFetchUrl("firebase", summaryPath);

    return {
        id: event.id,
        hierarchy: event.hierarchy,
        location: event.location,
        name: event.name,
        status: event.status,
        begin: event.begin?.toDate?.() ?? event.begin,
        end: event.end?.toDate?.() ?? event.end,
        summary: event.summary,
        playlists: {
            "360p": `/playlist/${hierarchy.toString("-")}-360p.m3u8`,
            "720p": `/playlist/${hierarchy.toString("-")}-720p.m3u8`,
            "1080p": `/playlist/${hierarchy.toString("-")}-1080p.m3u8`,
            "4k": `/playlist/${hierarchy.toString("-")}-4k.m3u8`,
        },
        chunks: chunkResult,
        summaryUrl,
    };
}

// Get event detail by location token and date
router.get("/:location_token/:date{/:camera}", async (req, res, next) => {
    const { location_token, date, camera } = req.params;

    if (!/^\d{8}$/.test(date)) {
        return next();
    }

    try {
        const eventsData = new EventsData();
        const event = await eventsData.getByHierarchy(`${location_token}:${date}`);

        if (!event) {
            return res.status(404).json({
                error: "Not Found",
                message: "Event not found",
            });
        }

        if (event.oid !== req.apiKey.oid) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this event",
            });
        }

        const result = await buildEventDetailResponse(event, camera || "01");
        return res.status(200).json(result);
    } catch (err) {
        console.error("Error fetching event:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch event",
        });
    }
});

// Get event detail by document ID
router.get("/:id{/:camera}", async (req, res) => {
    const { id, camera } = req.params;

    try {
        const eventsData = new EventsData();
        const event = await eventsData.getById(id);

        if (!event) {
            return res.status(404).json({
                error: "Not Found",
                message: "Event not found",
            });
        }

        if (event.oid !== req.apiKey.oid) {
            return res.status(403).json({
                error: "Forbidden",
                message: "You do not have access to this event",
            });
        }

        const result = await buildEventDetailResponse(event, camera || "01");
        return res.status(200).json(result);
    } catch (err) {
        console.error("Error fetching event:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch event",
        });
    }
});

export default router;
