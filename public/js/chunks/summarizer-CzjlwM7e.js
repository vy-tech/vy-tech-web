import { g as getApp, d as database } from './db-BZQDImdW.js';
import { S as Score, b as progress, a as activeBoxManager } from './annotations-ChiWH4zS.js';
import { e as eventBus } from './eventbus-B9JUr222.js';
import { H as Hierarchy, e as eventsData } from './hierarchy-DQ6298PP.js';

/**
 * import asyncio
import aiohttp
from aiohttp import ClientPayloadError, ClientError, ServerTimeoutError, ClientTimeout, TCPConnector
import aiofiles
import os
import time
import tempfile
import logging

import boto3
from botocore.client import Config
from firebase_admin import storage

class Storage:
    @staticmethod
    def get_instance(parent, storage_type=None):
        """
        Factory method to get an instance of the appropriate storage class.
        :param parent: The parent object that contains configuration and secrets.
        :param storage_type: The type of storage ('s3' or 'firebase').
        :return: An instance of S3Storage or FirebaseStorage.
        """

        parent.log.info(f"Creating storage instance of type: {storage_type}")

        if storage_type == 's3':
            return S3Storage(parent)
        elif storage_type == 'minio':
            return MinioStorage(parent)
        elif storage_type == 'seaweed':
            return SeaweedStorage(parent)
        elif storage_type == 'firebase' or storage_type is None:
            return FirebaseStorage(parent)
        elif storage_type == 'local':
            return LocalStorage(parent)
        else:
            raise ValueError(f"Unsupported storage type: {storage_type}")

    def __init__(self, parent):
        self.config = parent.config
        self.secrets = parent.secrets
        self.log = parent.log
        self.storage_type = 'base'

    def create_signed_url(self, remote_path, method="GET", expires_in=3600):
        """
        Create a signed URL for accessing a file in Firebase Storage or S3 Storage.
        :param remote_path: The path to the file in Firebase Storage or S3 Storage.
        :param method: The HTTP method for the signed URL (default is GET).
        :param expires_in: Expiration time in seconds (default is 3600 seconds).
        :return: A signed URL as a string.
        """
        raise NotImplementedError("This method should be implemented by subclasses.")

    def list_files(self, remote_path):
        """
        List files in a specific path in Firebase Storage or S3 Storage.
        :param remote_path: The path to list files from.
        :return: A list of file names.
        """
        raise NotImplementedError("This method should be implemented by subclasses.")

    def delete_file(self, remote_path):
        """
        Delete a file from Firebase Storage or S3 Storage.
        :param remote_path: The path to the file in Firebase Storage or S3 Storage.
        """
        raise NotImplementedError("This method should be implemented by subclasses.")

    async def async_download_file_with_retries(self, remote_path, local_path, progress_callback=None, retries=10):
        """
        Download a file from remote storage to a local path with retries.
        :param remote_path: The path to the file in remote storage.
        :param local_path: The local path where the file will be saved.
        :param progress_callback: Optional callback function to report download progress.
        :param retries: Number of retry attempts in case of failure.
        """
        for attempt in range(retries):
            try:
                await self.async_download_file(remote_path, local_path, progress_callback)
                return
            except (ClientPayloadError, ClientError, ServerTimeoutError) as e:
                self.log.error(f"Connection error on attempt {attempt + 1}: {e}")
                # Clean up partial file before retry
                if os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                        self.log.debug(f"Removed partial file {local_path}")
                    except OSError as cleanup_error:
                        self.log.warning(f"Failed to remove partial file {local_path}: {cleanup_error}")

                if attempt == retries - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)
            except Exception as e:
                self.log.error(f"Attempt {attempt + 1} failed: {e}")
                if attempt == retries - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)

    async def async_download_file(self, remote_path, local_path, progress_callback=None):
        """
        Download a file from remote storage to a local path.
        """

        self.log.info(f"Downloading {self.storage_type}:{remote_path} to {local_path}..")

        # Get a signed URL
        url = self.create_signed_url(remote_path)

        # Configure timeouts and connection pooling
        timeout = ClientTimeout(total=3600, connect=30, sock_read=300)
        connector = TCPConnector(limit=100, limit_per_host=10, keepalive_timeout=60)

        # Set up an async HTTP session to download the file
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            async with session.get(url) as resp:
                resp.raise_for_status()

                # Write the file and update progress
                total_size = int(resp.headers.get('Content-Length', 0))
                downloaded_size = 0
                last_update_time = time.time()

                async with aiofiles.open(local_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(1024*1024):
                        await f.write(chunk)
                        downloaded_size += len(chunk)

                        if time.time() - last_update_time > 1:
                            pct_done = downloaded_size / total_size * 100 if total_size else 0
                            if progress_callback:
                                progress_callback(pct_done)

                            self.log.debug(f"Download progress: {pct_done:.2f}%")
                            last_update_time = time.time()

        self.log.debug(f"Downloaded {self.storage_type}:{remote_path} to {local_path}")

    async def async_upload_file_with_retries(self, local_path, remote_path, progress_callback=None, retries=10):
        """
        Upload a file from a local path to remote storage with retries.
        :param local_path: The local path of the file to upload.
        :param remote_path: The path in remote storage where the file will be uploaded.
        :param progress_callback: Optional callback function to report upload progress.
        :param retries: Number of retry attempts in case of failure.
        """
        for attempt in range(retries):
            try:
                await self.async_upload_file(local_path, remote_path, progress_callback)
                return
            except Exception as e:
                self.log.error(f"Attempt {attempt + 1} failed: {e}")
                if attempt == retries - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)

    async def async_upload_file(self, local_path, remote_path, progress_callback=None):
        self.log.debug(f"Uploading {local_path} to {self.storage_type}:{remote_path}..")

        # Set up the storage blob and generate a signed URL for upload
        content_type = self.guess_mime_type(local_path)
        url = self.create_signed_url(remote_path, method="PUT", content_type=content_type)

        # Setup progress tracking
        total_size = os.path.getsize(local_path)
        sent_size = 0
        last_update_time = time.time()

        # This callback will do the progress updates
        def status_callback(chunk_size):
            nonlocal sent_size, last_update_time

            sent_size += chunk_size

            if time.time() - last_update_time > 1:
                pct_done = sent_size / total_size * 100 if total_size else 0
                if progress_callback:
                    progress_callback(pct_done)

                self.log.debug(f"Upload progress: {pct_done:.2f}%")
                last_update_time = time.time()

        # Set up an async HTTP session to upload the file
        async with aiohttp.ClientSession() as session:
            async with aiofiles.open(local_path, "rb") as f:
                async with session.put(
                    url,
                    data=self._stream_file(f, status_callback=status_callback),
                    headers={
                        "Content-Type": content_type,
                        "Content-Length": str(total_size)
                    }
                ) as resp:
                    resp.raise_for_status()

        self.log.debug(f"Uploaded {local_path} to {self.storage_type}:{remote_path}")

    def guess_mime_type(self, local_path):
        """Guess the MIME type of a file based on its extension."""
        _, ext = os.path.splitext(local_path)
        ext = ext.lower()

        if ext in [".mp4", ".mov", ".avi"]:
            return "video/mp4"
        elif ext in [".jpg", ".jpeg", ".png"]:
            return "image/jpeg"
        elif ext in [".txt"]:
            return "text/plain"
        elif ext in [".json"]:
            return "application/json"
        else:
            return "application/octet-stream"

    async def _stream_file(self, afp, chunk_size=1024*1024, status_callback=None):
        """Async generator yielding file chunks."""
        while True:
            chunk = await afp.read(chunk_size)
            if not chunk:
                break

            if status_callback:
                status_callback(len(chunk))

            yield chunk

    async def test_methods(self, filesize=100 * 1024 * 1024):
        # Create a local test file of 100 MB
        self.log.info(f"Creating a test file of size {filesize} bytes...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            temp_file.write(os.urandom(filesize))
            temp_file.close()
            local_path = temp_file.name

        self.log.info(f"Test file created at {local_path}")
        # Define a remote path for testing
        remote_path = f"test/{os.path.basename(local_path)}"

        # Test upload
        await self.async_upload_file_with_retries(local_path, remote_path)

        # Test list files
        files = self.list_files("test/")
        self.log.info(f"Files in remote path: {files}")
        # Check if the uploaded file is in the list
        assert remote_path in files, f"File {remote_path} not found in remote path"

        # Test download
        local_download_path = f"downloaded_{os.path.basename(local_path)}"
        await self.async_download_file_with_retries(remote_path, local_download_path)

        # Check if the downloaded file size matches the original
        local_size = os.path.getsize(local_path)
        downloaded_size = os.path.getsize(local_download_path)
        self.log.info(f"Original file size: {local_size}, Downloaded file size: {downloaded_size}")
        assert local_size == downloaded_size, \
            "Downloaded file size does not match the original file size"

        # Test delete
        self.delete_file(remote_path)

        # Delete test files
        if os.path.exists(local_path):
            os.remove(local_path)

        if os.path.exists(local_download_path):
            os.remove(local_download_path)

class S3Storage(Storage):
    def __init__(self, parent):
        self.config = parent.config
        self.secrets = parent.secrets
        self.log = parent.log
        self.storage_type = 's3'

        logging.getLogger('boto3').setLevel(logging.INFO)
        logging.getLogger('botocore').setLevel(logging.INFO)
        logging.getLogger('s3transfer').setLevel(logging.INFO)
        logging.getLogger('urllib3').setLevel(logging.INFO)

        self.access_key_id = self.secrets.get("s3", "access_key")
        self.secret_key = self.secrets.get("s3", "secret_key")
        self.bucket_name = self.config.get("s3", "bucket_name", fallback=None)

        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version='s3v4')
        )

    def get_bucket_and_prefix(self, remote_path):
        if self.bucket_name:
            return self.bucket_name, remote_path
        else:
            parts = remote_path.split('/', 1)
            bucket = parts[0]
            prefix = parts[1] if len(parts) > 1 else ''

            return bucket, prefix


    def create_signed_url(self, remote_path, method="GET", expires_in=3600, content_type=None):
        """
        Create a signed URL for accessing a file in S3 Storage.
        :param remote_path: The path to the file in S3 Storage.
        :param method: The HTTP method for the signed URL (default is GET).
        :param expires_in: Expiration time in seconds (default is 3600 seconds).
        :return: A signed URL as a string.
        """
        try:
            # Map HTTP methods to Boto3 client methods
            method_map = {'GET': 'get_object', 'PUT': 'put_object'}
            client_method = method_map.get(method.upper())
            if not client_method:
                raise ValueError(f"Unsupported HTTP method for signed URL: {method}")
            # Prepare parameters including optional content type
            bucket, prefix = self.get_bucket_and_prefix(remote_path)
            params = {'Bucket': bucket, 'Key': prefix}
            if content_type:
                params['ContentType'] = content_type
            # Generate the signed URL with the correct client method and HTTP method
            signed_url = self.s3_client.generate_presigned_url(
                ClientMethod=client_method,
                Params=params,
                ExpiresIn=expires_in,
                HttpMethod=method
            )
            return signed_url
        except Exception as e:
            self.log.error(f"Error creating signed URL: {e}")
            raise e

    def list_files(self, remote_path):
        """
        List files in a specific path in S3 Storage.
        :param remote_path: The path to list files from.
        :return: A list of file names.
        """
        try:
            bucket, prefix = self.get_bucket_and_prefix(remote_path)
            response = self.s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)

            if 'Contents' in response:
                return [item['Key'] for item in response['Contents']]
            else:
                self.log.info(f"No files found in {remote_path}.")
                return []
        except Exception as e:
            self.log.error(f"Error listing files: {e}")
            raise e

    def delete_file(self, remote_path):
        """
        Delete a file from S3 Storage.
        :param remote_path: The path to the file in S3 Storage.
        """
        try:
            bucket, prefix = self.get_bucket_and_prefix(remote_path)
            self.s3_client.delete_object(Bucket=bucket, Key=prefix)
            self.log.info(f"File {remote_path} deleted from S3 Storage.")
        except Exception as e:
            self.log.error(f"Error deleting file: {e}")
            raise e

class MinioStorage(S3Storage):
    def __init__(self, parent):
        self.config = parent.config
        self.secrets = parent.secrets
        self.log = parent.log
        self.storage_type = 'minio'

        logging.getLogger('boto3').setLevel(logging.INFO)
        logging.getLogger('botocore').setLevel(logging.INFO)
        logging.getLogger('s3transfer').setLevel(logging.INFO)
        logging.getLogger('urllib3').setLevel(logging.INFO)

        self.access_key_id = self.secrets.get("minio", "access_key")
        self.secret_key = self.secrets.get("minio", "secret_key")
        self.bucket_name = self.config.get("minio", "bucket_name")
        self.endpoint_url = self.config.get("minio", "endpoint_url")

        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version='s3v4')
        )

class SeaweedStorage(S3Storage):
    def __init__(self, parent):
        self.config = parent.config
        self.secrets = parent.secrets
        self.log = parent.log
        self.storage_type = 'seaweed'

        logging.getLogger('boto3').setLevel(logging.INFO)
        logging.getLogger('botocore').setLevel(logging.INFO)
        logging.getLogger('s3transfer').setLevel(logging.INFO)
        logging.getLogger('urllib3').setLevel(logging.INFO)

        self.access_key_id = self.secrets.get("seaweed", "access_key")
        self.secret_key = self.secrets.get("seaweed", "secret_key")
        self.bucket_name = self.config.get("seaweed", "bucket_name", fallback=None)
        self.endpoint_url = self.config.get("seaweed", "endpoint_url")

        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version='s3v4')
        )


class FirebaseStorage(Storage):
    def __init__(self, parent):
        super().__init__(parent)
        self.bucket = storage.bucket(self.config.get("firebase", "bucket"))
        self.storage_type = 'firebase'

    def create_signed_url(self, remote_path, method="GET", expires_in=3600, content_type=None):
        """
        Create a signed URL for accessing a file in Firebase Storage.
        :param remote_path: The path to the file in Firebase Storage.
        :param method: The HTTP method for the signed URL (default is GET).
        :param expires_in: Expiration time in seconds (default is 3600 seconds).
        :return: A signed URL as a string.
        """
        blob = self.bucket.blob(remote_path)
        signed_url = blob.generate_signed_url(
            version='v4',
            expiration=expires_in,
            method=method,
            content_type=content_type
        )

        return signed_url

    def list_files(self, remote_path):
        """
        List files in a specific path in Firebase Storage.
        :param remote_path: The path to list files from.
        :return: A list of file names.
        """
        blobs = self.bucket.list_blobs(prefix=remote_path)
        return [blob.name for blob in blobs]

    def delete_file(self, remote_path):
        """
        Delete a file from Firebase Storage.
        :param remote_path: The path to the file in Firebase Storage.
        """
        blob = self.bucket.blob(remote_path)
        blob.delete()
        self.log.info(f"File {remote_path} deleted from Firebase Storage.")

class LocalStorage(Storage):
    def __init__(self, parent):
        super().__init__(parent)
        self.storage_type = 'local'
        self.base_path = self.config.get("local", "base_path", fallback="data")
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path)

    def create_signed_url(self, remote_path, method="GET", expires_in=3600, content_type=None):
        """
        Create a signed URL for accessing a file in Local Storage.
        :param remote_path: The path to the file in Local Storage.
        :param method: The HTTP method for the signed URL (default is GET).
        :param expires_in: Expiration time in seconds (default is 3600 seconds).
        :return: A signed URL as a string.
        """
        # Local storage does not support signed URLs, so we return a direct file URL.
        return f"file://{os.path.join(self.base_path, remote_path)}"

    def list_files(self, remote_path):
        """
        List files in a specific path in Local Storage.
        :param remote_path: The path to list files from.
        :return: A list of file names.
        """
        dir_path = os.path.join(self.base_path, remote_path)
        if not os.path.exists(dir_path):
            return []

        results = []

        for f in os.listdir(dir_path):
            if os.path.isfile(os.path.join(dir_path, f)):
                results.append(os.path.join(remote_path, f))
            elif os.path.isdir(os.path.join(dir_path, f)):
                sub_files = self.list_files(os.path.join(remote_path, f))
                results.extend([os.path.join(f, sf) for sf in sub_files])

        return results

    def delete_file(self, remote_path):
        """
        Delete a file from Local Storage.
        :param remote_path: The path to the file in Local Storage.
        """
        file_path = os.path.join(self.base_path, remote_path)
        if os.path.exists(file_path):
            os.remove(file_path)
            self.log.info(f"File {remote_path} deleted from Local Storage.")

            # Clean up empty directories
            dir_path = os.path.dirname(file_path)
            while dir_path != self.base_path and os.path.exists(dir_path) and not os.listdir(dir_path):
                os.rmdir(dir_path)
                dir_path = os.path.dirname(dir_path)

        else:
            self.log.warning(f"File {remote_path} not found in Local Storage.")

    async def async_download_file(self, remote_path, local_path, progress_callback=None):
        """
        Download a file from local storage to a local path.
        """
        self.log.info(f"Copying {self.storage_type}:{remote_path} to {local_path}..")

        if remote_path.startswith(self.base_path):
            # If the remote path is already a local path, just copy it
            src_path = remote_path
        else:
            src_path = os.path.join(self.base_path, remote_path)

        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Source file {src_path} does not exist.")

        total_size = os.path.getsize(src_path)
        copied_size = 0
        last_update_time = time.time()

        async with aiofiles.open(src_path, "rb") as src_file:
            async with aiofiles.open(local_path, "wb") as dest_file:
                while True:
                    chunk = await src_file.read(1024 * 1024)
                    if not chunk:
                        break
                    await dest_file.write(chunk)
                    copied_size += len(chunk)
                    if time.time() - last_update_time > 0.25:
                        pct_done = copied_size / total_size * 100 if total_size else 0
                        if progress_callback:
                            progress_callback(pct_done)

                        self.log.debug(f"Copy progress: {pct_done:.2f}%")
                        last_update_time = time.time()

        self.log.debug(f"Copied {self.storage_type}:{remote_path} to {local_path}")

    async def async_upload_file(self, local_path, remote_path, progress_callback=None):
        self.log.debug(f"Copying {local_path} to {self.storage_type}:{remote_path}..")

        if remote_path.startswith(self.base_path):
            # If the remote path is already a local path, just copy it
            dest_path = remote_path
        else:
            dest_path = os.path.join(self.base_path, remote_path)

        dest_dir = os.path.dirname(dest_path)

        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        total_size = os.path.getsize(local_path)
        copied_size = 0
        last_update_time = time.time()

        async with aiofiles.open(local_path, "rb") as src_file:
            async with aiofiles.open(dest_path, "wb") as dest_file:
                while True:
                    chunk = await src_file.read(1024 * 1024)
                    if not chunk:
                        break
                    await dest_file.write(chunk)
                    copied_size += len(chunk)
                    if time.time() - last_update_time > 0.25:
                        pct_done = copied_size / total_size * 100 if total_size else 0
                        if progress_callback:
                            progress_callback(pct_done)

                        self.log.debug(f"Copy progress: {pct_done:.2f}%")
                        last_update_time = time.time()

        self.log.debug(f"Copied {local_path} to {self.storage_type}:{remote_path}")
 */


