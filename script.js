// Beacon positions (in meters)
const beacons = {
  "d9:f3:ed:e0:46:2f": { pos: 0.0 },
  "da:af:6d:87:ed:91": { pos: 0.9 },
  "e5:d3:5c:26:5c:63": { pos: 1.8 }
};

const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const label = document.getElementById("posLabel");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Start camera
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  video.srcObject = stream;
}

// Convert RSSI to distance
function rssiToDistance(rssi) {
  const txPower = -59, n = 2.2;
  return Math.pow(10, (txPower - rssi) / (10 * n));
}

// Draw red dot
function drawDot(x) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const posX = (x / 1.8) * canvas.width;
  const posY = canvas.height * 0.75;
  ctx.beginPath();
  ctx.arc(posX, posY, 20, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,0,0,0.8)";
  ctx.fill();
}

// Compute position
function estimatePosition(data) {
  let num = 0, den = 0;
  for (const mac in data) {
    const d = data[mac].distance;
    const pos = beacons[mac].pos;
    const w = 1 / (d * d + 0.0001);
    num += w * pos;
    den += w;
  }
  return num / den;
}

// Start scanning
async function startScanning() {
  document.getElementById("startButton").style.display = "none";
  await startCamera();

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
    alert("Bluetooth permission denied or unsupported.");
    console.error(err);
  }
}

document.getElementById("startButton").onclick = startScanning;
