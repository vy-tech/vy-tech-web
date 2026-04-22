import van from "vanjs-core";
import { eventBus } from "./eventbus.js";
import { FileUploadPanel, UPLOAD_TYPES } from "./ui/fileUpload.js";

class Uploads {
    constructor() {
        this.panels = {};
    }

    init() {
        eventBus.on("auth.unauthenticated", () => {
            window.location.href =
                "/users/login?return_url=" +
                encodeURIComponent(window.location.href);
        });

        this.addElements();
    }

    addElements(parentElement) {
        const { main, div, h1, p, a } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        const videoPanel = new FileUploadPanel(UPLOAD_TYPES.video);
        this.panels.video = videoPanel;

        van.add(
            parentElement,
            main(
                { class: "w-full p-4 overflow-auto" },
                div(
                    { class: "max-w-4xl mx-auto" },
                    h1(
                        { class: "text-2xl font-bold mb-2 dark:text-white" },
                        "Uploads"
                    ),
                    p(
                        {
                            class: "text-sm text-gray-600 dark:text-gray-400 mb-6",
                        },
                        "Upload videos for behavior analysis. New to Vy? See the ",
                        a(
                            {
                                href: "/docs#getting-started",
                                class: "text-blue-600 dark:text-blue-400 hover:underline",
                            },
                            "Getting Started"
                        ),
                        " guide."
                    ),
                    videoPanel.createElement()
                )
            )
        );
    }
}

const uploads = new Uploads();
export { Uploads, uploads };

if (typeof window !== "undefined") {
    window._vy_uploads = uploads;
}
