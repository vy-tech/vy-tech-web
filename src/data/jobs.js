import { database } from "./db.js";

class JobsData {
    async getByFile(fileId) {
        return await database.query("jobs", { refType: "file", refId: fileId });
    }

    async queueJob(refType, refId, type, uid, oid, location = null) {
        const jobDoc = {
            refType: refType,
            refId: refId,
            type: type,
            status: "requested",
            uid: uid,
            oid: oid,
            location: location,
        };

        return await database.set("jobs", jobDoc);
    }

    watchJobStatus(jobId, onChange) {
        return new Promise((resolve, reject) => {
            const status = {};
            const watched = {};

            const notify = () => {
                const keys = Object.keys(status).sort().reverse();
                onChange(keys.map((key) => status[key]).join("\n"));
            };

            const watchJob = async (id, depth) => {
                if (watched[id]) return;
                watched[id] = true;

                const indent = "  ".repeat(depth);

                const unsub = await database.watch(
                    "jobs",
                    id,
                    async (jobData) => {
                        status[id] =
                            `${indent}${jobData.type} - ${jobData.status}${jobData.message ? ": " + jobData.message : ""}`;

                        if (jobData.children && jobData.children.length > 0) {
                            for (const childId of jobData.children) {
                                await watchJob(childId, depth + 1);
                            }
                        }

                        notify();

                        if (
                            jobData.status === "completed" ||
                            jobData.status === "failed"
                        ) {
                            unsub();
                            if (id === jobId) {
                                if (jobData.status === "completed") {
                                    resolve();
                                } else if (jobData.status === "failed") {
                                    reject(
                                        new Error(
                                            `Job ${jobId} failed: ${jobData.message}`
                                        )
                                    );
                                }
                            }
                        }
                    }
                );
            };

            watchJob(jobId, 0);
        });
    }
}

export { JobsData };