// ── Guards ──────────────────────────────────────────────────────────────────

async function requireFs() {
    try {
        return await import('node:fs');
    } catch {
        throw new Error('File system operations require a Node.js environment');
    }
}

function assertSecrets(secrets, section, className) {
    if (!secrets || typeof secrets.get !== 'function' || !secrets.get(section, 'access_key')) {
        throw new Error(`${className} requires "${section}" credentials — not available in this context`);
    }
}

function assertAdminSdk(methodName) {
    if (typeof global === 'undefined' || !global._vy_firebase_admin_sdk) {
        throw new Error(`${methodName}() requires Firebase Admin SDK — not available in this context`);
    }
}

// ── MIME type map ────────────────────────────────────────────────────────────

const MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.mov': 'video/mp4',
    '.avi': 'video/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.txt': 'text/plain',
    '.json': 'application/json',
};

// ── Lazy AWS SDK loader ──────────────────────────────────────────────────────

let _awsSdk = null;

async function loadAwsSdk() {
    if (_awsSdk) return _awsSdk;
    try {
        const [s3, presigner] = await Promise.all([
            import('@aws-sdk/client-s3'),
            import('@aws-sdk/s3-request-presigner'),
        ]);
        _awsSdk = {
            S3Client: s3.S3Client,
            GetObjectCommand: s3.GetObjectCommand,
            PutObjectCommand: s3.PutObjectCommand,
            ListObjectsV2Command: s3.ListObjectsV2Command,
            DeleteObjectCommand: s3.DeleteObjectCommand,
            getSignedUrl: presigner.getSignedUrl,
        };
        return _awsSdk;
    } catch {
        throw new Error(
            'AWS SDK not available. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner'
        );
    }
}

