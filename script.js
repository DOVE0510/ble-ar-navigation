// ============ Firebase imports ============
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// ============ Firebase configuration ============
const firebaseConfig = {
  apiKey: "AIzaSyCDEs8PV9DCwSX08p9qveSXbZeEshNXY9Y",
  authDomain: "ble-navigation-dda3d.firebaseapp.com",
  databaseURL: "https://ble-navigation-dda3d-default-rtdb.firebaseio.com",
  projectId: "ble-navigation-dda3d",
  storageBucket: "ble-navigation-dda3d.appspot.com",
  messagingSenderId: "163668554147",
  appId: "1:163668554147:web:2c75ddcb62d1dcee1191d6",
  measurementId: "G-R9HSWK2L8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============ Camera background ============
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    document.getElementById("camera").srcObject = stream;
  } catch (err) {
    alert("Camera access denied.");
    console.error(err);
  }
}
startCamera();

// ============ Canvas setup ============
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ============ Constants ============
const hallwayLength = 1.8; // meters
const beaconPositions = {
  "d9:f3:ed:e0:46:2f": 0.0,
  "da:af:6d:87:ed:91": 0.9,
  "e5:d3:5c:26:5c:63": 1.8
};

// ============ RSSI to Distance ============
function rssiToDistance(rssi) {
  const txPower = -59;
  const n = 2.2;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

// ============ Smooth position filter ============
let smoothPos = 0; // previous position
const alpha = 0.2; // smoothing factor

function smoothFilter(newPos) {
  smoothPos = alpha * newPos + (1 - alpha) * smoothPos;
  return smoothPos;
}

// ============ Draw AR position ============
function drawDot(xMeters) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const barWidth = canvas.width;
  const posX = (xMeters / hallwayLength) * barWidth;
  const posY = canvas.height * 0.75;

  // glowing red dot
  ctx.beginPath();
  ctx.arc(posX, posY, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
  ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
  ctx.shadowBlur = 20;
  ctx.fill();

  document.getElementById("positionLabel").textContent =
    `Position: ${xMeters.toFixed(2)} m`;
}

// ============ Firebase Realtime Listener ============
const dataRef = ref(db, "floors/floor_1/beacons");

onValue(dataRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const distances = {};
  Object.keys(beaconPositions).forEach(mac => {
    const rssi = data[mac]?.rssi ?? null;
    if (rssi !== null) distances[mac] = { distance: rssiToDistance(rssi) };
  });

  // Weighted average positioning (1D)
  if (Object.keys(distances).length >= 2) {
    let numerator = 0, denominator = 0;
    for (const mac in distances) {
      const d = distances[mac].distance;
      const pos = beaconPositions[mac];
      const w = 1 / (d * d + 0.0001);
      numerator += w * pos;
      denominator += w;
    }
    const newPos = numerator / denominator;
    const filteredPos = smoothFilter(newPos);
    drawDot(filteredPos);
  }
});
