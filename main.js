import './style.css'
import createMqttService from './mqttService.js';



// Helper to update connection status in the DOM
const updateConnectionStatus = (status) => {
  const statusElement = document.querySelector('#connection-status span');
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = status.toLowerCase();
  }
};

// Create a singleton instance with callbacks
const mqttService = createMqttService({
  callbacks: {
    onStatusChange: updateConnectionStatus
  }
});

// Constants for device status handling
const EXCLUDED_SENSORS = [
  "ip_address",
  "ssid",
  "bssid",
  "esphome_version",
  "wifi_signal",
  "uptime",
  "uptime_sensor",
];

// Create a Map to store sensor elements
const sensorElements = new Map();

// Improved temperature gradient function with clearer logic and named ranges
const getTemperatureGradient = (temperature) => {
  const temp = parseFloat(temperature);

  const colorRanges = {
    superCool: { color: [100, 200, 255], maxTemp: 24 }, // Light blue
    cool: { color: [155, 200, 255], maxTemp: 25 },      // Blue
    perfect: { color: [150, 255, 150], maxTemp: 28 },    // Green
    warm: { color: [255, 200, 100], maxTemp: 30 },       // Orange
    hot: { color: [255, 100, 100], maxTemp: Infinity },   // Red
  };

  let color1, color2;
  let range1, range2;

 for (const rangeKey in colorRanges) {
        const range = colorRanges[rangeKey];
        if (temp <= range.maxTemp) {
            range1 = range;
            // Find previous range, with handling of the first range
            const rangeKeys = Object.keys(colorRanges);
            const index = rangeKeys.indexOf(rangeKey);
            if(index > 0){
                range2 = colorRanges[rangeKeys[index-1]];
            } else {
              range2 = range1; //If current range is the first range
            }
            break;
        }
    }

    if(range1 === range2){ // if we in the same range use same color
        color1 = range1.color;
        color2 = range1.color;
    } else { //if in different range, calculate color transition
        const factor = (temp - range2.maxTemp) / (range1.maxTemp - range2.maxTemp);
        color1 = range2.color.map((c, i) => Math.round(c + (range1.color[i] - c) * factor));
        color2 = range2.color.map((c, i) => Math.round(c + (range1.color[i] - c) * (factor + 0.2)));
    }

  return `linear-gradient(135deg, rgb(${color1.join(',')}) 0%, rgb(${color2.join(',')}) 100%)`;
};

// Improved humidity gradient function
const getHumidityGradient = (humidity) => {
  const hum = parseFloat(humidity);

  const humidityRanges = {
    tooLow: { color: [255, 150, 150], maxHum: 30 },    // Light red
    low: { color: [255, 200, 150], maxHum: 40 },       // Light orange
    perfect: { color: [150, 255, 150], maxHum: 50 },   // Green
    high: { color: [150, 200, 255], maxHum: 60 },      // Light blue
    tooHigh: { color: [100, 150, 255], maxHum: 70 },   // Blue
    extreme: { color: [100, 150, 255], maxHum: Infinity }, // Blue for extreme humidity
  };

  let color1, color2;
  let range1, range2;

  for (const rangeKey in humidityRanges) {
    const range = humidityRanges[rangeKey];
        if (hum <= range.maxHum) {
            range1 = range;
             // Find previous range, with handling of the first range
            const rangeKeys = Object.keys(humidityRanges);
            const index = rangeKeys.indexOf(rangeKey);
            if(index > 0){
                range2 = humidityRanges[rangeKeys[index-1]];
            } else {
              range2 = range1; //If current range is the first range
            }
            break;
        }
    }

  if (range1 === range2) {
    color1 = range1.color;
    color2 = range1.color;
  } else {
    const factor = (hum - range2.maxHum) / (range1.maxHum - range2.maxHum);
    color1 = range2.color.map((c, i) => Math.round(c + (range1.color[i] - c) * factor));
    color2 = range2.color.map((c, i) => Math.round(c + (range1.color[i] - c) * (factor + 0.2)));
  }

  return `linear-gradient(135deg, rgb(${color1.join(',')}) 0%, rgb(${color2.join(',')}) 100%)`;
};

// Sensor icon mapping
const SENSOR_ICONS = {
  temperature: '🌡️',
  humidity: '💧',
  default: '📊'
};

// Time intervals for time ago calculation
const INTERVALS = [
  { label: 'year', seconds: 31536000 },
  { label: 'month', seconds: 2592000 },
  { label: 'day', seconds: 86400 },
  { label: 'hour', seconds: 3600 },
  { label: 'minute', seconds: 60 },
  { label: 'second', seconds: 1 }
];

// Utility function to format time ago
const getTimeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  for (let interval of INTERVALS) {
    const count = Math.floor(seconds / interval.seconds);
    if (count > 0) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
};

// Update sensor display
const updateSensor = (sensor) => {
  const elementId = `${sensor.deviceId}-${sensor.sensorType}`;
  let sensorDiv = sensorElements.get(elementId);

  if (!sensorDiv) {
    sensorDiv = document.createElement('div');
    sensorDiv.className = 'sensor';
    sensorDiv.id = elementId;
    document.querySelector('#sensors').appendChild(sensorDiv);
    sensorElements.set(elementId, sensorDiv);
  }

  const sensorType = sensor.sensorType.toLowerCase();
  let backgroundStyle = '';

  if (sensorType === 'temperature') {
    backgroundStyle = `background: ${getTemperatureGradient(sensor.value)};`;
  } else if (sensorType === 'humidity') {
    backgroundStyle = `background: ${getHumidityGradient(sensor.value)};`;
  }

  sensorDiv.innerHTML = `
    <div class="sensor-card ${sensorType}" style="${backgroundStyle}">
      <div class="sensor-icon">
        ${SENSOR_ICONS[sensorType] || SENSOR_ICONS.default}
      </div>
      <div class="sensor-content">
        <div class="sensor-value">
          ${sensor.value}${sensorType === 'temperature' ? '°C' : '%'}
        </div>
        <div class="sensor-type">${sensor.sensorType}</div>
        <div class="sensor-device">${sensor.deviceId}</div>
        <div class="sensor-timestamp" data-timestamp="${sensor.timestamp}">${getTimeAgo(sensor.timestamp)}</div>
      </div>
    </div>
  `;
};

// Update all timestamps every second
const updateAllTimestamps = () => {
  document.querySelectorAll('.sensor-timestamp').forEach(timestampElement => {
    const timestamp = timestampElement.dataset.timestamp;
    if (timestamp) {
      timestampElement.textContent = getTimeAgo(timestamp);
    }
  });
};
setInterval(updateAllTimestamps, 1000);

// Simplified HTML template
document.querySelector('#app').innerHTML = `
  <div>
    <div id="connection-status">Connection Status: <span>Connecting...</span></div>
    <div id="sensors"></div>
  </div>
`;

// Handle incoming MQTT messages
const handleMessage = (message) => {
  const topicParts = message.destinationName.split("/");
  const deviceId = topicParts[3];
  const sensorType = topicParts[5];

  if (EXCLUDED_SENSORS.includes(sensorType)) return;

  updateSensor({
    deviceId,
    sensorType,
    value: message.payloadString,
    timestamp: new Date().toISOString()
  });
};

// Initialize MQTT service and connect
mqttService.addMessageHandler(handleMessage);
mqttService.connect();