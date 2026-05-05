# AWS App Runner, ECS Fargate, or Elastic Beanstalk (Docker platform)
FROM node:22-bookworm-slim

WORKDIR /app

# Native deps used by firebase-admin / gRPC — Debian slim is more reliable than Alpine here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# App Runner and many ALB targets use 8080; override with PORT in the service config if needed.
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start"]
