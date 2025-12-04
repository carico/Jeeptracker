// firebase-config.js (Compat version)
const firebaseConfig = {
  apiKey: "AIzaSyCUEOpgJIq5_9SxzlPkrZ4_eTwMtUOm57o",
  authDomain: "iwas123jeepney.firebaseapp.com",
  databaseURL: "https://iwas123jeepney-default-rtdb.firebaseio.com", // Add your Realtime DB URL
  projectId: "iwas123jeepney",
  storageBucket: "iwas123jeepney.appspot.com",
  messagingSenderId: "185467833786",
  appId: "1:185467833786:web:f6956b5b7163c8ce88a183",
  measurementId: "G-TS3YY2S64G"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const rtdb = firebase.database();

// sends it global
window.auth = auth;
window.rtdb = rtdb;