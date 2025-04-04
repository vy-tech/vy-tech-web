import asyncio
import json
import tempfile
import os
import traceback
import time

from concurrent.futures import ProcessPoolExecutor

from hume import AsyncHumeClient
from hume.expression_measurement.batch import Face, Models
from hume.expression_measurement.batch.types import InferenceBaseRequest


import firebase_admin
from firebase_admin import firestore
from firebase_admin import storage

from jobs import JobManager

class Processor:
    def __init__(self, parent, job_type):
        self.config = parent.config
        self.secrets = parent.secrets
        self.log = parent.log
        self.db = parent.db
        self.storage = parent.storage
        self.cred = parent.cred
        self.bucket = parent.bucket
        self.job_type = job_type
        self.tasks = parent.tasks
    
    async def run(self):
        self.job_manager = JobManager(self, self.job_type)

        async for job in self.job_manager.next_job():
            self.log.debug(f"Starting job {job['id']}")
            self.start_task(job)
                
    def start_task(self, job):
        task = asyncio.create_task(self.process(job))
        self.tasks.add(task)
        task.add_done_callback(lambda t: self.finish_task(t, job))
        
    def finish_task(self, task, job):
        self.tasks.remove(task)

        try:
            task.result()
        except Exception as e:
            self.log.error(f"Task failed: {e}")
            self.log.error(traceback.format_exc())
            self.job_manager.update_job_status(job, "failed", str(e))
        else:
            self.log.debug("Task finished")
            self.job_manager.update_job_status(job, "completed")

    async def process(self, job):
        await asyncio.sleep(0)


