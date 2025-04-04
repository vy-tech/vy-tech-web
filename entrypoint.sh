#!/bin/bash

echo "Starting MediaMTX..."
cd /usr/local/mediamtx
nohup bin/mediamtx conf/config.yml &

cd /usr/local/roarscore
python3 service/service.py


