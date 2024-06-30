

# Create image based on the official Node image from dockerhub
FROM node:18.19
RUN apt update && apt upgrade -y
RUN apt install sudo curl zip unzip python3 python3.11-venv -y
RUN ln -s /usr/bin/python3 /usr/bin/python \
 && curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli-bundle.zip" \
 && unzip awscli-bundle.zip \
 && sudo ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws \
 && npm install -g serverless 