// ── Base Storage class ───────────────────────────────────────────────────────

class Storage {
    static getInstance(parent, storageType = 'firebase') {
        if (storageType === 's3') return new S3Storage(parent);
        if (storageType === 'minio') return new MinioStorage(parent);
        if (storageType === 'seaweed') return new SeaweedStorage(parent);
        if (storageType === 'firebase') return new FirebaseStorage(parent);
        if (storageType === 'local') return new FileSystemStorage(parent);
        throw new Error(`Unsupported storage type: ${storageType}`);
    }

    constructor({ config, secrets, log } = {}) {
        this.config = config || null;
        this.secrets = secrets || null;
        this.log = log || console;
        this.storageType = 'base';
    }

    createSignedUrl(remotePath, method = 'GET', expiresIn = 3600, contentType = null) {
        throw new Error('createSignedUrl() must be implemented by subclass');
    }

    listFiles(remotePath) {
        throw new Error('listFiles() must be implemented by subclass');
    }

    deleteFile(remotePath) {
        throw new Error('deleteFile() must be implemented by subclass');
    }

    guessMimeType(filePath) {
        const dot = filePath.lastIndexOf('.');
        const ext = dot !== -1 ? filePath.slice(dot).toLowerCase() : '';
        return MIME_TYPES[ext] || 'application/octet-stream';
    }

