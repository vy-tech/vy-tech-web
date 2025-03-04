from secret import *

import time
import asyncio
import json
import tempfile
import os

from hume import AsyncHumeClient
from hume.expression_measurement.batch import Face, Models
from hume.expression_measurement.batch.types import InferenceBaseRequest

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage

THRESHOLD = 0.25
BUCKET = "roarscore-1ddf5.firebasestorage.app"

cred = credentials.Certificate('firebase-svc-cred.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

def repl():
    """This starts a REPL with the callers globals and locals available

    Raises:
        RuntimeError: Is raised when the callers frame is not available
    """
    import code
    import inspect

    frame = inspect.currentframe()
    if not frame:
        raise RuntimeError('No caller frame')

    code.interact(local=dict(frame.f_back.f_globals, **frame.f_back.f_locals))

def get_requested_jobs():
    jobs_ref = db.collection("jobs")
    jobs = jobs_ref.where("status", "==", "requested").where("type", "==", "DetectFacialExpressions").stream()
    return jobs

def prepare_job(job):
    update_job_status(job, "processing")
    scene = get_scene_from_job(job.to_dict())
    video_path = download_video_from_scene(scene)
    return video_path

def update_job_status(job, status):
    jobs_ref = db.collection("jobs")
    job_ref = jobs_ref.document(job.id)
    job_ref.update({"status": status, "updated": firestore.SERVER_TIMESTAMP })

def get_scene_from_job(job):
    scene_id = job['refId']
    scenes_ref = db.collection("scenes")
    scene_ref = scenes_ref.document(scene_id)
    scene = scene_ref.get()

    data = scene.to_dict()
    data['id'] = scene_id

    return data

def download_video_from_scene(scene):
    local_path = tempfile.mktemp(suffix=".mp4")
    remote_path = f"scenes/{scene['id']}/audience.mp4"
    bucket = storage.bucket(BUCKET)
    blob = bucket.blob(remote_path)
    blob.download_to_filename(local_path)

    return local_path

def upload_results(job, results_path):
    data = job.to_dict()
    remote_path = f"/scenes/{data['refId']}/results.json"
    bucket = storage.bucket(BUCKET)
    blob = bucket.blob(remote_path)
    blob.upload_from_filename(results_path)

    return remote_path

def update_scene(job, remote_path):
    data = job.to_dict()
    scenes_ref = db.collection("scenes")
    scene_ref = scenes_ref.document(data['refId'])
    scene_ref.update({"results": remote_path })

async def process(video_path, results_path):
    # Initialize an authenticated client
    client = AsyncHumeClient(api_key=HUME_API_KEY)

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
    print(f"Hume Job is {hume_job_id}")

    while True:
        print("Waiting for job completion..")
        time.sleep(10)

        obj = await client.expression_measurement.batch.get_job_details(id=hume_job_id)
        details = obj.dict()

        if details['state']['status'] == "COMPLETED":
            break

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

            if emotion['confidence'] < THRESHOLD:
                break

            row['emotions'].append(emotion)

        if len(row['emotions']) > 0:
            output.append(row)
    
    with open(results_path, "w") as fil:
        fil.write(json.dumps(output))
        
async def main():
    jobs = get_requested_jobs()

    for job in jobs:
        # Prepare job by marking it as processing and downloading the video
        video_path = prepare_job(job)
        results_path = video_path.replace(".mp4", ".json")        

        # Process the video and save the results to a temp json file
        await process(video_path, results_path)
        
        # Upload the results to firebase storage
        remote_path = upload_results(job, results_path)
        
        # Update the scene with the results path
        update_scene(job, remote_path)

        # Clean up the temp files
        os.remove(video_path)
        os.remove(results_path)

        # Mark the job as completed
        update_job_status(job, "completed")

if __name__ == "__main__":
    asyncio.run(main())

