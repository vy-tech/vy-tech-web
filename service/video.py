import asyncio
import json
import tempfile
import os
import traceback

from concurrent.futures import ProcessPoolExecutor

from hume import AsyncHumeClient, HumeClient
from hume.expression_measurement.batch import Face, Models
from hume.expression_measurement.batch.types import InferenceBaseRequest


from processor import Processor

class VideoProcessor(Processor):
    def __init__(self, parent):
        super().__init__(parent, "DetectFacialExpressions")

        self.confidence_treshold = self.config.getfloat('hume.ai', 'confidence_treshold', fallback=0.25)
        self.hume_api_key = self.secrets.get('hume.ai', 'api_key')

    async def process(self, job):
        try:
            # Prepare job by downloading the video
            video_path = self.prepare_job(job)
            results_path = video_path.replace(".mp4", ".json")        

            # Process the video and save the results to a temp json file
            self.log.info("Processing video...")
            await self.process_video(job, video_path, results_path)
    
            # Upload the results to firebase storage
            self.log.info("Uploading results to firebase storage...")  
            remote_path = self.upload_results(job, results_path)
        
            # Update the scene with the results path
            self.log.info("Updating scene with results path...")
            self.update_scene(job, remote_path)

            # Clean up the temp files
            os.remove(video_path)
            os.remove(results_path)
        except Exception as e:
            self.log.error(traceback.format_exc())
            raise e
            #self.job_manager.update_job_status(job, "failed", str(e))

    def prepare_job(self, job):
        scene = self.get_scene_from_job(job)
        video_path = self.download_video_from_scene(scene)
        return video_path

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
        self.log.debug(f"Downloading {remote_path} to {local_path}...")

        blob = self.storage.blob(remote_path)
        blob.download_to_filename(local_path)

        self.log.debug(f"Downloaded {remote_path} to {local_path}")
        return local_path

    async def process_video(self, job, video_path, results_path):
        # Initialize an authenticated client
        client = AsyncHumeClient(api_key=self.hume_api_key)

        # Upload the video and start the job on Hume
        self.job_manager.update_job_status(job, "processing", f"Starting Hume job..")
        hume_job_id = await self.start_hume_job(client, video_path)

        # Wait for the job to complete and periodically update status
        await self.wait_for_hume_job(job, client, hume_job_id)

        # Get the results from the job
        self.job_manager.update_job_status(job, "processing", f"Getting predictions..")
        output = await self.get_hume_job_results(client, hume_job_id)
        
        # Write the results to the path requested
        with open(results_path, "w") as fil:
            fil.write(json.dumps(output))

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
            self.job_manager.update_job_status(job, "processing", f"Waiting on Hume job.. {n}s")
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

    def fetch_hume_job(self, hume_job_id):
        client = HumeClient(api_key=self.hume_api_key)
        results = client.expression_measurement.batch.get_job_predictions(id=hume_job_id)
        data = results[0].dict()
        self.log.info(data)
        
    async def get_hume_job_results(self, client, hume_job_id):
        results = await client.expression_measurement.batch.get_job_predictions(id=hume_job_id)
        data = results[0].dict()

        # Get all predictions
        predictions = data['results']['predictions']

        # If it's empty, log and raise an error
        if len(predictions) == 0:
            self.log.error("No predictions found in Hume job results:")
            self.log.error(data)
            raise Exception("No predictions found in Hume job results")
        
        # Get the face predictions
        predictions = predictions[0]['models']['face']['grouped_predictions']
        
        # If it's empty, log and raise an error
        if len(predictions) == 0:
            self.log.error("No face predictions found in Hume job results:")    
            self.log.error(data)
            raise Exception("No face predictions found in Hume job results")
        
        # Get the list of face predictions
        predictions = predictions[0]['predictions']

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

    def upload_results(self, job, results_path):
        remote_path = f"scenes/{job['refId']}/results.json"
        self.log.info(f"Uploading {results_path} to {remote_path}...")
        self.job_manager.update_job_status(job, "processing", "Uploading results..")

        blob = self.storage.blob(remote_path)
        blob.upload_from_filename(results_path)

        return remote_path

    def update_scene(self, job, remote_path):
        self.log.info(f"Updating scene {job['refId']} with results path {remote_path}...")
        scenes_ref = self.db.collection("scenes")
        scene_ref = scenes_ref.document(job['refId'])
        scene_ref.update({"results": remote_path })



