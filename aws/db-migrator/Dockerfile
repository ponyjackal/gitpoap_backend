# Modified from the Dockerfile provided by cdk-lambda-bash

FROM public.ecr.aws/lambda/provided:al2

RUN yum update -y && yum install -y \
  gcc-c++ \
  git \
  gzip \
  jq \
  make \
  python3 \
  tar \
  unzip \
  && rm -rf /var/cache/yum

# install aws-cli v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
  unzip awscliv2.zip && \
  ./aws/install && \
  rm -r awscliv2.zip aws

# Install node and npm
RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n && \
  bash n install 16.15.1 && \
  rm n
RUN npm install --location=global npm@9.1.2 yarn

COPY cdk-lambda-bash/bootstrap /var/runtime/bootstrap
COPY cdk-lambda-bash/function.sh /var/task/function.sh
RUN chmod +x /var/runtime/bootstrap /var/task/function.sh

RUN echo "prefix=/tmp/npm" > /etc/npmrc
RUN echo -e "cache-folder /tmp/yarn/cache\nglobal-folder /tmp/yarn/global" > /usr/local/etc/yarnrc

ARG GITHUB_OAUTH_TOKEN
ARG REPO_BRANCH
ENV REPO_BRANCH=${REPO_BRANCH}

RUN mkdir /var/repos
WORKDIR /var/repos
RUN git clone https://${GITHUB_OAUTH_TOKEN}@github.com/gitpoap/gitpoap-backend.git
WORKDIR /var/repos/gitpoap-backend
RUN git checkout ${REPO_BRANCH}

# prefetch as many packages as possible
RUN yarn

COPY run-migrations.sh /var/task/main.sh
RUN chmod +x /var/task/main.sh

WORKDIR /var/task
CMD [ "function.sh.handler" ]
