
class RSJobs extends RSObject {
    constructor(rs) {
        super(rs);

        this.jobs = van.state({});
    }

    async setup() {
        this.computeLayout();
        await this.load();
    }

    computeLayout() {        
        var lo = this.lo || {};

        lo.jobsWidth = 1200;
        lo.jobsHeight = 400;
        lo.jobsX = lo.width/2 - lo.jobsWidth/2;
        lo.jobsY = lo.height/2 - lo.jobsHeight/2;

        this.lo = lo;
        return lo;
    }

    async load() {
        const q = this.db.query(this.db.collection(this.db.instance, "jobs"));
        this.unsubscribe = this.db.onSnapshot(q, (snapshot) => {
            var jobs = {};
            snapshot.forEach((doc) => {
                jobs[doc.id] = doc.data();
            });

            this.jobs.val = jobs;
        });
    }

    getRefName(type, id) {
        if (type == "scene") {
            var scene = this.rs.scenes.getById(id) || { name: "Not found" }
            return scene.name;
        }
        else if (type == "profile") {
            var profile = this.rs.profiles.getById(id) || { name: "Not found" }
            return profile.name;
        }
        else {
            return "Unknown";
        }
    }

    showList() {
        let lo = this.lo;
        const { div, span, table, thead, tbody, tr, th, td, a, button } = van.tags;
        const closed = van.state(false);

        var height = Math.max(lo.jobsHeight, 110 + (Object.keys(this.jobs.val).length +1) * 30);
        var y = lo.height/2 - height/2;

        console.log(lo);
        this.jobsList = FloatingWindow(
            {
                title: "Jobs",
                x: lo.jobsX, y: y, width: lo.jobsWidth, height: height,
                childrenContainerStyleOverrides: { padding: 0 },
                closed, closeCross: null
            },
            span({
                class: "vanui-window-cross",
                style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                onclick: () => closed.val = true
            }, "\u00D7"),
            div(() =>
                table({ class: "list" },
                    thead(
                        tr(
                            th("Ref"),
                            th("Type"),
                            th("Status"),
                            th("Updated"),
                            th("Message")
                        )
                    ),
                    tbody(
                        Object.values(this.jobs.val).map((job) => tr(
                            td(this.getRefName(job.refType,job.refId)),
                            td(job.type),
                            td(job.status),
                            td(job.updated.toDate().toLocaleString()),
                            td(job.message)
                        ))
                    )
                )
            )
        );
        
        this.jobsList.close = () => { closed.val = true; }

        van.add(document.body, this.jobsList);
    }

    async create(type, refType, refId) {
        var docRef = this.db.doc(this.db.collection(this.db.instance, "jobs"));
        var job = {
            id: docRef.id,
            type: type,             // Hume, Download, etc..
            refType: refType,       // scene, profile
            refId: refId,           // Id of refrenced object
            status: "requested",
            created: new Date(),
            updated: new Date(),
            message: ""
        };

        await this.db.setDoc(docRef, job);

        // Update the local scenes cache
        var jobs = { ...this.jobs.val };
        jobs[job.id] = job;
        this.jobs.val = jobs;

        return job;
    }

    waitOnJob(jobId, progress) {
        var self = this;
        const check = function(jobId, resolve, reject, progress) {
            var job = self.jobs.val[jobId];
            
            if (job.status == "completed") {
                resolve(job);
            }
            else if (job.status == "failed") {
                reject(job);
            }
            else {
                progress(job, job.message || job.status);
                setTimeout(() => { check(jobId, resolve, reject, progress); }, 1000);
            }
        }

        return new Promise((resolve, reject) => check(jobId, resolve, reject, progress));
    }
}