# backend/app/main.py
from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import Optional
import math

app = FastAPI(title="Jeepney Tracker Backend")

class DistanceResponse(BaseModel):
    distance_km: float
    fare: float

# Simple haversine distance (km)
def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2*math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Fare calculation example: base fare + incremental per km after a threshold
# Customize to your needs
BASE_FARE = 10.0  # base fare in PHP
BASE_KM = 4.0     # base distance covered by base fare
PER_KM = 2.5      # additional per km after BASE_KM

@app.get('/distance', response_model=DistanceResponse)
def get_distance(lat1: float = Query(...), lon1: float = Query(...), lat2: float = Query(...), lon2: float = Query(...)):
    """Returns distance (km) and fare estimate between two coords."""
    dist = haversine(lat1, lon1, lat2, lon2)
    if dist <= BASE_KM:
        fare = BASE_FARE
    else:
        fare = BASE_FARE + (dist - BASE_KM) * PER_KM
    # round to 2 decimals
    return DistanceResponse(distance_km=round(dist, 3), fare=round(fare, 2))

@app.get('/')
def root():
    return {"status": "Jeepney Tracker backend running"}