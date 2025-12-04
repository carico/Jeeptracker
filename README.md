# IWAS 123 JEEPNEY Web App

Guide to run web app local to hosting 
## Prerequisites

Install these in vs code
- **Git** – to clone the repository  
- **Python 3.10+** – for the backend  
- **Node.js & npm** – for Firebase (optional, if using hosting)  
---

## Step 1: Clone the Repository
Use on terminal:
  git clone https://github.com/carico/Jeeptracker.git
  cd Jeeptracker

## Step 2: Backend Setup
Use on terminal:
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  source .venv/bin/activate
  pip install -r backend/requirements.txt
  uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

backend will run on http://localhost:8000 or whatever port u state

## Step 3: Frontend Setup
Use on terminal:
  cd frontend/public
  python -m http.server 3000 --bind 127.0.0.1

frontend will run locally on http://127.0.0.1:3000/

## Step 4: Hosting
Use on terminal:
  npm install -g firebase-tools
  firebase login

  cd frontend/public
  firebase init hosting
  firebase deploy

