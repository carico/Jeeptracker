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

// --- Auth handlers ---
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

auth.onAuthStateChanged(user => {
    if(user){
        document.getElementById('user-ui').style.display='none';
        document.getElementById('loggedin').style.display='block';
        document.getElementById('map-container').style.display='flex';
        initMap();
        initRealtimeListeners();
        loadBalance(user.uid);
    } else {
        document.getElementById('user-ui').style.display='block';
        document.getElementById('loggedin').style.display='none';
        document.getElementById('map-container').style.display='none';
    }
});

// --- Map setup ---
function initMap() {
    if (map) return; // already initialized

    map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [120.9842, 14.5995], // default center (in case geolocation fails)
        zoom: 13
    });

    let userMoved = false;

    // Detect user manual interaction
    map.on('dragstart', () => userMoved = true);
    map.on('zoomstart', () => userMoved = true);

    // Try to get browser geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lng = pos.coords.longitude;
            const lat = pos.coords.latitude;

            // Center map on user location initially
            map.setCenter([lng, lat]);
            map.setZoom(15);

            // Add a marker for user's location (optional)
            new maplibregl.Marker({ color: 'red' })
                .setLngLat([lng, lat])
                .setPopup(new maplibregl.Popup().setText("You are here"))
                .addTo(map);
        }, err => {
            console.warn("Geolocation failed or denied", err);
        });
    }

    // Update markers only if the user hasn't manually moved the map
    function addOrUpdateMarker(id, loc) {
        const coords = [loc.lng, loc.lat];
        if (!map) return;

        if (markers[id]) {
            markers[id].setLngLat(coords);
        } else {
            const el = document.createElement('div');
            el.className = 'driver-marker';
            el.innerText = 'J';
            markers[id] = new maplibregl.Marker(el).setLngLat(coords).addTo(map);
        }

        // Auto-center only if user hasn't dragged yet
        if (!userMoved) {
            map.setCenter(coords);
        }
    }

    // Expose addOrUpdateMarker to global scope
    window.addOrUpdateMarker = addOrUpdateMarker;
}

// --- Realtime Firebase listeners ---
function initRealtimeListeners(){
    const driversRef = rtdb.ref('drivers');
    driversRef.on('child_added', snapshot => updateDriverMarker(snapshot));
    driversRef.on('child_changed', snapshot => updateDriverMarker(snapshot));
    driversRef.on('child_removed', snapshot => removeMarker(snapshot.key));
}

function updateDriverMarker(snapshot){
    const id = snapshot.key;
    const val = snapshot.val();
    if(val && val.location) addOrUpdateMarker(id, val.location);
}

function addOrUpdateMarker(id, loc){
    const coords = [loc.lng, loc.lat];
    if(!map) return;
    if(markers[id]){
        // Smooth animation
        markers[id].setLngLat(coords);
    } else {
        const el = document.createElement('div');
        el.className='driver-marker';
        el.innerText='J';
        markers[id] = new maplibregl.Marker(el).setLngLat(coords).addTo(map);
    }
}

function removeMarker(id){
    if(markers[id]) { markers[id].remove(); delete markers[id]; }
}

// --- Fare / Route calculation using ORS ---
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
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: data.geometry.map(([lat,lng]) => [lng,lat])
            }
        };

        if(map.getSource('route')){
            map.removeLayer('route');
            map.removeSource('route');
        }

        map.addSource('route', { type:'geojson', data: geojson });
        map.addLayer({
            id:'route',
            type:'line',
            source:'route',
            layout:{'line-join':'round','line-cap':'round'},
            paint:{'line-color':'#1E90FF','line-width':5,'line-opacity':0.8}
        });

        const bounds = data.geometry.reduce((b,coord)=>{
            return b.extend([coord[1],coord[0]]);
        }, new maplibregl.LngLatBounds([data.geometry[0][1],data.geometry[0][0]],[data.geometry[0][1],data.geometry[0][0]]));
        map.fitBounds(bounds, { padding:30 });

        document.getElementById('fare-result').innerText = 
            `Distance: ${data.distance_km} km | Duration: ${Math.round(data.duration_s/60)} min | Fare: ₱${data.fare_php}`;

        window.lastRouteFare = data.fare_php;

    } catch(err){ alert(err.message); }
};

// --- Balance display ---
async function loadBalance(uid){
    const balRef = rtdb.ref(`users/${uid}/balance`);
    balRef.on('value', snap => {
        const val = snap.val();
        document.getElementById('balance-amt').innerText = (val||0).toFixed(2);
    });
}

// --- Pay button ---
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
