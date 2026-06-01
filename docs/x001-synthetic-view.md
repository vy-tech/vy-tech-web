# Exploration 001 - Synthetic View

The purpose of this experiment is to see if we can create a synthetic representation
of the people we have extracted data for within a scene. We will replace the video
with this synthetic view when a user clicks a toggle.

In the first version we will focus only on representing faces. In a later update we can add in support for body though analysis of pose or the body bbox.

A sample expressions json is available at `docs/sample-expressions.json`.

Some faces have POSE data, many do not. We want to represent all faces so we can either ignore POSE for this first exploration or we can try to see how POSE estimates agree on things like gaze direction.

We want to represent the primary emotion expressed for this first exploration and this representation can be done through a 3D model, a set of 2D images, or some other means.