    _exponentialDelay(attempt) {
        return new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000));
    }

    // ── Download (Node.js only) ──────────────────────────────────────────────

    async downloadFile(remotePath, localPath, progressCallback = null, retries = 10) {
        const fs = await requireFs();

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this._downloadFileOnce(remotePath, localPath, progressCallback, fs);
                return;
            } catch (e) {
                this.log.error(`Download attempt ${attempt + 1} failed: ${e.message}`);
                try { fs.unlinkSync(localPath); } catch { /* ignore cleanup errors */ }
                if (attempt === retries - 1) throw e;
                await this._exponentialDelay(attempt);
            }
        }
    }

    async _downloadFileOnce(remotePath, localPath, progressCallback, fs) {
        this.log.info(`Downloading ${this.storageType}:${remotePath} to ${localPath}..`);

        const url = await this.createSignedUrl(remotePath, 'GET');
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        const totalSize = parseInt(resp.headers.get('content-length') || '0');
        let downloadedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const dest = fs.createWriteStream(localPath);
            dest.on('error', reject);
            dest.on('finish', resolve);

            const reader = resp.body.getReader();
            const pump = () => {
                reader.read().then(({ done, value }) => {
                    if (done) { dest.end(); return; }
                    dest.write(Buffer.from(value));
                    downloadedSize += value.length;
                    const now = Date.now();
                    if (now - lastUpdateTime > 1000) {
                        const pct = totalSize ? downloadedSize / totalSize * 100 : 0;
                        if (progressCallback) progressCallback(pct);
                        lastUpdateTime = now;
                    }
                    pump();
                }).catch(reject);
            };
            pump();
        });

        this.log.debug(`Downloaded ${this.storageType}:${remotePath} to ${localPath}`);
    }

    // ── Upload from local file (Node.js only) ───────────────────────────────

    async uploadFile(localPath, remotePath, progressCallback = null, retries = 10) {
        const fs = await requireFs();

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this._uploadFileOnce(localPath, remotePath, progressCallback, fs);
                return;
            } catch (e) {
                this.log.error(`Upload attempt ${attempt + 1} failed: ${e.message}`);
                if (attempt === retries - 1) throw e;
                await this._exponentialDelay(attempt);
            }
        }
    }

    async _uploadFileOnce(localPath, remotePath, progressCallback, fs) {
        this.log.debug(`Uploading ${localPath} to ${this.storageType}:${remotePath}..`);

        const contentType = this.guessMimeType(localPath);
        const url = await this.createSignedUrl(remotePath, 'PUT', 3600, contentType);

        const totalSize = fs.statSync(localPath).size;
        let sentSize = 0;
        let lastUpdateTime = Date.now();

        // Wrap the Node.js file stream in a web ReadableStream for fetch compatibility
        const nodeStream = fs.createReadStream(localPath, { highWaterMark: 1024 * 1024 });
        const body = new ReadableStream({
            start(controller) {
                nodeStream.on('data', chunk => {
                    sentSize += chunk.length;
                    const now = Date.now();
                    if (now - lastUpdateTime > 1000) {
                        const pct = totalSize ? sentSize / totalSize * 100 : 0;
                        if (progressCallback) progressCallback(pct);
                        lastUpdateTime = now;
                    }
                    controller.enqueue(chunk);
                });
                nodeStream.on('end', () => controller.close());
                nodeStream.on('error', e => controller.error(e));
            },
        });

        const resp = await fetch(url, {
            method: 'PUT',
            body,
            headers: { 'Content-Type': contentType },
            duplex: 'half',
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        this.log.debug(`Uploaded ${localPath} to ${this.storageType}:${remotePath}`);
    }

    // ── Upload via presigned URL (browser + Node.js) ─────────────────────────
    // Use this in the browser after obtaining a presigned PUT URL from your backend.
    // Uses XHR for upload progress support.

    uploadViaPresignedUrl(presignedUrl, file, contentType, progressCallback = null) {
        return new Promise((resolve, reject) => {
            if (typeof XMLHttpRequest !== 'undefined') {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presignedUrl);
                xhr.setRequestHeader('Content-Type', contentType);

                if (progressCallback) {
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            progressCallback(event.loaded / event.total * 100);
                        }
                    };
                }

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.send(file);
            } else {
                // Node.js fallback: fetch (no progress in this path)
                fetch(presignedUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': contentType },
                })
                    .then(resp => {
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                        resolve();
                    })
                    .catch(reject);
            }
        });
    }
}

