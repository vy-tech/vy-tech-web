import os
import socket

import asyncio
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

class JobManager:
    def __init__(self, parent, job_type):
        self.db = parent.db
        self.config = parent.config
        self.log = parent.log
        self.job_type = job_type
        self.processor_id = self.detect_processor_id()

    def create_job(self, ref_type, ref_id):
        jobs_ref = self.db.collection("jobs")
        
        # Create a document ref so I can get the id
        job_ref = jobs_ref.document()

        job_ref.set({
            "id": job_ref.id,
            "type": self.job_type,
            "status": "requested",
            "refType": ref_type,
            "refId": ref_id,
            "created": firestore.SERVER_TIMESTAMP,
            "updated": firestore.SERVER_TIMESTAMP,
            "message": None,
            "processor": self.processor_id
        })

        return job_ref.id

    def detect_processor_id(self):
        pid = os.getpid()
        hostname = socket.gethostname()

        return f"{hostname}.{pid}"
    
    # Listen for jobs of the specified job_type and status
    async def next_job(self):
        loop = asyncio.get_event_loop()
        queue = asyncio.Queue()

        def queue_put(data):
            self.log.info(f"Putting job {data['id']} in queue")
            queue.put_nowait(data)

        # Create a callback function to handle the snapshot
        def on_snapshot(_doc_snapshot, changes, _read_time):
            for change in changes:
                if change.type.name == "ADDED":
                    data = change.document.to_dict()
                    if "id" not in data:
                        data["id"] = change.document.id
                    
                    if self.accept_job(data):
                        self.log.info(f"Accepted job {data['id']}")
                        loop.call_soon(queue_put, data)

                        break
        
        # Set up the query to call the callback
        jobs_ref = self.db.collection("jobs")
        query = (jobs_ref
                 .where(filter=FieldFilter("status", "==", "requested"))
                 .where(filter=FieldFilter("type", "==", self.job_type))
        )
        query.on_snapshot(on_snapshot)

        while True:
            job = await queue.get()
            
            self.log.info(f"Got job {job['id']} from queue")
            
            yield job

    # Update the job document in a transaction
    # to ensure that the job is still in the requested state
    def accept_job(self, job):
        transaction = self.db.transaction()
        jobs_ref = self.db.collection("jobs")
        job_ref = jobs_ref.document(job['id'])
        doc_updates = {
            "status": "processing", 
            "updated": firestore.SERVER_TIMESTAMP,
            "processor": self.processor_id,
        }

        @firestore.transactional
        def update_in_transaction(transaction, job_ref, doc_updates):
            snapshot = job_ref.get(transaction=transaction)

            if not snapshot.exists or snapshot.get("status") != "requested":
                return False

            transaction.update(job_ref, doc_updates)

            return True

        return update_in_transaction(transaction, job_ref, doc_updates)

    def update_job_status(self, job, status, message=None):
        jobs_ref = self.db.collection("jobs")
        job_ref = jobs_ref.document(job['id'])
        new_doc = {
            "status": status, 
            "updated": firestore.SERVER_TIMESTAMP,
            "processor": self.processor_id,
            "message": message
        }

        try:
            job_ref.update(new_doc)
            return True
        except Exception as e:
            self.log.error(f"Failed to update job status: {e}")
            return False
