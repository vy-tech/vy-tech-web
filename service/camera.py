import asyncio
import json
import tempfile
import os
import traceback
import shutil
import subprocess
import re

from firebase_admin import firestore

from asyncio.subprocess import PIPE, STDOUT
from processor import Processor
from jobs import JobManager


class StopCameraProcessor(Processor):
    def __init__(self, parent):
        super().__init__(parent, "StopCamera")

    async def process(self, job):
        self.log.info(f"Processing job {job['id']}")
        # Update the job status to processing
        # Get the camera information from the job
        camera = self.get_camera_from_job(job)

        if not camera:
            raise Exception(f"Camera {camera['id']} not found")
        
        if "status" in camera and camera['status'] != "capturing":
            raise Exception(f"Camera {camera['id']} is not capturing")
        
        self.request_stop(camera)

        await asyncio.sleep(0)

    def get_camera_from_job(self, job):
        camera_id = job['refId']
        cameras_ref = self.db.collection("cameras")
        camera_ref = cameras_ref.document(camera_id)

        camera = camera_ref.get()
        data = camera.to_dict()

        data['id'] = camera_id

        return data
    
    def request_stop(self, camera):
        # Update the camera status in the database
        cameras_ref = self.db.collection("cameras")
        camera_ref = cameras_ref.document(camera['id'])
        update = {
             "updated": firestore.SERVER_TIMESTAMP,
             "stopRequested": True
        }

        camera_ref.update(update)


class StartCameraProcessor(Processor):
    def __init__(self, parent):
        super().__init__(parent, "StartCamera")
        self.stop_events = {}

    async def process(self, job):
        self.log.info(f"Processing job {job['id']}")
        # Update the job status to processing
        # Get the camera information from the job
        camera = self.get_camera_from_job(job)

        if not camera:
            raise Exception(f"Camera {camera['id']} not found")
        
        if "status" in camera and camera['status'] != "stopped":
            raise Exception(f"Camera {camera['id']} is already running")
        
        self.update_camera_status(camera, "starting")

        try:
            # Initialize the stop event
            self.init_stop_event(camera)

            # Ensure the camera directory exists
            dest_path = self.ensure_dest_path(camera)

            # Get the camera capture command
            cmd = self.get_capture_cmd(camera, dest_path)

            # Execute the command
            await self.capture(cmd, camera)
        except Exception as e:
            self.update_camera_status(camera, "stopped")
            raise e

    def get_camera_from_job(self, job):
        camera_id = job['refId']
        cameras_ref = self.db.collection("cameras")
        camera_ref = cameras_ref.document(camera_id)

        def on_snapshot(doc_snapshot, changes, read_time):
            for doc in doc_snapshot:
                data = doc.to_dict()
                data['id'] = doc.id
                if "stopRequested" in data and data['stopRequested']:
                    self.request_stop(data)

        camera_ref.on_snapshot(on_snapshot)
        camera = camera_ref.get()

        data = camera.to_dict()
        data['id'] = camera_id

        return data

    def ensure_dest_path(self, camera):
        # Create a subdirectory for the camera
        dest_path = os.path.join(self.config.get("DEFAULT", "data_path"), camera['id'])
        if not os.path.exists(dest_path):
            os.makedirs(dest_path)

        return dest_path

    def init_stop_event(self, camera):
        self.stop_events[camera['id']] = asyncio.Event()
    
    def request_stop(self, camera):
        if camera['id'] in self.stop_events:
            self.stop_events[camera['id']].set()
            self.log.info(f"Set stop_event for camera {camera['id']}")

    def get_stop_event(self, camera):
        return self.stop_events.get(camera['id'])
    
    def get_capture_cmd(self, camera, dest_path):
        prefix = camera['prefix']
        rtsp_url = camera['rtspUrl']
        filename = f"{prefix}-%Y%m%d-%H%M%S.mp4"
        path = os.path.join(dest_path, filename)

        # Get the capture command for the camera
        cmd = [
            "ffmpeg",
            "-rtsp_transport", "tcp",
            "-i", f"\"{rtsp_url}\"",
            "-c:v", "copy",
            "-f", "segment",
            "-segment_time", "60",
            "-reset_timestamps", "1",
            "-nostats",
            "-y",
            "-strftime", "1",
            path
        ]

        return " ".join(cmd)

    def update_camera_status(self, camera, status, pid=None, filename=None):
        # Update the camera status in the database
        cameras_ref = self.db.collection("cameras")
        camera_ref = cameras_ref.document(camera['id'])
        update = {"status": status,
             "processor": self.job_manager.processor_id,
             "updated": firestore.SERVER_TIMESTAMP}

        if pid:
            update["pid"] = pid

        if filename:
            update["filename"] = filename

        if status == "starting" or status == "stopped":
            update["stopRequested"] = firestore.DELETE_FIELD

        camera_ref.update(update)

    def add_video_to_collection(self, camera, filename):
        # Add the video to the videos collection
        videos_ref = self.db.collection("videos")
        video_ref = videos_ref.document()

        video_ref.set({
            "id": video_ref.id,
            "cameraId": camera['id'],
            "filename": filename,
            "created": firestore.SERVER_TIMESTAMP,
            "updated": firestore.SERVER_TIMESTAMP
        })
    
    def get_filename_from_line(self, line):
        mat = re.search(r"Opening '(.*?)' for writing", line)
        return (mat and mat.group(1)) or None
    
    async def capture(self, cmd, camera):
        # Start the ffmpeg process
        process = await asyncio.create_subprocess_shell(cmd, stdin = PIPE, stdout = PIPE, stderr = STDOUT)
        stopevent_task = asyncio.create_task(self.get_stop_event(camera).wait())

        # Read from stdout and stderr and output to log
        while True:
            # Wait for a line or stop event
            readline_task = asyncio.create_task(process.stdout.readline())
            done, pending = await asyncio.wait([readline_task, stopevent_task], 
                                               return_when=asyncio.FIRST_COMPLETED)

            if stopevent_task in done:
                self.log.info(f"Stopping camera {camera['id']}")
                process.stdin.write(b'q')
                await process.stdin.drain()
                break

            line = readline_task.result()

            # If line is None the process ended
            if not line:
                break

            # Decode the line and log it
            line = line.decode().strip()
            self.log.info(f"[ffmpeg] {line}")
            filename = self.get_filename_from_line(line)

            # If a filename was found, update the camera status, and add to the videos collection
            if filename:
                self.update_camera_status(camera, "capturing", process.pid, filename)
                self.add_video_to_collection(camera, filename)

        # Check the return code
        return_code = await process.wait()
        if return_code != 0:
            self.log.error(f"ffmpeg process exited with code {return_code}")
            raise Exception(f"ffmpeg process exited with code {return_code}")
        
        # Process completed successfully
        self.log.info("Camera capture completed successfully")
        
        # Update the camera status
        self.update_camera_status(camera, "stopped")

        return True