// ── S3Storage ────────────────────────────────────────────────────────────────

class S3Storage extends Storage {
    // Subclasses override these to change which config/secrets section is used
    _section() { return 's3'; }
    _clientOptions() { return {}; }

    constructor(parent = {}) {
        super(parent);
        this.storageType = 's3';

        const section = this._section();
        assertSecrets(this.secrets, section, this.constructor.name);

        this.accessKeyId = this.secrets.get(section, 'access_key');
        this.secretKey = this.secrets.get(section, 'secret_key');
        this.bucketName = this.config ? this.config.get(section, 'bucket_name', null) : null;

        // s3Client is initialized lazily on first use (requires async AWS SDK import)
        this._s3Client = null;
        this._s3ClientOptions = {
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretKey,
            },
            ...this._clientOptions(),
        };
    }

    async _ensureClient() {
        if (this._s3Client) return;
        const { S3Client } = await loadAwsSdk();
        this._s3Client = new S3Client(this._s3ClientOptions);
    }

    getBucketAndPrefix(remotePath) {
        if (this.bucketName) return [this.bucketName, remotePath];
        const slash = remotePath.indexOf('/');
        if (slash === -1) return [remotePath, ''];
        return [remotePath.slice(0, slash), remotePath.slice(slash + 1)];
    }

    async createSignedUrl(remotePath, method = 'GET', expiresIn = 3600, contentType = null) {
        await this._ensureClient();
        const sdk = await loadAwsSdk();

        const [bucket, key] = this.getBucketAndPrefix(remotePath);
        const params = { Bucket: bucket, Key: key };
        if (contentType) params.ContentType = contentType;

        const command = method.toUpperCase() === 'PUT'
            ? new sdk.PutObjectCommand(params)
            : new sdk.GetObjectCommand(params);

        return await sdk.getSignedUrl(this._s3Client, command, { expiresIn });
    }

    async listFiles(remotePath) {
        // Note: returns up to 1000 results — S3 API limit, no auto-pagination
        await this._ensureClient();
        const { ListObjectsV2Command } = await loadAwsSdk();

        const [bucket, prefix] = this.getBucketAndPrefix(remotePath);
        const response = await this._s3Client.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
        );
        return (response.Contents || []).map(item => item.Key);
    }

    async deleteFile(remotePath) {
        await this._ensureClient();
        const { DeleteObjectCommand } = await loadAwsSdk();

        const [bucket, key] = this.getBucketAndPrefix(remotePath);
        await this._s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        this.log.info(`File ${remotePath} deleted from ${this.storageType}`);
    }
}

// ── MinioStorage ─────────────────────────────────────────────────────────────

class MinioStorage extends S3Storage {
    _section() { return 'minio'; }
    _clientOptions() {
        return {
            endpoint: this.config.get('minio', 'endpoint_url'),
            forcePathStyle: true,
        };
    }

    constructor(parent) {
        super(parent);
        this.storageType = 'minio';
    }
}

// ── SeaweedStorage ────────────────────────────────────────────────────────────

class SeaweedStorage extends S3Storage {
    _section() { return 'seaweed'; }
    _clientOptions() {
        return {
            endpoint: this.config.get('seaweed', 'endpoint_url'),
            forcePathStyle: true,
        };
    }

    constructor(parent) {
        super(parent);
        this.storageType = 'seaweed';
    }
}

// ── FirebaseStorage ───────────────────────────────────────────────────────────

let _firebaseStorageFunctions = null;
let _firebaseStorageInstance = null;

