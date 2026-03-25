FROM ubuntu:latest

# Set up the basics
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y curl unzip vim

# Set up nginx
RUN apt-get install -y nginx
COPY conf/nginx.conf /etc/nginx/sites-available/default

# Install Node.js
WORKDIR /usr/local
RUN curl -Lo - https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-arm64.tar.gz | tar zvx
RUN mv node-v22.14.0-linux-arm64 node
RUN ln -s /usr/local/node/bin/node /usr/local/bin/node
RUN ln -s /usr/local/node/bin/npm /usr/local/bin/npm

# Set up the work directory
RUN mkdir /app
WORKDIR /app

# Copy files that we need (compose replaces with volume)
COPY public ./public
COPY server.js .
RUN npm install express

# Install nodemon for hot reloading of development
RUN npm install -g nodemon
RUN ln -s /usr/local/node/bin/nodemon /usr/local/bin/nodemon

COPY conf/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Copy the functions and install the dependencies
COPY functions ./functions
WORKDIR /app/functions/app
RUN npm install
WORKDIR /app/functions/chat
RUN npm install
WORKDIR /app/functions/org
RUN npm install
WORKDIR /app/functions/file
RUN npm install


WORKDIR /app
ENTRYPOINT [ "/app/entrypoint.sh" ]
