#!/usr/bin/env python3

import asyncio
import json
import tempfile
import os
import traceback
import argparse
import configparser
import logging

from hume import AsyncHumeClient
from hume.expression_measurement.batch import Face, Models
from hume.expression_measurement.batch.types import InferenceBaseRequest

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage
from google.cloud.firestore_v1.base_query import FieldFilter


class FacialExpressionProcessor:
    def __init__(self):
        self.init_args()
        self.init_config()
        self.init_logging()
        self.init_firebase()

        self.jobs = []

    def init_args(self):
        parser = argparse.ArgumentParser()
        parser.add_argument('-v', '--verbose', action='store_true')
        
        self.args = parser.parse_args()

    def init_config(self):
        self.config = configparser.ConfigParser()
        self.config.read("service.conf")

        self.secrets = configparser.ConfigParser()
        self.secrets.read("service-secrets.conf")

        self.confidence_treshold = self.config.getfloat('hume.ai', 'confidence_treshold', fallback=0.25)
        self.hume_api_key = self.secrets.get('hume.ai', 'api_key')

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
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        self.db = firestore.client()
        self.bucket = self.config.get('firebase','bucket')

    def listen_for_jobs(self):
        callback_done = asyncio.Event()

        def on_snapshot(doc_snapshot, changes, read_time):
            for change in changes:
                if change.type.name == "ADDED":
                    data = change.document.to_dict()
                    self.jobs.append(data)
                            
            callback_done.set()

        jobs_ref = self.db.collection("jobs")
        query = (jobs_ref
                 .where(filter=FieldFilter("status", "==", "requested"))
                 .where(filter=FieldFilter("type", "==", "DetectFacialExpressions"))
        )
        query.on_snapshot(on_snapshot)

    def get_requested_jobs(self):
        requested_jobs = self.jobs
        self.jobs = []
        return requested_jobs

    def prepare_job(self, job):
        self.update_job_status(job, "processing", "Downloading video..")
        scene = self.get_scene_from_job(job)
        video_path = self.download_video_from_scene(scene)
        return video_path

    def update_job_status(self, job, status, message=None):
        jobs_ref = self.db.collection("jobs")
        job_ref = jobs_ref.document(job['id'])
        job_ref.update({"status": status, "updated": firestore.SERVER_TIMESTAMP, "message": message })

    def get_scene_from_job(self, job):
        scene_id = job['refId']
        scenes_ref = self.db.collection("scenes")
        scene_ref = scenes_ref.document(scene_id)
        scene = scene_ref.get()

        data = scene.to_dict()
        data['id'] = scene_id

        return data

    def download_video_from_scene(self, scene):
        local_path = tempfile.mktemp(suffix=".mp4")
        remote_path = f"scenes/{scene['id']}/audience.mp4"
        self.log.info(f"Downloading {remote_path} to {local_path}...")

        bucket = storage.bucket(self.bucket)
        blob = bucket.blob(remote_path)
        blob.download_to_filename(local_path)

        return local_path

    def upload_results(self, job, results_path):
        remote_path = f"scenes/{job['refId']}/results.json"
        self.log.info(f"Uploading {results_path} to {remote_path}...")
        self.update_job_status(job, "processing", "Uploading results..")

        bucket = storage.bucket(self.bucket)
        blob = bucket.blob(remote_path)
        blob.upload_from_filename(results_path)

        return remote_path

    def update_scene(self, job, remote_path):
        self.log.info(f"Updating scene {job['refId']} with results path {remote_path}...")
        scenes_ref = self.db.collection("scenes")
        scene_ref = scenes_ref.document(job['refId'])
        scene_ref.update({"results": remote_path })

    async def start_hume_job(self, client, video_path):
        # Define the filepath(s) of the file(s) you would like to analyze
        local_filepaths = [
            open(video_path, mode="rb")
        ]

        # Create configurations for each model you would like to use (blank = default)
        face_config = Face()

        # Create a Models object
        models_chosen = Models(face=face_config)
        
        # Create a stringified object containing the configuration
        stringified_configs = InferenceBaseRequest(models=models_chosen)

        # Start an inference job and print the job_id
        hume_job_id = await client.expression_measurement.batch.start_inference_job_from_local_file(
            json=stringified_configs, file=local_filepaths
        )
        self.log.info(f"Hume Job is {hume_job_id}")
        return hume_job_id

    async def wait_for_hume_job(self, job, client, hume_job_id):
        n = 0
        while True:
            self.update_job_status(job, "processing", f"Waiting on Hume job.. {n}s")
            n += 10
            self.log.info("Waiting for job completion..")
            await asyncio.sleep(10)

            obj = await client.expression_measurement.batch.get_job_details(id=hume_job_id)
            details = obj.dict()
            status = details['state']['status']

            if status == "COMPLETED":
                break

            if status == "FAILED":
                self.log.error(f"Hume Job failed: {details['state']['message']}")
                raise Exception(f"Hume Job failed: {details['state']['message']}")

    async def get_hume_job_results(self, client, hume_job_id):
        results = await client.expression_measurement.batch.get_job_predictions(id=hume_job_id)
        data = results[0].dict()

        predictions = data['results']['predictions'][0]['models']['face']['grouped_predictions'][0]['predictions']

        output = []

        for prediction in predictions:
            row = { 
                "time": prediction['time'],
                "frame": prediction['frame'],
                "box": prediction['box'],
                "emotions": []
            }
            
            emotions = prediction['emotions']
            emotions = sorted(emotions, key=lambda e: e['score'], reverse=True)
            for emotion in emotions:
                emotion['confidence'] = emotion['score']
                emotion['score'] = emotion['confidence']

                if emotion['confidence'] < self.confidence_treshold:
                    break

                row['emotions'].append(emotion)

            if len(row['emotions']) > 0:
                output.append(row)

        return output

    async def process_video(self, job, video_path, results_path):
        # Initialize an authenticated client
        client = AsyncHumeClient(api_key=self.hume_api_key)

        # Upload the video and start the job on Hume
        self.update_job_status(job, "processing", f"Starting Hume job..")
        hume_job_id = await self.start_hume_job(client, video_path)

        # Wait for the job to complete and periodically update status
        await self.wait_for_hume_job(job, client, hume_job_id)

        # Get the results from the job
        self.update_job_status(job, "processing", f"Getting predictions..")
        output = await self.get_hume_job_results(client, hume_job_id)
        
        # Write the results to the path requested
        with open(results_path, "w") as fil:
            fil.write(json.dumps(output))
            
    async def process(self):
        jobs = self.get_requested_jobs()

        for job in jobs:
            try:
                # Prepare job by marking it as processing and downloading the video
                video_path = self.prepare_job(job)
                results_path = video_path.replace(".mp4", ".json")        

                # Process the video and save the results to a temp json file
                await self.process_video(job, video_path, results_path)
            
                # Upload the results to firebase storage
                remote_path = self.upload_results(job, results_path)
            
                # Update the scene with the results path
                self.update_scene(job, remote_path)

                # Clean up the temp files
                os.remove(video_path)
                os.remove(results_path)

                # Mark the job as completed
                self.update_job_status(job, "completed")
            except Exception as e:
                print(traceback.format_exc())
                self.update_job_status(job, "failed", str(e))

async def main():
    processor = FacialExpressionProcessor()
    processor.listen_for_jobs()

    while True:
        await processor.process()
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())