async function initFirebaseStorage() {
    if (_firebaseStorageInstance) return;

    const app = await getApp();

    if (typeof global !== 'undefined' && global._vy_firebase_admin_sdk) {
        _firebaseStorageFunctions = global._vy_storage_functions;
        _firebaseStorageInstance = _firebaseStorageFunctions.getStorage();
    } else {
        const { getStorage, ref, uploadString, getDownloadURL } = await import('./index.esm-7Y3OjC-L.js');
        _firebaseStorageFunctions = { getStorage, ref, uploadString, getDownloadURL };
        _firebaseStorageInstance = getStorage(app);
    }
}

class FirebaseStorage extends Storage {
    constructor(parent = {}) {
        super(parent);
        this.storageType = 'firebase';
    }

    async _ensureStorage() {
        await initFirebaseStorage();
    }

    async createSignedUrl(remotePath, method = 'GET', expiresIn = 3600, contentType = null) {
        assertAdminSdk('FirebaseStorage.createSignedUrl');
        const adminStorage = global._vy_storage_functions.getStorage();
        const bucket = adminStorage.bucket();
        const file = bucket.file(remotePath);
        const action = method.toUpperCase() === 'PUT' ? 'write' : 'read';
        const [url] = await file.getSignedUrl({
            action,
            expires: Date.now() + expiresIn * 1000,
            ...(contentType ? { contentType } : {}),
        });
        return url;
    }

    async getDownloadUrl(path) {
        await this._ensureStorage();
        const fileRef = _firebaseStorageFunctions.ref(_firebaseStorageInstance, path);
        return await _firebaseStorageFunctions.getDownloadURL(fileRef);
    }

    async uploadString(path, data) {
        await this._ensureStorage();
        const fileRef = _firebaseStorageFunctions.ref(_firebaseStorageInstance, path);
        this.log.info(`Saving to storage: ${path}`);
        await _firebaseStorageFunctions.uploadString(fileRef, data);
    }

    async listFiles(remotePath) {
        assertAdminSdk('FirebaseStorage.listFiles');
        const adminStorage = global._vy_storage_functions.getStorage();
        const [files] = await adminStorage.bucket().getFiles({ prefix: remotePath });
        return files.map(f => f.name);
    }

    async deleteFile(remotePath) {
        assertAdminSdk('FirebaseStorage.deleteFile');
        const adminStorage = global._vy_storage_functions.getStorage();
        await adminStorage.bucket().file(remotePath).delete();
        this.log.info(`File ${remotePath} deleted from Firebase Storage`);
    }
}

// ── FileSystemStorage ─────────────────────────────────────────────────────────

class FileSystemStorage extends Storage {
    constructor(parent = {}) {
        super(parent);
        this.storageType = 'local';
        this.basePath = this.config ? this.config.get('local', 'base_path', 'data') : 'data';
    }

    async _ensureFs() {
        if (this._fs) return this._fs;
        this._fs = await requireFs();
        if (!this._fs.existsSync(this.basePath)) {
            this._fs.mkdirSync(this.basePath, { recursive: true });
        }
        return this._fs;
    }

    async createSignedUrl(remotePath, method = 'GET', expiresIn = 3600, contentType = null) {
        await this._ensureFs();
        const path = await import('node:path');
        return `file://${path.join(this.basePath, remotePath)}`;
    }

    async listFiles(remotePath) {
        const fs = await this._ensureFs();
        const path = await import('node:path');

        const results = [];
        const walk = (dir, prefix) => {
            const dirPath = path.join(this.basePath, dir);
            if (!fs.existsSync(dirPath)) return;

            for (const entry of fs.readdirSync(dirPath)) {
                const entryPath = path.join(dirPath, entry);
                const entryRelative = path.join(dir, entry);
                if (fs.statSync(entryPath).isDirectory()) {
                    walk(entryRelative);
                } else {
                    results.push(entryRelative);
                }
            }
        };
        walk(remotePath);
        return results;
    }

    async deleteFile(remotePath) {
        const fs = await this._ensureFs();
        const path = await import('node:path');

        const filePath = path.join(this.basePath, remotePath);
        if (!fs.existsSync(filePath)) {
            this.log.warning(`File ${remotePath} not found in FileSystemStorage`);
            return;
        }

        fs.unlinkSync(filePath);
        this.log.info(`File ${remotePath} deleted from FileSystemStorage`);

        // Clean up empty parent directories
        let dir = path.dirname(filePath);
        while (dir !== this.basePath && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir);
            dir = path.dirname(dir);
        }
    }

    async _downloadFileOnce(remotePath, localPath, progressCallback, fs) {
        this.log.info(`Copying ${this.storageType}:${remotePath} to ${localPath}..`);
        const path = await import('node:path');

        const srcPath = remotePath.startsWith(this.basePath)
            ? remotePath
            : path.join(this.basePath, remotePath);

        if (!fs.existsSync(srcPath)) {
            throw new Error(`Source file ${srcPath} does not exist`);
        }

        const totalSize = fs.statSync(srcPath).size;
        let copiedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const src = fs.createReadStream(srcPath, { highWaterMark: 1024 * 1024 });
            const dest = fs.createWriteStream(localPath);

            src.on('data', chunk => {
                copiedSize += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime > 250) {
                    const pct = totalSize ? copiedSize / totalSize * 100 : 0;
                    if (progressCallback) progressCallback(pct);
                    lastUpdateTime = now;
                }
            });
            src.on('error', reject);
            dest.on('error', reject);
            dest.on('finish', resolve);
            src.pipe(dest);
        });

        this.log.debug(`Copied ${this.storageType}:${remotePath} to ${localPath}`);
    }

    async _uploadFileOnce(localPath, remotePath, progressCallback, fs) {
        this.log.debug(`Copying ${localPath} to ${this.storageType}:${remotePath}..`);
        const path = await import('node:path');

        const destPath = remotePath.startsWith(this.basePath)
            ? remotePath
            : path.join(this.basePath, remotePath);

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const totalSize = fs.statSync(localPath).size;
        let copiedSize = 0;
        let lastUpdateTime = Date.now();

        await new Promise((resolve, reject) => {
            const src = fs.createReadStream(localPath, { highWaterMark: 1024 * 1024 });
            const dest = fs.createWriteStream(destPath);

            src.on('data', chunk => {
                copiedSize += chunk.length;
                const now = Date.now();
                if (now - lastUpdateTime > 250) {
                    const pct = totalSize ? copiedSize / totalSize * 100 : 0;
                    if (progressCallback) progressCallback(pct);
                    lastUpdateTime = now;
                }
            });
            src.on('error', reject);
            dest.on('error', reject);
            dest.on('finish', resolve);
            src.pipe(dest);
        });

        this.log.debug(`Copied ${localPath} to ${this.storageType}:${remotePath}`);
    }
}

