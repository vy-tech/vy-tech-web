
class RSJobs extends EventTarget {
    constructor(rs) {
        super();

        this.rs = rs;
        this.fb = rs.fb;
        this.lo = rs.lo;

        this.jobs = van.state({});
    }

    async setup() {
        this.computeLayout();
        await this.load();
    }

    computeLayout() {        
        var lo = this.lo || {};

        lo.sceneWidth = 630;
        lo.sceneHeight = 245;
        lo.sceneX = lo.width/2 - lo.sceneWidth/2;
        lo.sceneY = lo.height/2 - lo.sceneHeight/2;

        this.lo = lo;
        return lo;
    }

    async load() {
        // TODO Set to subscribe not just fetch
        console.log("Fetching jobs..");
        var scenes = {};
        const snapshot = await this.fb.getDocs(this.fb.collection(this.fb.db, "jobs"));

        snapshot.forEach((doc) => {
            scenes[doc.id] = doc.data();
        });

        console.log("Setting jobs..");
        this.scenes.val = scenes;
    }

    showList() {
        let lo = this.lo;
        const { div, span, table, thead, tbody, tr, th, td, a, button } = van.tags;
        const closed = van.state(false);

        var height = Math.max(lo.listHeight, 110 + (Object.keys(this.scenes.val).length +1) * 30);
        var y = lo.height/2 - height/2;

        this.scenesList = FloatingWindow(
            {
                title: "Jobs",
                x: lo.listX, y: y, width: lo.listWidth, height: height,
                childrenContainerStyleOverrides: { padding: 0 },
                closed, closeCross: null
            },
            span({
                class: "vanui-window-cross",
                style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                onclick: () => closed.val = true
            }, "×"),
            div(
                table({ class: "list" },
                    thead(
                        tr(
                            th("Type"),
                            th("Status"),
                            th("Created"),
                            th("Updated"),
                            th("RefType"),
                            th("RefId")
                        )
                    ),
                    tbody(
                        Object.values(this.scenes.val).map((scene) => tr(
                            td(scene.type),
                            td(scene.status),
                            td(scene.created),
                            td(scene.updated),
                            td(scene.refType),
                            td(scene.refId)
                        ))
                    )
                )
            )
        );
        
        this.scenesList.close = () => { closed.val = true; }

        van.add(document.body, this.scenesList);
    }

    async create(type, refType, refId) {
        var docRef = this.fb.doc(this.fb.collection(this.fb.db, "jobs"));
        var job = {
            id: docRef.id,
            type: type,             // Hume, Download, etc..
            refType: refType,       // scene, profile
            refId: refId,           // Id of refrenced object
            status: "requested",
            created: new Date(),
            updated: new Date()
        };

        await this.fb.setDoc(docRef, job);

        // Update the local scenes cache
        var jobs = { ...this.jobs.val };
        jobs[job.id] = job;
        this.jobs.val = jobs;

        return job;
    }
}