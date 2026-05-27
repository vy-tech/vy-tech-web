import { d as database } from './apiUtil-CDq4WBQY.js';
import { H as Hierarchy } from './hierarchy-HD-XXbBO.js';
import { o as orgContext } from './orgContext-CvnztG5e.js';

class AnnotationsData {
    constructor() {}

    async getByHierarchy(hierarchy) {
        let hier = new Hierarchy(hierarchy);
        let h = hier.toFileOrEventString();

        this.hierarchy = h;
        let annotations = await database.query(
            "annotations",
            { hierarchy: h },
            "time"
        );

        //eventBus.fire("annotations.ready", { hierarchy: h });

        return annotations;
    }

    async getByImportance(importance) {
        let rows = await database.query("annotations", {
            importance: importance,
        });
        return rows;
    }

    async getByImportanceForOrg(importance, orgId) {
        return await database.query("annotations", {
            oid: orgId,
            importance: importance,
        });
    }

    async getByTag(tag) {
        let rows = await database.query("annotations", {
            tags: { value: tag, op: "array-contains" },
        });
        return rows;
    }

    async saveAnnotation(hierarchy, annotation) {
        console.log("Creating annotation:", annotation);

        // Split hierarchy on - or :, take first two parts, and rejoin with :
        annotation.hierarchy = new Hierarchy(hierarchy).toFileOrEventString();

        if (!annotation.oid) {
            annotation.oid = orgContext.getCurrentOrgId();
        }

        await database.set("annotations", annotation);

        return annotation;
    }

    async deleteAnnotation(id) {
        console.log("Deleting annotation:", id);

        await database.delete("annotations", id);
    }

    async deleteTranscript(hierarchy, pct = null, closed = null) {
        // Get existing annotations for this hierarchy and type transcript
        let existing = await this.getByHierarchy(hierarchy);
        if (!existing || existing.length === 0) return;

        existing = existing.filter((a) => a.type === "transcript");

        if (existing.length) {
            if (pct) pct.val = 0;

            // Delete in batches of 10
            for (let i = 0; i < existing.length; i += 10) {
                let batch = existing.slice(i, i + 10);
                let ids = batch.map((a) => a.id);
                await Promise.all(
                    ids.map((id) => database.delete("annotations", id))
                );
                if (pct)
                    pct.val = Math.round(
                        ((i + batch.length) / existing.length) * 100
                    );
            }
            if (closed) closed.val = true;
        }
    }

    async saveTranscript(hierarchy, annotations, pct = null, closed = null) {
        // Save in batches of 10
        for (let i = 0; i < annotations.length; i += 10) {
            const batch = annotations.slice(i, i + 10);
            await Promise.all(
                batch.map((annotation) =>
                    this.saveAnnotation(hierarchy, annotation)
                )
            );
            if (pct)
                pct.val = Math.round(
                    ((i + batch.length) / annotations.length) * 100
                );
        }

        if (closed) closed.val = true;
    }

    // async getAvailable() {
    //     const events = await database.query(
    //         "events",
    //         { status: "available" },
    //         "begin"
    //     );
    //     return events;
    // }
}

const annotationsData = new AnnotationsData();

export { AnnotationsData as A, annotationsData as a };
//# sourceMappingURL=annotations-BN4rneuv.js.map