// ── Singleton (Firebase, backward-compatible) ─────────────────────────────────

let storage = new FirebaseStorage();

if (typeof window !== 'undefined') {
    window._vy_storage = storage;
}

class Summarizer {
    constructor() {
        this.currentCamera = 1;
        this.summaries = [];

        eventBus.addEventListener("ui.requestSummaryRebuild", async (e) => {
            const { hierarchy } = e.detail;
            await this.rebuild(hierarchy);
        });

        eventBus.addEventListener("playback.cameraChanged", (e) => {
            this.currentCamera = e.detail.camera;
        });
    }

    getCurrent() {
        return this.summaries[this.currentCamera - 1];
    }

    getAll() {
        return this.summaries;
    }

    async rebuild(hierarchy) {
        let hier = new Hierarchy(hierarchy);
        hierarchy = hier.toString("-");

        let summary = await this.create(hierarchy);
        //await this.saveToFirestore(hierarchy, summary);
        await this.saveToStorage(hierarchy, summary);
        return summary;
    }

    async create(hierarchy) {
        // Initialize a new scoring instance
        var scoring = new Score();

        // Load fragments and initalize the schedule
        let fragments;

        try {
            fragments = await scoring.getFragments(hierarchy);
            await scoring.initLoadSchedule(fragments);
        } catch (error) {
            console.error(`Error loading fragments for ${hierarchy}: ${error}`);
            return [];
        }

        scoring.resetWindow();
        let scores = {};

        console.log("Creating summary...");
        var { closed, pct } = progress.show("Creating summary...");

        // Run through the fragments as if the video was playing 0.25 seconds
        // at a time.
        for (let i = 0; i < fragments.length; i++) {
            const fragment = fragments[i];
            pct.val = (i / fragments.length) * 100;

            for (let dt = 0; dt < fragment.duration; dt += 0.25) {
                // Update the scoring engine to this time
                const newTime = fragment.start + dt;
                const second = Math.floor(newTime);
                await scoring.handleTimeUpdate(newTime);

                // Get or initialize the score accumulator for this second
                const score = (scores[second] = scores[second] || {
                    startTime: 99999999,
                    endTime: 0,
                    score: 0,
                    count: 0,
                    people: 0,
                    maxScore: 0,
                });

                // Accumulate the score
                score.startTime = Math.min(score.startTime, newTime);
                score.endTime = Math.max(score.endTime, newTime);
                score.score += scoring.currentScore;
                score.people += activeBoxManager.activeBoxes.length;
                score.count += 1;
                if (Math.abs(scoring.currentScore) > Math.abs(score.maxScore)) {
                    score.maxScore = scoring.currentScore;
                }
            }
        }

        // Compute averages and format times
        for (const second in scores) {
            const score = scores[second];
            score.score = score.maxScore; //Math.round(score.score / score.count);
            score.people = Math.round(score.people / score.count);
            score.startTime = score.startTime.toFixed(2);
            score.endTime = score.endTime.toFixed(2);
        }

        closed.val = true;

        return Object.values(scores);
    }

    // checkPeople(summary) {
    //     let lastScore = summary[0];
    //     for (const score of summary) {
    //         const delta = Math.abs(lastScore.people - score.people);
    //         if (delta / lastScore.people > 0.5) {
    //             console.log(lastScore, score);
    //         }
    //         lastScore = score;
    //     }
    // }

    getUrl(token, date, camera) {
        const urlPrefix = "https://storage.roarscore.ai/production/play/";
        // Make sure camera is zero padded two digits
        camera = parseInt(camera).toString().padStart(2, "0");

        return (
            `${urlPrefix}${token}/${date}/${camera}/` +
            `summary-${token}-${date}-${camera}.json`
        );
    }

    async loadFromUrl(url) {
        //console.log(`Loading summary ${url}..`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error loading ${url}: ${response.statusText}`);
            return [];
        }
        const rows = await response.json();

        for (const row of rows) {
            row.startTime = parseFloat(row.startTime);
            row.endTime = parseFloat(row.endTime);
        }

