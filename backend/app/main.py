# backend/app/main.py
import os
import math
import requests
from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

# ----------------------------
# Load environment
# ----------------------------
load_dotenv()  # read .env in backend folder

ORS_API_KEY = os.getenv("ORS_API_KEY")
FIREBASE_CRED_FILE = os.getenv("FIREBASE_CRED_JSON")  # path to Firebase service account JSON

if not ORS_API_KEY:
    raise RuntimeError("ORS_API_KEY not set in environment")

if not FIREBASE_CRED_FILE or not os.path.exists(FIREBASE_CRED_FILE):
    raise RuntimeError("FIREBASE_CRED_JSON not set or file does not exist")

# Initialize Firebase Admin
cred = credentials.Certificate(FIREBASE_CRED_FILE)
firebase_admin.initialize_app(cred)

# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title="Jeepney Tracker + ORS + Firebase Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Models
# ----------------------------
class Location(BaseModel):
    id: str
    lat: float
    lng: float

class RouteResponse(BaseModel):
    distance_m: float
    distance_km: float
    duration_s: float
    geometry: List[List[float]]  # list of [lat, lng] pairs
    fare_php: float

# ----------------------------
# In-memory storage
# ----------------------------
jeep_locations = {}

# ----------------------------
# Fare calculation
# ----------------------------
BASE_FARE_PHP = 13.0
STUDENT_BASE_FARE_PHP = 13.0
BASE_KM = 4.0
PER_KM_PHP = 2.5


def compute_fare(distance_km: float) -> float:
    if distance_km <= BASE_KM:
        return round(BASE_FARE_PHP, 2)
    extra = distance_km - BASE_KM
    fare = BASE_FARE_PHP + extra * PER_KM_PHP
    return round(fare, 2)

# ----------------------------
# ORS helper
# ----------------------------
def ors_route(start_lng: float, start_lat: float, end_lng: float, end_lat: float):
    url = "https://api.openrouteservice.org/v2/directions/driving-car"
    params = {
        "api_key": ORS_API_KEY,
        "start": f"{start_lng},{start_lat}",
        "end": f"{end_lng},{end_lat}"
    }
    resp = requests.get(url, params=params, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ORS error: {resp.status_code} {resp.text}")
    data = resp.json()
    try:
        feat = data["features"][0]
        props = feat["properties"]["summary"]
        distance_m = props["distance"]
        duration_s = props["duration"]
        coords = feat["geometry"]["coordinates"]
        latlng = [[c[1], c[0]] for c in coords]
        return distance_m, duration_s, latlng
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unexpected ORS response: {e}")

# ----------------------------
# Firebase Auth dependency
# ----------------------------
def verify_firebase_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    id_token = authorization.split(" ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")

# ----------------------------
# Endpoints
# ----------------------------
@app.get("/")
def root():
    return {"status": "Jeepney Tracker backend running (ORS + Firebase Auth enabled)"}

@app.get("/locations", response_model=List[Location])
def get_locations():
    return list(jeep_locations.values())

@app.post("/jeep/update-location", response_model=Location)
def update_location(loc: Location, user=Depends(verify_firebase_token)):
    # Only authenticated users can update jeep locations
    jeep_locations[loc.id] = loc.dict()
    return jeep_locations[loc.id]

@app.get("/route", response_model=RouteResponse)
def get_route(
    start_lat: float = Query(...),
    start_lng: float = Query(...),
    end_lat: float = Query(...),
    end_lng: float = Query(...),
    user=Depends(verify_firebase_token)
):
    # Only authenticated users can get route/fare
    distance_m, duration_s, geometry = ors_route(start_lng, start_lat, end_lng, end_lat)
    distance_km = round(distance_m / 1000.0, 3)
    fare = compute_fare(distance_km)
    return RouteResponse(
        distance_m=round(distance_m,2),
        distance_km=distance_km,
        duration_s=round(duration_s,1),
        geometry=geometry,
        fare_php=fare
    )
