#!/usr/bin/env python3

import asyncio
import argparse
import configparser
import logging

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage

from jobs import JobManager
from video import VideoProcessor
from camera import StartCameraProcessor, StopCameraProcessor

class RoarscoreService:
    def __init__(self):
        self.init_args()
        self.init_config()
        self.init_logging()
        self.init_firebase()

    def init_args(self):
        parser = argparse.ArgumentParser()
        parser.add_argument('-v', '--verbose', action='store_true')
        parser.add_argument('-f', '--config', type=str, default='conf/service/service.conf')
        parser.add_argument('--create-job', type=str)
        parser.add_argument('--fetch-hume-job', type=str)
        
        self.args = parser.parse_args()

    def init_config(self):
        self.config = configparser.ConfigParser()
        self.config.read(self.args.config)

        secrets_path = self.config.get('DEFAULT', 'secrets_path', fallback='conf/service/service-secrets.conf')
        self.secrets = configparser.ConfigParser()
        self.secrets.read(secrets_path)

    def init_logging(self):
        self.log = logging.getLogger(__name__)
        level = self.config.get('DEFAULT', 'log_level', fallback='INFO')

        # Override log level with -v
        if self.args.verbose:
            level = 'DEBUG'

        format = self.config.get('DEFAULT', 'log_format', fallback='[%(asctime)s %(levelname)s] %(message)s')

        logging.basicConfig(level=logging.getLevelName(level), format=format)

        path = self.config.get('DEFAULT', 'log_path', fallback=None)
        if path:
            self.log.propagate = True
            self.log_fh = logging.FileHandler(path)
            self.log.addHandler(self.log_fh)

    def init_firebase(self):
        key_path = self.config.get('firebase', 'key_path', fallback='firebase-svc-cred.json')
        self.bucket = self.config.get('firebase','bucket')
        self.cred = credentials.Certificate(key_path)

        firebase_admin.initialize_app(self.cred, {"storageBucket": self.bucket})
        
        self.db = firestore.client()
        self.storage = storage.bucket(self.bucket)

    def create_job(self):
        (job_type, ref_type, ref_id) = self.args.create_job.split(":")
        job_manager = JobManager(self, job_type)
        job_manager.create_job(ref_type, ref_id)
        self.log.info(f"Created job {job_type} for {ref_type}:{ref_id}")

    def fetch_hume_job(self):
        hume_job_id = self.args.fetch_hume_job
        self.log.info(f"Fetching Hume job {hume_job_id}")
        video = VideoProcessor(self)
        video.fetch_hume_job(hume_job_id)
        self.log.info(f"Fetched Hume job {hume_job_id}")

    async def run(self):
        if self.args.create_job:
            self.create_job()
            return

        self.tasks = set()

        if self.args.fetch_hume_job:
            self.fetch_hume_job()
            return
        
        self.log.info("Starting service...")

        self.log.info("Starting video processor...")
        video = VideoProcessor(self)
        task = asyncio.create_task(video.run())
        self.tasks.add(task)
        task.add_done_callback(lambda t: self.tasks.remove(t))

        self.log.info("Starting start camera processor...")
        start_camera = StartCameraProcessor(self)
        task = asyncio.create_task(start_camera.run())
        self.tasks.add(task)
        task.add_done_callback(lambda t: self.tasks.remove(t))

        self.log.info("Starting stop camera processor...")
        stop_camera = StopCameraProcessor(self)
        task = asyncio.create_task(stop_camera.run())
        self.tasks.add(task)
        task.add_done_callback(lambda t: self.tasks.remove(t))

        while True:
            self.log.debug("Tick...")
            await asyncio.sleep(5)

async def main():
    service = RoarscoreService()
    await service.run()

if __name__ == "__main__":
    asyncio.run(main())

