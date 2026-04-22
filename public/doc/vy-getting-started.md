# Getting Started

Welcome to Vy. This guide walks you through uploading your first video and seeing behavior analysis results — no code required.

Vy extracts behavior signals (dwell, attention, emotion, and more) from video you capture in your venue, then lets you browse the results by location, time, and event.

> Writing code against the Vy API instead? See the [API Quickstart](/docs#api-quickstart).

---

## 1. Sign in and pick an organization

When you first sign in, Vy creates a **personal organization** for you automatically. Everything you upload is scoped to the selected organization.

- The current organization appears in the top bar. Click it to switch between organizations or create a new one.
- Use your personal org for experimentation.
- To collaborate with teammates, click the org picker and choose **Create Organization**, then invite others from the **Settings** page.

![Selecting an organization](/doc/vy-gs-orgs.png)

---

## 2. Upload your first video

Open the **Uploads** tab in the left sidebar (cloud-upload icon). This is the one-stop place to add videos and, soon, related data like transcripts and point-of-sale receipts.

![Uploads view](/doc/vy-gs-uploads.png)

1. Click **Upload Video**.
2. Choose a local video file. Supported formats: `.mp4`, `.mov`, `.avi`, `.m4v`, `.mkv`.
3. Confirm the filename (defaults to the file's own name) and click **Upload**.

![Upload dialog with a file selected](/doc/vy-gs-upload.png)

You will see a progress bar while the file uploads directly to secure storage. Once the upload finishes, Vy automatically queues a processing job.

> **Tip:** start with a short clip (under a minute) for your first upload so you can quickly see end-to-end results before committing longer footage.

---

## 3. Watch processing progress

After upload, a **Processing...** status appears with a live view of the job pipeline. You can leave the page — processing continues server-side — but while you stay, the status updates in real time.

![File being processed](/doc/vy-gs-process.png)

Because processing runs in 1-minute chunks, it's normal to see many instances of the same kind of processing happening in parallel — each one is handling a different slice of the video.

When processing completes, the status changes to **Processing complete** and the video is ready to view in Reports.

---

## 4. View your results

Open the **Reports** tab in the left sidebar.

- Pick a location and date in the report tree.
- Expand the **Videos** section and click your uploaded file.
- The video player loads alongside visualizations: attention heatmaps, emotion timelines, and the event log.
- Use the heatmap overlays and timeline scrubber to drill into specific moments.

![File shown in the reports view](/doc/vy-gs-reports.png)

The URL updates as you navigate, so you can bookmark any view or share it with a teammate.

---

## 5. Next steps

- **Manage uploads.** Return to **Uploads** anytime to re-upload a replacement for an existing file, or to delete one you no longer need.
- **Invite teammates.** Visit **Settings** to add collaborators to a team org.
- **Billing and credits.** Video processing consumes credits. The **Billing** tab shows your current balance and lets you purchase more.
- **Build an integration.** If you want to upload programmatically or pull processed data into your own tools, read the [API Quickstart](/docs#api-quickstart) and the reference tabs ([Videos](/docs#videos), [Events & Locations](/docs#events-locations), [Annotations](/docs#annotations)).
