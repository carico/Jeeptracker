// auth.js
// Firebase references
const auth = firebase.auth();
const db = firebase.database();

// ----------------------------
// Register Driver type user
// ----------------------------
async function registerDriver(email, password) {
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;

    // Set user role
    await db.ref("users/" + uid).set({
      role: "driver",
      balance: 0
    });

    // Initialize driver-specific node
    await db.ref("drivers/" + uid).set({
      location: { lat: 0, lng: 0 },
      route: {}
    });

    alert("Driver account created!");
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------
// Register Passenger type uer
// ----------------------------
async function registerPassenger(email, password) {
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;

    // Set user role
    await db.ref("users/" + uid).set({
      role: "passenger",
      balance: 100 // default starting balance
    });

    // Initialize passenger-specific node
    await db.ref("passengers/" + uid).set({
      balance: 100
    });

    alert("Passenger account created!");
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------
// Login function
// ----------------------------
async function login(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------
// Logout function
// ----------------------------
async function logout() {
  try {
    await auth.signOut();
  } catch (err) {
    alert(err.message);
  }
}

// ----------------------------
// Auth state listener
// ----------------------------
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log("Logged in:", user.email);

    // Get role
    const snapshot = await db.ref("users/" + user.uid + "/role").once("value");
    const role = snapshot.val();

    // Show different UI based on role
    if (role === "driver") {
      console.log("Driver logged in");
      // driver-specific updates 
    } else if (role === "passenger") {
      console.log("Passenger logged in");
      // Passenger-specific updates
    }
  } else {
    console.log("Not logged in");
  }
});

// Grabs email/password input values
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

// Hooks driver signup button
document.getElementById("signup-driver-btn").onclick = () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    registerDriver(email, password);
};

// Hooks passenger signup button
document.getElementById("signup-passenger-btn").onclick = () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    registerPassenger(email, password);
};

// Hooks login button
document.getElementById("login-btn").onclick = () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    login(email, password);
};

// Hooks logout button
document.getElementById("logout-btn").onclick = logout;
