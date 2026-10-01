FROM node:20-slim

# Install Python + pip untuk menjalankan infer.py
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install dependency Python dulu (lebih jarang berubah, biar cache build lebih cepat)
COPY python/requirements.txt ./python/requirements.txt
RUN pip3 install --break-system-packages -r python/requirements.txt

# Install dependency Node
COPY package*.json ./
RUN npm install --production

# Copy semua source code
COPY . .

EXPOSE 10000
CMD ["node", "server.js"]