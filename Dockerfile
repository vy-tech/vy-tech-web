FROM ubuntu:latest

# Set up the basics
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y curl
#RUN apt-get install -y ffmpeg
RUN apt-get install -y python3-pip

# Set up the work dir
RUN mkdir -p /usr/local/hume
WORKDIR /usr/local/hume

RUN pip3 install --break-system-packages requests hume

ENTRYPOINT ["sleep","1000000000"]

