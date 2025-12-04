// =========================
// app.js
// =========================

// Firebase Initialization
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const rtdb = firebase.database();

// Global Variables
let map;
let markers = {};
let polylines = {};
let userRole = "passenger";
const backendBase = "http://localhost:8000";

// ================= NAVIGATION =================

// List of all page IDs
const pages = [
  "login",
  "home1",
  "home2",
  "home3",
  "qrreader1",
  "qrreader2",
  "receipt1",
  "receipt2",
  "receipt3",
  "account1",
  "account2",
  "account3"
];

// Function to show a specific page and hide all others
function showPage(pageId) {
  pages.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = (id === pageId) ? "flex" : "none";
  });
}

// Auto-add click listeners for buttons with data-target
document.querySelectorAll('button[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    showPage(targetId);
  });
});

// Show login page by default on page load
showPage("login");

// ================= AUTH FUNCTIONS =================
async function registerDriver(email,password){ 
  try{ 
    const u = await auth.createUserWithEmailAndPassword(email,password);
    const uid = u.user.uid;
    await db.ref("users/"+uid).set({role:"driver",balance:0});
    await db.ref("drivers/"+uid).set({location:{lat:0,lng:0},route:{}});
    alert("Driver account created!");
  }catch(e){alert(e.message);}
}

async function registerPassenger(email,password){
  try{
    const u = await auth.createUserWithEmailAndPassword(email,password);
    const uid = u.user.uid;
    await db.ref("users/"+uid).set({role:"passenger",balance:100});
    await db.ref("passengers/"+uid).set({balance:100});
    alert("Passenger account created!");
  }catch(e){alert(e.message);}
}

async function login(email,password){ try{await auth.signInWithEmailAndPassword(email,password);} catch(e){alert(e.message);} }
function logout(){ auth.signOut(); }

// ================= AUTH STATE LISTENER =================
auth.onAuthStateChanged(async(user)=>{
  if(!user){ document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById("login-screen")?.classList.add('active'); return; }

  const snap = await rtdb.ref("users/"+user.uid+"/role").once("value");
  userRole = snap.val()||"passenger";

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById("home")?.classList.add('active');

  initMap();
  initRealtimeListeners();
  loadBalance(user.uid);

  if(userRole==="passenger") startFetchingJeepsETA();
  if(userRole==="driver") startUpdatingDriverLocation(user.uid);

  document.getElementById("passenger-controls").style.display=(userRole==="passenger")?"block":"none";
  document.getElementById("driver-controls").style.display=(userRole==="driver")?"block":"none";
});

// ================= UI BUTTONS =================
document.getElementById("signup-driver-btn")?.addEventListener("click",()=>{ registerDriver(document.getElementById("emailInput").value,document.getElementById("passwordInput").value); });
document.getElementById("signup-passenger-btn")?.addEventListener("click",()=>{ registerPassenger(document.getElementById("emailInput").value,document.getElementById("passwordInput").value); });
document.getElementById("login-btn")?.addEventListener("click",()=>{ login(document.getElementById("emailInput").value,document.getElementById("passwordInput").value); });
document.getElementById("logout-btn")?.addEventListener("click",logout);

// ================= MAP FUNCTIONS =================
function initMap(){
  if(map) return;
  map = new maplibregl.Map({container:"map",style:"https://demotiles.maplibre.org/style.json",center:[121.0437,14.6760],zoom:13});
  map.addControl(new maplibregl.NavigationControl());

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const c = [pos.coords.longitude,pos.coords.latitude];
      map.setCenter(c); map.setZoom(15);
      new maplibregl.Marker({color:"#FF0000"}).setLngLat(c).setPopup(new maplibregl.Popup().setText("You are here")).addTo(map);
    });
  }
}

