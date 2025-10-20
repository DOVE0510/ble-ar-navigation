// ========== Firebase Imports ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// ========== Firebase Config ==========
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ========== Globals ==========
let beacons = {};  // will load from Firebase
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const label = document.getElementById("posLabel");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ========== Start Camera ==========
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  document.getElementById("camera").srcObject = stream;
}

// ========== RSSI → Distance ==========
function rssiToDistance(rssi) {
  const txPower = -59, n = 2.2;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

// ========== Draw Red Dot ==========
function drawDot(x) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const posX = (x / getMaxBeaconPos()) * canvas.width;
  const posY = canvas.height * 0.75;
  ctx.beginPath();
  ctx.arc(posX, posY, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,0,0,0.8)";
  ctx.shadowColor = "red";
  ctx.shadowBlur = 15;
  ctx.fill();
}

// ========== Weighted Position Estimate ==========
function estimatePosition(beaconData) {
  let num = 0, den = 0;
  for (const mac in beaconData) {
    const d = beaconData[mac].distance;
    const pos = beacons[mac].pos;
    const w = 1 / (d * d + 0.0001);
    num += w * pos;
    den += w;
  }
  return num / den;
}

// ========== Utility ==========
function getMaxBeaconPos() {
  return Math.max(...Object.values(beacons).map(b => b.pos || 0));
}

// ========== Load Beacon Positions from Firebase ==========
const beaconsRef = ref(db, "beacons");
onValue(beaconsRef, (snapshot) => {
  beacons = snapshot.val() || {};
  console.log("📡 Beacons loaded:", beacons);
});

// ========== BLE Scanning (Web Bluetooth) ==========
async function startBLEScan() {
  try {
    const scan = await navigator.bluetooth.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true
    });

    navigator.bluetooth.addEventListener("advertisementreceived", (event) => {
      const mac = event.device.id.toLowerCase();
      const rssi = event.rssi;
      if (beacons[mac]) {
        beacons[mac].rssi = rssi;
        beacons[mac].distance = rssiToDistance(rssi);
        const valid = Object.values(beacons).filter(b => b.distance);
        if (valid.length >= 2) {
          const pos = estimatePosition(beacons);
          drawDot(pos);
          label.textContent = `Position: ${pos.toFixed(2)} m`;
        }
      }
    });
  } catch (err) {
    alert("Bluetooth permission denied or not supported on this device/browser.");
    console.error(err);
  }
}

// ========== Start Everything ==========
document.getElementById("startButton").onclick = async () => {
  document.getElementById("startButton").style.display = "none";
  await startCamera();
  startBLEScan();
};
