// app.js
// Assumes firebase-config.js loaded and MapLibre script loaded


let map;
let markers = {}; // driverId -> marker


const backendBase = 'http://localhost:8000'; // change when deployed


// --- Auth UI ---
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');


signupBtn.onclick = async () => {
const email = emailEl.value; const pass = passEl.value;
try {
const user = await auth.createUserWithEmailAndPassword(email, pass);
alert('Signed up');
} catch (e) { alert(e.message); }
}

loginBtn.onclick = async () => {
const email = emailEl.value; const pass = passEl.value;
try {
await auth.signInWithEmailAndPassword(email, pass);
} catch (e) { alert(e.message); }
}

logoutBtn.onclick = () => auth.signOut();


auth.onAuthStateChanged(user => {
if (user) {
document.getElementById('user-ui').style.display = 'none';
document.getElementById('loggedin').style.display = 'block';
document.getElementById('map-container').style.display = 'flex';
initMap();
initRealtimeListeners();
loadBalance(user.uid);
} else {
document.getElementById('user-ui').style.display = 'block';
document.getElementById('loggedin').style.display = 'none';
document.getElementById('map-container').style.display = 'none';
}
});

// --- Map setup ---


// --- Realtime listeners (Firebase Realtime Database) ---
function initRealtimeListeners(){
const driversRef = rtdb.ref('drivers');
driversRef.on('child_added', snapshot => {
const id = snapshot.key;
const val = snapshot.val();
if (val && val.location) addOrUpdateMarker(id, val.location);
});
driversRef.on('child_changed', snapshot => {
const id = snapshot.key;
const val = snapshot.val();
if (val && val.location) addOrUpdateMarker(id, val.location);
});
driversRef.on('child_removed', snapshot => {
const id = snapshot.key;
removeMarker(id);
});
}


function addOrUpdateMarker(id, loc){
const coords = [loc.lng, loc.lat];
if (!map) return;
if (markers[id]){
markers[id].setLngLat(coords);
} else {
const el = document.createElement('div');
el.className = 'driver-marker';
el.innerText = 'J';
const m = new maplibregl.Marker(el).setLngLat(coords).addTo(map);
markers[id] = m;
}
}
function removeMarker(id){
if (markers[id]){ markers[id].remove(); delete markers[id]; }
}


// --- Fare calculation ---
const calcBtn = document.getElementById('calc');
calcBtn.onclick = async () => {
const destLat = parseFloat(document.getElementById('dest-lat').value);
const destLng = parseFloat(document.getElementById('dest-lng').value);
if (isNaN(destLat) || isNaN(destLng)) { alert('Enter valid destination coords'); return; }


// Use map center as current location for demo or use user's geolocation
const center = map.getCenter();
const resp = await fetch(`${backendBase}/distance?lat1=${center.lat}&lon1=${center.lng}&lat2=${destLat}&lon2=${destLng}`);
const data = await resp.json();
document.getElementById('fare-result').innerText = `Distance: ${data.distance_km} km — Fare: ₱${data.fare}`;
}


// --- Balance (simulated) ---
async function loadBalance(uid){
const balRef = rtdb.ref(`users/${uid}/balance`);
balRef.on('value', snap => {
const val = snap.val();
document.getElementById('balance-amt').innerText = (val || 0).toFixed(2);
});
}


// Pay button simply deducts balance and shows QR for scanner simulation
document.getElementById('pay').onclick = async () => {
const user = auth.currentUser;
if (!user) return alert('Login first');
const uid = user.uid;
const balRef = rtdb.ref(`users/${uid}/balance`);
const snap = await balRef.get();
const bal = (snap.exists() && snap.val()) ? snap.val() : 0;
// For demo charge fixed amount
const charge = 15.0;
if (bal < charge) return alert('Insufficient balance — top up simulated only');
balRef.set(bal - charge);
alert('Paid ₱' + charge.toFixed(2));
}