// ================= DRIVER MARKERS =================
function addOrUpdateMarker(id,loc,popup=null){
  if(!map) return;
  const coords = [loc.lng,loc.lat];
  if(markers[id]){ markers[id].setLngLat(coords); if(popup) markers[id].setPopup(new maplibregl.Popup().setHTML(popup)); return; }
  const el = document.createElement("div"); el.className="driver-marker"; el.innerText="J"; el.style.background="#FF7F50"; el.style.color="#fff"; el.style.padding="4px 6px"; el.style.borderRadius="4px"; el.style.fontWeight="bold";
  const m = new maplibregl.Marker(el).setLngLat(coords); if(popup) m.setPopup(new maplibregl.Popup().setHTML(popup)); m.addTo(map);
  markers[id]=m;
}

// ================= RTDB LISTENERS =================
function initRealtimeListeners(){
  const ref=rtdb.ref("drivers");
  ref.on("child_added",updateDriverMarker);
  ref.on("child_changed",updateDriverMarker);
  ref.on("child_removed",s=>removeMarker(s.key));
}
function updateDriverMarker(snap){ const id=snap.key; const val=snap.val(); if(!val||!val.location) return; addOrUpdateMarker(id,val.location); }
function removeMarker(id){ if(markers[id]){ markers[id].remove(); delete markers[id]; } }

// ================= PASSENGER FUNCTIONS =================
async function fetchJeepsWithETA(userLat,userLng){
  const user=auth.currentUser; if(!user) return;
  const token = await user.getIdToken();
  const res = await fetch(`${backendBase}/drivers_with_eta?user_lat=${userLat}&user_lng=${userLng}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!res.ok) return;
  const jeeps = await res.json();
  Object.keys(jeeps).forEach(jeepId=>{
    const jeep=jeeps[jeepId];
    const popup = `Jeep ID: ${jeepId}<br>Distance: ${jeep.distance_km} km<br>ETA: ${jeep.eta_minutes} min<br><button onclick="drawRoute('${jeepId}')">Show Route</button>`;
    addOrUpdateMarker(jeepId,{lat:jeep.lat,lng:jeep.lng},popup);
    polylines[jeepId]=jeep.geometry.map(c=>[c[1],c[0]]);
  });
}

function startFetchingJeepsETA(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude; const lng=pos.coords.longitude;
    fetchJeepsWithETA(lat,lng);
    setInterval(()=>fetchJeepsWithETA(lat,lng),5000);
  });
}

function drawRoute(jeepId){
  if(!map||!polylines[jeepId]) return;
  const coords=polylines[jeepId];
  const layerId=`route-${jeepId}`;
  if(map.getSource(layerId)){ map.removeLayer(layerId); map.removeSource(layerId);}
  map.addSource(layerId,{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:coords}}});
  map.addLayer({id:layerId,type:'line',source:layerId,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#FF4500','line-width':4,'line-opacity':0.8}});
  const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));
  map.fitBounds(bounds,{padding:30});
}

// ================= DRIVER LOCATION =================
function startUpdatingDriverLocation(driverId){
  navigator.geolocation.watchPosition(pos=>{
    const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
    rtdb.ref(`drivers/${driverId}/location`).set(loc);
    addOrUpdateMarker(driverId,loc);
  },err=>console.warn("Geo error:",err),{enableHighAccuracy:true});
}

// ================= BALANCE =================
async function loadBalance(uid){
  const ref = rtdb.ref(`users/${uid}/balance`);
  ref.on("value",snap=>{document.getElementById("balance-amt").innerText=(snap.val()||0).toFixed(2);});
}

document.getElementById("pay")?.addEventListener("click",async()=>{
  const user=auth.currentUser; if(!user) return alert("Login first");
  const uid=user.uid;
  const fare=window.lastRouteFare; if(!fare) return alert("Calculate a route first");
  const ref=rtdb.ref(`users/${uid}/balance`);
  const snap=await ref.get();
  const bal=snap.val()||0;
  if(bal<fare) return alert("Insufficient balance");
  ref.set(bal-fare);
  alert(`Paid ₱${fare.toFixed(2)}!`);
});