        return rows;
    }

    async loadAllFromUrl(hierarchy, cameras = 5) {
        console.log(`Loading summaries for ${hierarchy}...`);
        this.summaries = [];

        const [token, date] = hierarchy.split("-");
        for (let camera = 1; camera <= cameras; camera++) {
            const url = this.getSummaryUrl(token, date, camera);
            this.summaries.push(await this.loadSummary(url));
        }
    }

    async loadFromStorage(hierarchy) {
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

        try {
            // let storage = getStorage(app);
            // let storageRef = ref(storage, path);
            // let url = await getDownloadURL(storageRef);
            //console.log(`Loading summary from storage: ${hierarchy}...`);
            let url = await storage.getDownloadUrl(path);

            return await this.loadFromUrl(url);
        } catch (error) {
            console.error(`Error loading from storage: ${error}`);
            return null;
        }
    }

    async saveToStorage(hierarchy, summary) {
        let [token, date, camera] = hierarchy.split("-");
        let path = `summaries/${token}/${date}/summary-${token}-${date}-${camera}.json`;

        console.log(`Saving summary to storage: ${path}...`);

        //let storage = getStorage(app);
        // let storageRef = ref(storage, path);
        // await uploadString(storageRef, JSON.stringify(summary));

        await storage.uploadString(path, JSON.stringify(summary));

        console.log(`Saved summary to storage.`);
    }

    async saveToFirestore(hierarchy, summary) {
        var { closed, pct } = progress.show("Saving summary...");
        console.log(`Saving summary to firestore: ${hierarchy}...`);

        const batchSize = 1000;
        for (let i = 0; i < summary.length; i += batchSize) {
            pct.val = (i / summary.length) * 100;

            const key = `${hierarchy}-${i.toString().padStart(5, "0")}`;
            const rows = summary.slice(i, i + batchSize);
            const data = {
                id: key,
                hierarchy: hierarchy,
                offset: i,
                rows: rows,
            };

            console.log("Saving summary batch:", key, rows.length, "rows");
            await database.set("summaries", data);
            //const docRef = doc(firestore, "summaries", key);
            //await setDoc(docRef, data);
        }

        closed.val = true;
        console.log(`Saved summary to firestore.`);
    }

    async loadFromFirestore(hierarchy) {
        let result = [];
        let batches = [];

        // Get summaries by hierarchy
        //const summariesRef = collection(firestore, "summaries");
        //const q = query(summariesRef, where("hierarchy", "==", hierarchy));
        //const snap = await getDocs(q);
        //console.log(`Loading summary from firestore: ${hierarchy}...`);
        const rows = await database.query("summaries", {
            hierarchy: hierarchy,
        });

        // Ensure they're sorted by offset
        rows.forEach((data) => {
            batches.push(data);
        });
        batches.sort((a, b) => a.offset - b.offset);

        // Splice into the result
        for (const batch of batches) {
            for (const row of batch.rows) {
                row.startTime = parseFloat(row.startTime);
                row.endTime = parseFloat(row.endTime);
            }
            result.splice(batch.offset, 0, ...batch.rows);
        }

        return result;
    }

    async ensure(hierarchy, cameras = 5) {
        if (!hierarchy) {
            this.summaries = [];
            eventBus.fire("summarizer.ready");
            return this.summaries;
        }

        const hier = new Hierarchy(hierarchy);

        console.log(`Ensuring summaries for ${hier.location}-${hier.date}...`);

        var { closed, pct } = progress.show("Loading summaries..");

        this.summaries = [];
        for (let camera = 1; camera <= cameras; camera++) {
            hier.camera = camera;
            const h = hier.toString("-");

            let summary = await this.loadFromStorage(h);

            // if (!summary || !summary.length) {
            //     console.log(`Loading ${h} from firestore..`);
            //     summary = await this.loadFromFirestore(h);
            //     await this.saveToStorage(h, summary);
            // }

            if (!summary || !summary.length) {
                console.warn(
                    `SUMMARY ${h} MISSING.  CREATING.  THIS WILL TAKE AWHILE...`
                );

                summary = await this.create(h);
                //await this.saveToFirestore(h, summary);
                await this.saveToStorage(h, summary);
            }

            pct.val = (camera / cameras) * 100;
            this.summaries.push(summary);
        }

        hier.camera = 1;
        await this.ensureEventSummary(hier.toString(":"));

        closed.val = true;

        eventBus.fire("summarizer.ready");

        return this.summaries;
    }

    createCameraSummary(camera = 1) {
        const summary = this.summaries[camera - 1] || [];

        if (!summary.length) {
            return null;
        }

        const result = {
            totalScore: 0,
            totalPeople: 0,
            seconds: summary.length,
            averageScore: 0,
            averagePeople: 0,
            minScore: 99999,
            maxScore: -99999,
            minPeople: 99999,
            maxPeople: -99999,
        };

        for (const row of summary) {
            result.totalScore += row.score;
            result.totalPeople += row.people;
            result.minScore = Math.min(result.minScore, row.score);
            result.maxScore = Math.max(result.maxScore, row.score);
            result.minPeople = Math.min(result.minPeople, row.people);
            result.maxPeople = Math.max(result.maxPeople, row.people);
        }

        result.averageScore = Math.round(result.totalScore / result.seconds);
        result.averagePeople = Math.round(result.totalPeople / result.seconds);

        return result;
    }

    combineCameraSummaries(a, b) {
        const totalSeconds = a.seconds + b.seconds;

        a.totalPeople += b.totalPeople;
        a.totalScore += b.totalScore;
        a.seconds = Math.max(a.seconds, b.seconds);
        a.minScore = Math.min(a.minScore, b.minScore);
        a.maxScore = Math.max(a.maxScore, b.maxScore);
        a.minPeople = Math.min(a.minPeople, b.minPeople);
        a.maxPeople = Math.max(a.maxPeople, b.maxPeople);
        a.averageScore = Math.round(a.totalScore / totalSeconds);
        a.averagePeople = Math.round(a.totalPeople / totalSeconds);

        return a;
    }

    createEventSummary(relevantCameras = 4) {
        const summary = this.createCameraSummary(1);
        if (!summary) {
            return null;
        }

        for (let camera = 2; camera <= relevantCameras; camera++) {
            const camSummary = this.createCameraSummary(camera);
            if (camSummary) {
                this.combineCameraSummaries(summary, camSummary);
            }
        }

        summary.cameras = this.getCameraCount();

        return summary;
    }

    getCameraCount() {
        let count = 0;
        for (const summary of this.summaries) {
            if (summary && summary.length) {
                count++;
            }
        }
        return count;
    }

    async saveEventSummary(hierarchy, summary) {
        await eventsData.updateEventSummary(hierarchy, summary);
    }

    async rebuildEventSummary(hierarchy, relevantCameras = 4) {
        if (!this.summaries.length) {
            await this.ensure(hierarchy);
        }

        const summary = this.createEventSummary(hierarchy, relevantCameras);
        await this.saveEventSummary(hierarchy, summary);
        return summary;
    }

    async ensureEventSummary(hierarchy, relevantCameras = 4) {
        const event = await eventsData.getByHierarchy(hierarchy);
        if (event) {
            if (!event.summary) {
                console.log(`Event summary missing.  Rebuilding...`);
                return await this.rebuildEventSummary(
                    hierarchy,
                    relevantCameras
                );
            }
        }
    }
}

const summarizer = new Summarizer();

export { Summarizer as S, summarizer as s };
//# sourceMappingURL=summarizer-CzjlwM7e.js.map
