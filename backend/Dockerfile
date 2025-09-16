# backend/Dockerfile
FROM node:18-bullseye

# Install Python3, pip and build tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy Node package files and install Node dependencies (cached)
COPY package*.json ./
RUN npm ci --production

# Copy application source
COPY . .

# Upgrade pip and install Python deps if the requirements file exists
RUN if [ -f python/requirements.txt ]; then \
      python3 -m pip install --upgrade pip && \
      python3 -m pip install --no-cache-dir -r python/requirements.txt ; \
    fi

# Use production mode
ENV NODE_ENV=production

# Expose default port (your server should use process.env.PORT || 8000)
EXPOSE 8000

# Start the Node server
CMD ["node", "server.js"]
