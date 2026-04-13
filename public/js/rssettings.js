import van from './chunks/van-CscOHmlp.js';
import { eventBus } from './chunks/eventbus-CgpxZhAr.js';
import { o as orgContext, a as apiUtil } from './chunks/orgContext-CXpKVdn1.js';
import { d as database } from './chunks/db-s3IORrbE.js';
import { M as Modal } from './chunks/van-ui-DNNh7cjk.js';
import './chunks/index.esm2017-Y6lvFaM5.js';

/**
 * LocationsData manages physical location records for an organization.
 *
 * Locations are stored in the "locations" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - name: Location name
 * - address: Street address
 * - city: City
 * - state: State/province
 * - zip: Postal code
 * - country: Country
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION$3 = "locations";

class LocationsData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION$3, id);
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION$3, { oid: { op: "==", value: oid } });
    }

    async getByToken(oid, token) {
        const results = await database.query(COLLECTION$3, { oid, token });
        return results.length > 0 ? results[0] : null;
    }

    async create(oid, data) {
        const location = { oid, ...data };
        return await database.set(COLLECTION$3, location);
    }

    async update(id, updates) {
        return await database.update(COLLECTION$3, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION$3, id);
    }
}

/**
 * CamerasData manages camera records associated with a location.
 *
 * Cameras are stored in the "cameras" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - location: FK to locations.id
 * - name: Camera name
 * - number: Camera number/identifier
 * - type: Stream type (rtspPull | rtspPush | httpPull | httpPush)
 * - endpointUrl: Stream endpoint URL
 * - monitorEnabled: Boolean
 * - monitorUrl: Monitoring endpoint URL
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION$2 = "cameras";

class CamerasData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION$2, id);
    }

    async getByLocation(oid, location) {
        return await database.query(COLLECTION$2, {
            oid,
            location,
        });
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION$2, {
            oid: { op: "==", value: oid },
        });
    }

    async create(oid, locationId, data) {
        const camera = { oid, location: locationId, ...data };
        return await database.set(COLLECTION$2, camera);
    }

    async update(id, updates) {
        return await database.update(COLLECTION$2, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION$2, id);
    }
}

/**
 * ApplicationsData manages application records for an organization.
 *
 * Applications are stored in the "applications" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - name: Application name
 * - description: Application description
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION$1 = "applications";

class ApplicationsData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION$1, id);
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION$1, { oid: { op: "==", value: oid } });
    }

    async create(oid, data) {
        const application = { oid, ...data };
        return await database.set(COLLECTION$1, application);
    }

    async update(id, updates) {
        return await database.update(COLLECTION$1, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION$1, id);
    }
}

/**
 * ApiKeysData manages API keys associated with an application.
 *
 * API keys are stored in the "api_keys" collection:
 * - id: Record identifier (auto-generated)
 * - oid: Organization ID
 * - application: FK to applications.id
 * - name: Human-readable key name
 * - key: The API key value (vyk_ + 32 random hex chars)
 * - expires: Expiration date (optional)
 * - used: Last used date (optional)
 * - created: Timestamp of creation (auto-generated)
 *
 * Keys are written by the /api/org/api_key/generate endpoint.
 */

const COLLECTION = "api_keys";

class ApiKeysData {
    constructor() {}

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByApplication(oid, application) {
        return await database.query(COLLECTION, {
            oid,
            application,
        });
    }

    async getByOrg(oid) {
        return await database.query(COLLECTION, {
            oid,
        });
    }

    async create(keyData) {
        return await database.set(COLLECTION, keyData);
    }

    async update(id, updates) {
        return await database.update(COLLECTION, id, updates);
    }

    async delete(id) {
        return await database.delete(COLLECTION, id);
    }

    async getByHash(keyHash) {
        const results = await database.query(COLLECTION, { keyHash });
        return results[0] || null;
    }
}

