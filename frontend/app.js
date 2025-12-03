// app.js
// Assumes firebase-config.js loaded and MapLibre script loaded

// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com", // add if using RTDB
    // Add other fields if needed: storageBucket, messagingSenderId, appId
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const rtdb = firebase.database(); // if using Realtime Database

// --- App variables ---
let map;
let markers = {};      // driverId -> marker
let polylines = {};    // driverId -> polyline geometry
let userRole = "passenger"; // default
const backendBase = 'http://localhost:8000'; // change when deployed

// === Auth UI ===
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const signupBtn = document.getElementById('signup');
const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');

// ...rest of your app.js code...

// === Auth handlers ===
signupBtn.onclick = async () => {
    const email = emailEl.value, pass = passEl.value;
    try { await auth.createUserWithEmailAndPassword(email, pass); alert('Signed up'); }
    catch(e) { alert(e.message); }
}

loginBtn.onclick = async () => {
    const email = emailEl.value, pass = passEl.value;
    try { await auth.signInWithEmailAndPassword(email, pass); }
    catch(e) { alert(e.message); }
}

logoutBtn.onclick = () => auth.signOut();

// === After login ===
auth.onAuthStateChanged(async user => {
    if(user){
        const tokenResult = await user.getIdTokenResult();
        userRole = tokenResult.claims.role || "passenger";

        document.getElementById('user-ui').style.display='none';
        document.getElementById('loggedin').style.display='block';
        document.getElementById('map-container').style.display='flex';

        initMap();
        initRealtimeListeners();
        loadBalance(user.uid);

        if(userRole === "passenger") startFetchingJeepsETA();
        else if(userRole === "driver") startUpdatingDriverLocation(user.uid);
    } else {
        document.getElementById('user-ui').style.display='block';
        document.getElementById('loggedin').style.display='none';
        document.getElementById('map-container').style.display='none';
    }
});

// === Map setup ===
function initMap() {
    if (map) return; // already initialized

    map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [121.0437, 14.6760], // Quezon City
        zoom: 13
    });

    map.addControl(new maplibregl.NavigationControl());

    // --- User location ---
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userCoords = [pos.coords.longitude, pos.coords.latitude];
            map.setCenter(userCoords);
            map.setZoom(15);

            new maplibregl.Marker({
                color: '#FF0000', 
                draggable: false
            })
            .setLngLat(userCoords)
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText("You are here"))
            .addTo(map);
        });
    }
}

// --- Add or update driver marker with Figma styling ---
function addOrUpdateMarker(id, loc, popupHTML=null){
    const coords = [loc.lng, loc.lat];
    if(!map) return;

    if(markers[id]){
        markers[id].setLngLat(coords);
        if(popupHTML) markers[id].setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHTML));
    } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerText = 'J'; // Or use SVG for Figma icon
        el.style.background = '#FF7F50'; // Figma color
        el.style.color = '#fff';
        el.style.fontWeight = 'bold';
        el.style.textAlign = 'center';
        el.style.borderRadius = '4px';
        el.style.padding = '4px 6px';
        el.style.cursor = 'pointer';

        const marker = new maplibregl.Marker(el)
            .setLngLat(coords);
        if(popupHTML) marker.setPopup(new maplibregl.Popup({ offset:25 }).setHTML(popupHTML));
        marker.addTo(map);
        markers[id] = marker;
    }
}

// --- Draw polyline route with Figma style ---
function drawRoute(jeepId){
    if(!map || !polylines[jeepId]) return;

    const coords = polylines[jeepId];
    const layerId = `route-${jeepId}`;

    if(map.getSource(layerId)){
        map.removeLayer(layerId);
        map.removeSource(layerId);
    }

    map.addSource(layerId, { 
        type:'geojson', 
        data:{ type:'Feature', geometry:{ type:'LineString', coordinates: coords } }
    });

    map.addLayer({
        id: layerId,
        type:'line',
        source: layerId,
        layout:{ 'line-join':'round','line-cap':'round' },
        paint:{ 'line-color':'#1E90FF', 'line-width':5, 'line-opacity':0.8 } // Figma style
    });

    // Fit map to route bounds
    const bounds = coords.reduce((b,c)=>b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 30 });
}

// --- Firebase Realtime listeners ---
function initRealtimeListeners(){
    const driversRef = rtdb.ref('drivers');
    driversRef.on('child_added', snap => updateDriverMarker(snap));
    driversRef.on('child_changed', snap => updateDriverMarker(snap));
    driversRef.on('child_removed', snap => removeMarker(snap.key));
}

function updateDriverMarker(snap){
    const id = snap.key;
    const val = snap.val();
    if(val && val.location && userRole==="driver" && id!==firebase.auth().currentUser.uid) return;
    if(val && val.location) addOrUpdateMarker(id, val.location);
}

function removeMarker(id){
    if(markers[id]) { markers[id].remove(); delete markers[id]; }
}

