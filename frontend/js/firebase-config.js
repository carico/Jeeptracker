// Import the functions needed from the SDKs
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products to be used
// https://firebase.google.com/docs/web/setup#available-libraries

// Firebase configuration
// compatible only in  Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUEOpgJIq5_9SxzlPkrZ4_eTwMtUOm57o",
  authDomain: "iwas123jeepney.firebaseapp.com",
  projectId: "iwas123jeepney",
  storageBucket: "iwas123jeepney.firebasestorage.app",
  messagingSenderId: "185467833786",
  appId: "1:185467833786:web:f6956b5b7163c8ce88a183",
  measurementId: "G-TS3YY2S64G"
};

// Initializes Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);