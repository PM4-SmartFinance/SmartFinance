#!/bin/bash
set -e

echo "Setting up SmartFinance for Self-Hosting..."

if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.example .env
  # Generate a secure 64-character hex string for the session secret
  SECRET=$(openssl rand -hex 32)
  # Replace placeholder in .env
  sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=${SECRET}/" .env && rm .env.bak
  echo "Generated secure SESSION_SECRET in .env"
else
  echo ".env already exists. Skipping..."
fi

echo "Pulling Docker images and starting the stack..."
docker compose up -d

echo "Setup complete. Access the app at http://localhost"