// === Passenger: Fetch ETA + routes ===
async function fetchJeepsWithETA(userLat, userLng){
    const user = firebase.auth().currentUser;
    if(!user) return;
    const token = await user.getIdToken();

    const url = `${backendBase}/drivers_with_eta?user_lat=${userLat}&user_lng=${userLng}`;
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` }});
    if(!res.ok) return;
    const jeeps = await res.json();

    Object.keys(jeeps).forEach(jeepId => {
        const jeep = jeeps[jeepId];
        const popupHTML = `
            Jeep ID: ${jeepId}<br>
            Distance: ${jeep.distance_km} km<br>
            ETA: ${jeep.eta_minutes} min
            <br><button onclick="drawRoute('${jeepId}')">Show Route</button>
        `;
        addOrUpdateMarker(jeepId, { lat: jeep.lat, lng: jeep.lng }, popupHTML);
        polylines[jeepId] = jeep.geometry.map(c => [c[1], c[0]]);
    });
}

function startFetchingJeepsETA(){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        fetchJeepsWithETA(userLat, userLng); // initial
        setInterval(()=>fetchJeepsWithETA(userLat, userLng), 5000);
    });
}

// === Draw polyline for selected driver ===
function drawRoute(jeepId){
    if(!map || !polylines[jeepId]) return;
    const coords = polylines[jeepId];
    const layerId = `route-${jeepId}`;
    if(map.getSource(layerId)){
        map.removeLayer(layerId);
        map.removeSource(layerId);
    }
    map.addSource(layerId, { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates: coords } }});
    map.addLayer({
        id: layerId,
        type:'line',
        source: layerId,
        layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':'#FF4500','line-width':4,'line-opacity':0.8}
    });
    const bounds = coords.reduce((b,c)=>b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: 30 });
}

// === Driver: Update own location ===
function startUpdatingDriverLocation(driverId){
    if(!navigator.geolocation) return;
    navigator.geolocation.watchPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        rtdb.ref(`drivers/${driverId}/location`).set(loc);
        addOrUpdateMarker(driverId, loc);
    }, err => console.warn("Geo error:", err), { enableHighAccuracy:true });
}

// === Fare / Route calculation remains unchanged ===
const calcBtn = document.getElementById('calc');
calcBtn.onclick = async () => {
    const destLat = parseFloat(document.getElementById('dest-lat').value);
    const destLng = parseFloat(document.getElementById('dest-lng').value);
    if(isNaN(destLat) || isNaN(destLng)){ alert('Enter valid destination coordinates'); return; }

    const start = map.getCenter();
    const startLat = start.lat;
    const startLng = start.lng;

    try {
        const user = firebase.auth().currentUser;
        if(!user) throw new Error("Not logged in");
        const token = await user.getIdToken();

        const url = `${backendBase}/route?start_lat=${startLat}&start_lng=${startLng}&end_lat=${destLat}&end_lng=${destLng}`;
        const resp = await fetch(url, { headers: { "Authorization": `Bearer ${token}` }});
        if(!resp.ok) throw new Error(`Failed to fetch route: ${resp.status}`);

        const data = await resp.json();
        const geojson = {
            type:'Feature',
            geometry: { type:'LineString', coordinates: data.geometry.map(([lat,lng])=>[lng,lat]) }
        };
        if(map.getSource('route')){
            map.removeLayer('route'); map.removeSource('route');
        }
        map.addSource('route', { type:'geojson', data: geojson });
        map.addLayer({
            id:'route', type:'line', source:'route',
            layout:{'line-join':'round','line-cap':'round'},
            paint:{'line-color':'#1E90FF','line-width':5,'line-opacity':0.8}
        });
        const bounds = data.geometry.reduce((b,c)=>b.extend([c[1],c[0]]), new maplibregl.LngLatBounds([data.geometry[0][1],data.geometry[0][0]],[data.geometry[0][1],data.geometry[0][0]]));
        map.fitBounds(bounds, { padding:30 });

        document.getElementById('fare-result').innerText = `Distance: ${data.distance_km} km | Duration: ${Math.round(data.duration_s/60)} min | Fare: ₱${data.fare_php}`;
        window.lastRouteFare = data.fare_php;
    } catch(err){ alert(err.message); }
};

// === Balance display / pay button remain unchanged ===
async function loadBalance(uid){
    const balRef = rtdb.ref(`users/${uid}/balance`);
    balRef.on('value', snap => {
        const val = snap.val();
        document.getElementById('balance-amt').innerText = (val||0).toFixed(2);
    });
}

document.getElementById('pay').onclick = async ()=>{
    const user = firebase.auth().currentUser;
    if(!user) return alert('Login first');
    const uid = user.uid;
    if(!window.lastRouteFare) return alert("Please calculate a route first");
    const balRef = rtdb.ref(`users/${uid}/balance`);
    const snap = await balRef.get();
    const bal = (snap.exists() && snap.val()) ? snap.val() : 0;
    if(bal < window.lastRouteFare) return alert('Insufficient balance — top up simulated');
    balRef.set(bal - window.lastRouteFare);
    alert(`Paid ₱${window.lastRouteFare.toFixed(2)} for this ride!`);
};
// === LIVE MAPLIBRE MAP ===
let livemap;