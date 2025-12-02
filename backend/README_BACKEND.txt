python -m venv venv
source venv/bin/activate # or venv\Scripts\activate on Windows
pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

http://localhost:8000/distance?lat1=14.6&lon1=121.0&lat2=14.7&lon2=121.05