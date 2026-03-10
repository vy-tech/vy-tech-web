# About Vy

At the core of every advance in the AI revolution is wisdom derived from people. Large language models ingest vast amounts of information created by people in order to learn how to reason, communicate, and respond. We believe that people, especially in groups, and their physical reactions to the environments around them, also contain valuable wisdom.

These reactions form patterns that machines can learn from in real time. A system can see how engaging a performance is by observing the audience’s response, how dangerous a situation is by reading the people nearby, and how satisfied someone is with a service by understanding their expressions and gestures.

**We unlock the insight embedded in how people physically respond to the world, transforming real-time human behavior into action without compromising privacy.**

# What Vy does

We offer computer vision as a service focused on deriving insight from video of people's reactions
as captured on security cameras. Our product looks at three categories of reaction:

1. Emotions predicted from facial expressions
2. Emotion and intent predicted from passive body language
3. Emotion and intent predicted from active gesturing

These predictions are combined with profile weights using a proprietary algorithm that derives a single VyScore that represents targeted outcomes such as engagement, satisfaction, and safety.

The VyScore can be associated with external data sources to associate performance with engagement, or sales with satisfaction, etc. Users can iteract with these datasets via an interactive dashboard, in tandem with an LLM
chat interface, or through a developer API.

# About the `vy-tech-web` project

This web application is the primary way end users access the Vy platform. It is responsible for:

- Information about Vy product offerings
- Authentication and authorization of Vy users
- The VyScore interactive dashboard
- LLM driven chat interface to investigate data
- Developer API access and documentation

More documentation is available under the docs/ directory.

## Project implementation notes

Dependencies:

- Firebase Authentication, Firestore, and Storage
- S3-compatible storage (Minio, Seaweed, Firebase)
- VanJS
- Tailwind CSS
- Rollup
- Docker, Nginx, Express (used for dev/staging)
- Firebase Hosting/Functions (used for production)

Details:

- /server.js: Starting point for dev/staging, shims cloud functions
- /functions/app: Legacy cloud functions that support primary pages
- /functions/chat: Chat interface support functions built using Rollup
- /src: Contains source built by rollup into browser code and non-legacy cloud functions

## Housekeeping Notes

### Updating CORS

```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.12 gsutil cors set cors.json gs://roarscore-1ddf5.firebasestorage.app
```
