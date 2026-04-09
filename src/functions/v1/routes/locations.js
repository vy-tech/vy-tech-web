import { Router } from "express";

import { LocationsData } from "../../../data/locations.js";
import { CamerasData } from "../../../data/cameras.js";

const router = Router();

// Get a list of locations associated with this org
router.get("/", async (req, res) => {
    try {
        const { oid } = req.apiKey;
        const locationsData = new LocationsData();
        const camerasData = new CamerasData();

        const locations = await locationsData.getByOrg(oid);

        const results = await Promise.all(
            locations.map(async (loc) => {
                const cameras = await camerasData.getByLocation(oid, loc.id);
                return {
                    id: loc.id,
                    token: loc.token,
                    name: loc.name,
                    address: loc.address,
                    city: loc.city,
                    state: loc.state,
                    zip: loc.zip,
                    country: loc.country,
                    cameras: cameras.map((cam) => ({
                        id: cam.id,
                        name: cam.name,
                        number: cam.number,
                        type: cam.type,
                    })),
                };
            })
        );

        return res.status(200).json({ locations: results });
    } catch (err) {
        console.error("Error fetching locations:", err);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to fetch locations",
        });
    }
});

export default router;
