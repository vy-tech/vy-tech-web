FROM ubuntu:latest

# Set up the basics
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y curl
RUN apt-get install -y python3-pip

# Set up the work dir
RUN mkdir -p /usr/local/roarscore
WORKDIR /usr/local/roarscore

RUN pip3 install --break-system-packages requests hume firebase_admin

ENTRYPOINT ["python3","service.py"]