/**
 * This class manages the settings for the currently selected organization.
 * It uses a tabbed interface as follows:
 *
 * - Locations: Manages physical locations and cameras installed at each location.
 *   - Locations are stored in the "locations" collection
 *     - id, oid, name, address, city, state, zip, country
 *   - Cameras are stored in the "cameras" collection and reference a location by id
 *     - id, oid, location, name, number, type, endpointUrl, monitorEnabled, monitorUrl
 *
 * - Applications: Manages applications and API keys
 *   - Applications are stored in the "applications" collection
 *     - id, oid, name, description
 *   - API keys are stored in the "api_keys" collection and reference an application by id
 *     - id, oid, application, name, key, expires, used
 *
 * - Billing: TBD — not yet implemented.
 */
class Settings {
    constructor() {
        this.locationsData = new LocationsData();
        this.camerasData = new CamerasData();
        this.applicationsData = new ApplicationsData();
        this.apiKeysData = new ApiKeysData();

        this.activeTab = van.state("locations");
        this.user = van.state(null);
        this.locations = van.state([]);
        this.applications = van.state([]);
    }

    init() {
        eventBus.on("auth.unauthenticated", () => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        eventBus.on("auth.ready", (e) => {
            this.user.val = e.detail.user;
            this.loadData();
        });

        eventBus.on("org.changed", () => {
            this.loadData();
        });

        this.addElements();
    }

    async loadData() {
        await Promise.all([this.loadLocations(), this.loadApplications()]);
    }

    async loadLocations() {
        const oid = orgContext.getCurrentOrgId();
        if (!oid) return;
        const locs = await this.locationsData.getByOrg(oid);
        this.locations.val = locs || [];
    }

    async loadApplications() {
        const oid = orgContext.getCurrentOrgId();
        if (!oid) return;
        const apps = await this.applicationsData.getByOrg(oid);
        this.applications.val = apps || [];
    }

    addElements(parentElement) {
        const { div, main, h1 } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                div(
                    { class: "max-w-4xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-6 dark:text-white" },
                        "Settings"
                    ),
                    this.createTabNav(),
                    div({ class: "mt-4" }, () => {
                        switch (this.activeTab.val) {
                            case "locations":
                                return this.createLocationsTab();
                            case "applications":
                                return this.createApplicationsTab();
                            case "billing":
                                return this.createBillingTab();
                        }
                    })
                )
            )
        );
    }

    createTabNav() {
        const { div, button } = van.tags;

        const tabButton = (id, label) =>
            button(
                {
                    class: () =>
                        `px-4 py-2 font-medium rounded-t-lg border-b-2 transition-colors ${
                            this.activeTab.val === id
                                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800"
                                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`,
                    onclick: () => {
                        this.activeTab.val = id;
                    },
                },
                label
            );

        return div(
            {
                class: "flex space-x-2 border-b border-gray-200 dark:border-gray-700",
            },
            tabButton("locations", "Locations"),
            tabButton("applications", "Applications"),
            tabButton("billing", "Billing")
        );
    }

    // =========================================================================
    // Locations Tab
    // =========================================================================

    createLocationsTab() {
        const { div, h2, p, button, i } = van.tags;

        return div(
            { class: "space-y-4" },
            div(
                { class: "flex justify-between items-center" },
                h2(
                    { class: "text-lg font-semibold dark:text-white" },
                    "Locations"
                ),
                button(
                    {
                        class: "flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors",
                        onclick: () => this.showCreateLocationModal(),
                    },
                    i({ class: "las la-plus" }),
                    "Add Location"
                )
            ),
            div({ class: "space-y-3" }, () => {
                const locs = this.locations.val;
                if (locs.length === 0) {
                    return p(
                        {
                            class: "text-gray-500 dark:text-gray-400 text-center py-8",
                        },
                        "No locations yet. Add your first location."
                    );
                }
                return div(
                    { class: "space-y-3" },
                    ...locs.map((loc) => this.createLocationCard(loc))
                );
            })
        );
    }

    createLocationCard(loc) {
        const { div, span, button, i } = van.tags;

        const addressParts = [loc.city, loc.state].filter(Boolean).join(", ");

        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700",
            },
            div(
                { class: "flex justify-between items-start" },
                div(
                    span(
                        { class: "text-lg font-medium dark:text-white" },
                        loc.name
                    ),
                    addressParts
                        ? div(
                              {
                                  class: "text-sm text-gray-500 dark:text-gray-400 mt-1",
                              },
                              loc.address ? `${loc.address}, ` : "",
                              addressParts
                          )
                        : null
                ),
                div(
                    { class: "flex gap-2" },
                    button(
                        {
                            class: "text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                            onclick: () => this.showCamerasModal(loc),
                        },
                        i({ class: "las la-video mr-1" }),
                        "Cameras"
                    ),
                    button(
                        {
                            class: "text-sm px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors",
                            onclick: () => this.handleDeleteLocation(loc),
                        },
                        i({ class: "las la-trash mr-1" }),
                        "Delete"
                    )
                )
            )
        );
    }

    showCreateLocationModal() {
        const { div, h3, label, input, p, button } = van.tags;
        const closed = van.state(false);
        const creating = van.state(false);
        const error = van.state(null);

        const handleCreate = async () => {
            const name = document.getElementById("locationName").value.trim();
            if (!name) {
                error.val = "Location name is required";
                return;
            }
            creating.val = true;
            error.val = null;
            try {
                const oid = orgContext.getCurrentOrgId();
                const data = {
                    name,
                    address: document
                        .getElementById("locationAddress")
                        .value.trim(),
                    city: document.getElementById("locationCity").value.trim(),
                    state: document
                        .getElementById("locationState")
                        .value.trim(),
                    zip: document.getElementById("locationZip").value.trim(),
                    country: document
                        .getElementById("locationCountry")
                        .value.trim(),
                };
                await this.locationsData.create(oid, data);
                await this.loadLocations();
                closed.val = true;
            } catch (err) {
                console.error("Error creating location:", err);
                error.val = "Failed to create location";
                creating.val = false;
            }
        };

        const field = (id, labelText, placeholder, half = false) =>
            div(
                { class: half ? "w-1/2" : "w-full" },
                label(
                    {
                        for: id,
                        class: "block text-sm text-gray-600 dark:text-gray-400 mb-1",
                    },
                    labelText
                ),
                input({
                    type: "text",
                    id,
                    placeholder,
                    class: "w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                })
            );

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-lg" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        "Add Location"
                    ),
                    div(
                        { class: "space-y-3" },
                        field("locationName", "Location Name", "Name", false),
                        field(
                            "locationAddress",
                            "Address",
                            "Street address",
                            false
                        ),
                        div(
                            { class: "flex gap-3" },
                            field("locationCity", "City", "City", true),
                            field("locationState", "State", "State", true)
                        ),
                        div(
                            { class: "flex gap-3" },
                            field("locationZip", "Zip", "Zip code", true),
                            field("locationCountry", "Country", "Country", true)
                        )
                    ),
                    () =>
                        error.val
                            ? p(
                                  {
                                      class: "text-red-600 dark:text-red-400 mt-3 text-sm",
                                  },
                                  error.val
                              )
                            : null,
                    div(
                        { class: "flex justify-end gap-2 mt-4" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Cancel"
                        ),
                        button(
                            {
                                class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                onclick: handleCreate,
                                disabled: () => creating.val,
                            },
                            () => (creating.val ? "Adding..." : "Add Location")
                        )
                    )
                )
            )
        );
    }

    showCamerasModal(loc) {
        const { div, h3, p, span, label, input, select, option, button } =
            van.tags;

        const oid = orgContext.getCurrentOrgId();
        const closed = van.state(false);
        const cameras = van.state([]);
        const adding = van.state(false);
        const error = van.state(null);

        const loadCameras = async () => {
            const cams = await this.camerasData.getByLocation(oid, loc.id);
            cameras.val = cams || [];
        };

        loadCameras();

        const handleAdd = async () => {
            const name = document.getElementById("cameraName").value.trim();
            if (!name) {
                error.val = "Camera name is required";
                return;
            }
            adding.val = true;
            error.val = null;
            try {
                const oid = orgContext.getCurrentOrgId();
                const data = {
                    name,
                    number: document
                        .getElementById("cameraNumber")
                        .value.trim(),
                    type: document.getElementById("cameraType").value,
                    endpointUrl: document
                        .getElementById("cameraEndpoint")
                        .value.trim(),
                    monitorEnabled: false,
                    monitorUrl: "",
                };
                await this.camerasData.create(oid, loc.id, data);
                await loadCameras();
                document.getElementById("cameraName").value = "";
                document.getElementById("cameraNumber").value = "";
                document.getElementById("cameraEndpoint").value = "";
            } catch (err) {
                console.error("Error adding camera:", err);
                error.val = "Failed to add camera";
            }
            adding.val = false;
        };

        const cameraTypeOptions = [
            "rtspPull",
            "rtspPush",
            "httpPull",
            "httpPush",
        ];

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-2xl" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        `Cameras — ${loc.name}`
                    ),
                    // Camera list
                    div({ class: "space-y-2 mb-6" }, () => {
                        const cams = cameras.val;
                        if (cams.length === 0) {
                            return p(
                                {
                                    class: "text-gray-500 dark:text-gray-400 text-sm py-4 text-center",
                                },
                                "No cameras added yet."
                            );
                        }
                        return div(
                            { class: "space-y-2" },
                            ...cams.map((cam) =>
                                div(
                                    {
                                        class: "flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded",
                                    },
                                    div(
                                        span(
                                            {
                                                class: "font-medium dark:text-white",
                                            },
                                            cam.name
                                        ),
                                        cam.number
                                            ? span(
                                                  {
                                                      class: "ml-2 text-xs text-gray-500 dark:text-gray-400",
                                                  },
                                                  `#${cam.number}`
                                              )
                                            : null,
                                        div(
                                            {
                                                class: "text-xs text-gray-500 dark:text-gray-400 mt-0.5",
                                            },
                                            span(
                                                {
                                                    class: "px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded",
                                                },
                                                cam.type || "unknown"
                                            ),
                                            cam.endpointUrl
                                                ? span(
                                                      {
                                                          class: "ml-2 font-mono",
                                                      },
                                                      cam.endpointUrl
                                                  )
                                                : null
                                        )
                                    ),
                                    button(
                                        {
                                            class: "text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded",
                                            onclick: async () => {
                                                if (
                                                    !confirm(
                                                        `Delete camera "${cam.name}"?`
                                                    )
                                                )
                                                    return;
                                                await this.camerasData.delete(
                                                    cam.id
                                                );
                                                await loadCameras();
                                            },
                                        },
                                        "Delete"
                                    )
                                )
                            )
                        );
                    }),
                    // Add camera form
                    div(
                        {
                            class: "border-t border-gray-200 dark:border-gray-600 pt-4",
                        },
                        p(
                            {
                                class: "text-sm font-medium text-gray-600 dark:text-gray-400 mb-3",
                            },
                            "Add Camera"
                        ),
                        div(
                            { class: "space-y-2" },
                            div(
                                { class: "flex gap-2" },
                                div(
                                    { class: "flex-1" },
                                    label(
                                        {
                                            for: "cameraName",
                                            class: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        },
                                        "Name"
                                    ),
                                    input({
                                        type: "text",
                                        id: "cameraName",
                                        placeholder: "Camera name",
                                        class: "w-full px-3 py-1.5 text-sm border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                                    })
                                ),
                                div(
                                    { class: "w-24" },
                                    label(
                                        {
                                            for: "cameraNumber",
                                            class: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        },
                                        "Number"
                                    ),
                                    input({
                                        type: "text",
                                        id: "cameraNumber",
                                        placeholder: "01",
                                        class: "w-full px-3 py-1.5 text-sm border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                                    })
                                )
                            ),
                            div(
                                { class: "flex gap-2" },
                                div(
                                    { class: "w-36" },
                                    label(
                                        {
                                            for: "cameraType",
                                            class: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        },
                                        "Type"
                                    ),
                                    select(
                                        {
                                            id: "cameraType",
                                            class: "w-full px-3 py-1.5 text-sm border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                                        },
                                        ...cameraTypeOptions.map((t) =>
                                            option({ value: t }, t)
                                        )
                                    )
                                ),
                                div(
                                    { class: "flex-1" },
                                    label(
                                        {
                                            for: "cameraEndpoint",
                                            class: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        },
                                        "Endpoint URL"
                                    ),
                                    input({
                                        type: "text",
                                        id: "cameraEndpoint",
                                        placeholder: "rtsp://...",
                                        class: "w-full px-3 py-1.5 text-sm border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                                    })
                                )
                            )
                        ),
                        () =>
                            error.val
                                ? p(
                                      {
                                          class: "text-red-600 dark:text-red-400 text-sm mt-2",
                                      },
                                      error.val
                                  )
                                : null,
                        div(
                            { class: "flex justify-end gap-2 mt-3" },
                            button(
                                {
                                    class: "px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                    onclick: handleAdd,
                                    disabled: () => adding.val,
                                },
                                () => (adding.val ? "Adding..." : "Add Camera")
                            )
                        )
                    ),
                    div(
                        { class: "flex justify-end mt-4" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Close"
                        )
                    )
                )
            )
        );
    }

    async handleDeleteLocation(loc) {
        if (
            !confirm(
                `Delete location "${loc.name}"? This will not delete associated cameras.`
            )
        )
            return;
        await this.locationsData.delete(loc.id);
        await this.loadLocations();
    }

    // =========================================================================
    // Applications Tab
    // =========================================================================

    createApplicationsTab() {
        const { div, h2, p, button, i } = van.tags;

        return div(
            { class: "space-y-4" },
            div(
                { class: "flex justify-between items-center" },
                h2(
                    { class: "text-lg font-semibold dark:text-white" },
                    "Applications"
                ),
                button(
                    {
                        class: "flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors",
                        onclick: () => this.showCreateApplicationModal(),
                    },
                    i({ class: "las la-plus" }),
                    "Add Application"
                )
            ),
            div({ class: "space-y-3" }, () => {
                const apps = this.applications.val;
                if (apps.length === 0) {
                    return p(
                        {
                            class: "text-gray-500 dark:text-gray-400 text-center py-8",
                        },
                        "No applications yet. Add your first application."
                    );
                }
                return div(
                    { class: "space-y-3" },
                    ...apps.map((app) => this.createApplicationCard(app))
                );
            })
        );
    }

    createApplicationCard(app) {
        const { div, span, button, p, i } = van.tags;

        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700",
            },
            div(
                { class: "flex justify-between items-start" },
                div(
                    span(
                        { class: "text-lg font-medium dark:text-white" },
                        app.name
                    ),
                    app.description
                        ? p(
                              {
                                  class: "text-sm text-gray-500 dark:text-gray-400 mt-1",
                              },
                              app.description
                          )
                        : null
                ),
                div(
                    { class: "flex gap-2" },
                    button(
                        {
                            class: "text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                            onclick: () => this.showApiKeysModal(app),
                        },
                        i({ class: "las la-key mr-1" }),
                        "API Keys"
                    ),
                    button(
                        {
                            class: "text-sm px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors",
                            onclick: () => this.handleDeleteApplication(app),
                        },
                        i({ class: "las la-trash mr-1" }),
                        "Delete"
                    )
                )
            )
        );
    }

    showCreateApplicationModal() {
        const { div, h3, label, input, textarea, p, button } = van.tags;
        const closed = van.state(false);
        const creating = van.state(false);
        const error = van.state(null);

        const handleCreate = async () => {
            const name = document.getElementById("appName").value.trim();
            if (!name) {
                error.val = "Application name is required";
                return;
            }
            creating.val = true;
            error.val = null;
            try {
                const oid = orgContext.getCurrentOrgId();
                const data = {
                    name,
                    description: document
                        .getElementById("appDescription")
                        .value.trim(),
                };
                await this.applicationsData.create(oid, data);
                await this.loadApplications();
                closed.val = true;
            } catch (err) {
                console.error("Error creating application:", err);
                error.val = "Failed to create application";
                creating.val = false;
            }
        };

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-md" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        "Add Application"
                    ),
                    div(
                        { class: "space-y-3" },
                        div(
                            label(
                                {
                                    for: "appName",
                                    class: "block text-sm text-gray-600 dark:text-gray-400 mb-1",
                                },
                                "Name"
                            ),
                            input({
                                type: "text",
                                id: "appName",
                                placeholder: "Application name",
                                class: "w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white",
                            })
                        ),
                        div(
                            label(
                                {
                                    for: "appDescription",
                                    class: "block text-sm text-gray-600 dark:text-gray-400 mb-1",
                                },
                                "Description"
                            ),
                            textarea({
                                id: "appDescription",
                                placeholder:
                                    "What is this application used for?",
                                rows: 3,
                                class: "w-full px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none",
                            })
                        )
                    ),
                    () =>
                        error.val
                            ? p(
                                  {
                                      class: "text-red-600 dark:text-red-400 mt-3 text-sm",
                                  },
                                  error.val
                              )
                            : null,
                    div(
                        { class: "flex justify-end gap-2 mt-4" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Cancel"
                        ),
                        button(
                            {
                                class: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors",
                                onclick: handleCreate,
                                disabled: () => creating.val,
                            },
                            () =>
                                creating.val ? "Adding..." : "Add Application"
                        )
                    )
                )
            )
        );
    }

    showApiKeysModal(app) {
        const { div, h3, p, span, input, button, i } = van.tags;
        const closed = van.state(false);
        const keys = van.state([]);
        const generating = van.state(false);
        const error = van.state(null);
        const newlyGeneratedKey = van.state(null); // { id, name, key } shown once
        const copied = van.state(false);

        const loadKeys = async () => {
            const oid = orgContext.getCurrentOrgId();
            const k = await this.apiKeysData.getByApplication(oid, app.id);
            keys.val = k || [];
        };

        loadKeys();

        const handleGenerate = async () => {
            const name = document.getElementById("newKeyName").value.trim();
            if (!name) {
                error.val = "Key name is required";
                return;
            }
            generating.val = true;
            error.val = null;
            try {
                const result = await apiUtil.call("/api/org/key/generate", {
                    application: app.id,
                    name,
                });

                console.log(result);
                if (!result) {
                    error.val = body.message || "Failed to generate API key";
                    generating.val = false;
                    return;
                }

                document.getElementById("newKeyName").value = "";
                newlyGeneratedKey.val = {
                    id: result.id,
                    name: result.name,
                    key: result.key,
                };
                copied.val = false;
                await loadKeys();
            } catch (err) {
                console.error("Error generating API key:", err);
                error.val = "Failed to generate API key";
            }
            generating.val = false;
        };

        van.add(
            document.body,
            Modal(
                { closed, modalClass: "w-full max-w-2xl" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto",
                    },
                    h3(
                        { class: "text-lg font-semibold mb-4 dark:text-white" },
                        `API Keys — ${app.name}`
                    ),
                    // One-time new key display
                    () =>
                        newlyGeneratedKey.val
                            ? div(
                                  {
                                      class: "mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg",
                                  },
                                  p(
                                      {
                                          class: "text-sm font-medium text-green-800 dark:text-green-300 mb-1",
                                      },
                                      i({ class: "las la-check-circle mr-1" }),
                                      `Key "${newlyGeneratedKey.val.name}" generated — copy it now, it won't be shown again.`
                                  ),
                                  div(
                                      { class: "flex gap-2 mt-2" },
                                      div(
                                          {
                                              class: "flex-1 font-mono text-sm bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 px-3 py-2 rounded break-all dark:text-white",
                                          },
                                          newlyGeneratedKey.val.key
                                      ),
                                      button(
                                          {
                                              class: "px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors whitespace-nowrap",
                                              onclick: async () => {
                                                  await navigator.clipboard.writeText(
                                                      newlyGeneratedKey.val.key
                                                  );
                                                  copied.val = true;
                                                  setTimeout(
                                                      () =>
                                                          (copied.val = false),
                                                      2000
                                                  );
                                              },
                                          },
                                          () =>
                                              copied.val
                                                  ? span(
                                                        i({
                                                            class: "las la-check",
                                                        }),
                                                        " Copied!"
                                                    )
                                                  : span(
                                                        i({
                                                            class: "las la-copy",
                                                        }),
                                                        " Copy"
                                                    )
                                      )
                                  )
                              )
                            : div(),
                    // Key list
                    div({ class: "space-y-2 mb-6" }, () => {
                        const k = keys.val;
                        if (k.length === 0) {
                            return p(
                                {
                                    class: "text-gray-500 dark:text-gray-400 text-sm py-4 text-center",
                                },
                                "No API keys yet."
                            );
                        }
                        return div(
                            { class: "space-y-2" },
                            ...k.map((apiKey) =>
                                div(
                                    {
                                        class: "flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded",
                                    },
                                    div(
                                        span(
                                            {
                                                class: "font-medium dark:text-white text-sm",
                                            },
                                            apiKey.name
                                        ),
                                        div(
                                            {
                                                class: "font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5",
                                            },
                                            apiKey.keyPrefix + "..."
                                        )
                                    ),
                                    button(
                                        {
                                            class: "text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded",
                                            onclick: async () => {
                                                if (
                                                    !confirm(
                                                        `Revoke key "${apiKey.name}"? This cannot be undone.`
                                                    )
                                                )
                                                    return;
                                                await this.apiKeysData.delete(
                                                    apiKey.id
                                                );
                                                await loadKeys();
                                            },
                                        },
                                        "Revoke"
                                    )
                                )
                            )
                        );
                    }),
                    // Generate new key form
                    div(
                        {
                            class: "border-t border-gray-200 dark:border-gray-600 pt-4",
                        },
                        p(
                            {
                                class: "text-sm font-medium text-gray-600 dark:text-gray-400 mb-2",
                            },
                            "Generate New Key"
                        ),
                        div(
                            { class: "flex gap-2" },
                            input({
                                type: "text",
                                id: "newKeyName",
                                placeholder: "Key name (e.g. Production)",
                                class: "flex-1 px-3 py-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm",
                            }),
                            button(
                                {
                                    class: "px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors whitespace-nowrap",
                                    onclick: handleGenerate,
                                    disabled: () => generating.val,
                                },
                                () =>
                                    generating.val
                                        ? "Generating..."
                                        : "Generate"
                            )
                        ),
                        () =>
                            error.val
                                ? p(
                                      {
                                          class: "text-red-600 dark:text-red-400 text-sm mt-2",
                                      },
                                      error.val
                                  )
                                : null
                    ),
                    div(
                        { class: "flex justify-end mt-4" },
                        button(
                            {
                                class: "px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors dark:text-white",
                                onclick: () => (closed.val = true),
                            },
                            "Close"
                        )
                    )
                )
            )
        );
    }

    async handleDeleteApplication(app) {
        if (
            !confirm(
                `Delete application "${app.name}"? Associated API keys will remain in the database.`
            )
        )
            return;
        await this.applicationsData.delete(app.id);
        await this.loadApplications();
    }

    // =========================================================================
    // Billing Tab
    // =========================================================================

    createBillingTab() {
        const { div, h2, p } = van.tags;

        return div(
            {
                class: "bg-white dark:bg-gray-800 rounded-lg shadow p-8 border border-gray-200 dark:border-gray-700 text-center",
            },
            h2(
                { class: "text-lg font-semibold dark:text-white mb-2" },
                "Billing"
            ),
            p(
                { class: "text-gray-500 dark:text-gray-400" },
                "Billing management is coming soon."
            )
        );
    }
}

const settings = new Settings();

export { Settings, settings };
//# sourceMappingURL=rssettings.js.map
