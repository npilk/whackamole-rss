#!/bin/bash

# Whackamole RSS Deployment Script
set -e

echo "🚀 Starting Whackamole RSS deployment..."

# Pull latest changes
echo "📦 Pulling latest changes from Git..."
git pull origin main

# Stop existing container
echo "🛑 Stopping existing container..."
docker compose down

# Rebuild and start
echo "🔨 Rebuilding and starting container..."
docker compose up -d --build

# Show logs
echo "📋 Container status:"
docker compose ps

echo "✅ Deployment complete!"
echo "🌐 Whackamole RSS is running at: http://localhost:3424"