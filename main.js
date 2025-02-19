import './style.css'

// Default MQTT configuration
const DEFAULT_CONFIG = {
  brokerUrl: "broker.emqx.io",
  port: 8084,
  useSSL: true,
  clientId: "vue-client-" + Math.random().toString(36).substring(7),
  topic: "projects/pandashouse/devices/+/sensor/#",
};

// Helper to update connection status in the DOM
const updateConnectionStatus = (status) => {
  const statusElement = document.querySelector('#connection-status span');
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = status.toLowerCase();
  }
};

// MQTT Service implementation without reactive state
const createMqttService = (config = {}) => {
  let client = null;
  let messageHandlers = [];

  // Merge provided config with defaults
  const mqttConfig = { ...DEFAULT_CONFIG, ...config };

  const setupClient = () => {
    client = new Paho.Client(
      mqttConfig.brokerUrl,
      Number(mqttConfig.port),
      mqttConfig.clientId
    );

    client.onConnectionLost = (responseObject) => {
      console.log("Connection Lost: " + responseObject.errorMessage);
      updateConnectionStatus("disconnected");
      mqttConfig.callbacks?.onConnectionLost?.(responseObject);
      // Auto-reconnect after a delay
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 5000);
    };

    client.onMessageArrived = (message) => {
      messageHandlers.forEach((handler) => handler(message));
      mqttConfig.callbacks?.onMessageArrived?.(message);
    };
  };

  const connect = () => {
    if (!client) {
      setupClient();
    }

    updateConnectionStatus("connecting");
    client.connect({
      onSuccess: () => {
        console.log("Connected to MQTT broker");
        updateConnectionStatus("connected");
        client.subscribe(mqttConfig.topic);
        mqttConfig.callbacks?.onConnect?.();
      },
      onFailure: (error) => {
        console.error("Failed to connect to MQTT:", error);
        updateConnectionStatus("disconnected");
        mqttConfig.callbacks?.onConnectionFailed?.(error);
        // Auto-retry connection after a delay
        setTimeout(() => {
          console.log("Retrying connection...");
          connect();
        }, 5000);
      },
      useSSL: mqttConfig.useSSL,
    });
  };

  const disconnect = () => {
    if (client && client.isConnected()) {
      client.disconnect();
    }
  };

  const publish = (topic, message, qos = 0, retained = false) => {
    if (client && client.isConnected()) {
      const mqttMessage = new Paho.Message(message);
      mqttMessage.destinationName = topic;
      mqttMessage.qos = qos;
      mqttMessage.retained = retained;
      client.send(mqttMessage);
    } else {
      console.error("Cannot publish: client is not connected");
    }
  };

  const subscribe = (topic, qos = 0) => {
    if (client && client.isConnected()) {
      client.subscribe(topic, { qos });
    } else {
      console.error("Cannot subscribe: client is not connected");
    }
  };

  const unsubscribe = (topic) => {
    if (client && client.isConnected()) {
      client.unsubscribe(topic);
    } else {
      console.error("Cannot unsubscribe: client is not connected");
    }
  };

  const addMessageHandler = (handler) => {
    messageHandlers.push(handler);
  };

  const removeMessageHandler = (handler) => {
    const index = messageHandlers.indexOf(handler);
    if (index > -1) {
      messageHandlers.splice(index, 1);
    }
  };

  const isConnected = () => {
    return client?.isConnected() || false;
  };

  return {
    connect,
    disconnect,
    publish,
    subscribe,
    unsubscribe,
    addMessageHandler,
    removeMessageHandler,
    isConnected,
  };
};

// Create a singleton instance
const mqttService = createMqttService();

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

// Add this function after the constants
const getTemperatureGradient = (temperature) => {
  // Convert temperature to a value between 0 and 1
  // Assuming temperature range from -10°C to 40°C
  const normalizedTemp = (parseFloat(temperature) + 10) / 50;
  
  // Generate colors for cold, neutral, and warm temperatures
  const cold = [155, 200, 255];    // Light blue
  const neutral = [255, 230, 180];  // Light orange
  const warm = [255, 100, 100];     // Warm red
  
  let color1, color2;
  
  if (normalizedTemp <= 0.5) {
    // Interpolate between cold and neutral
    const factor = normalizedTemp * 2;
    color1 = cold.map((c, i) => Math.round(c + (neutral[i] - c) * factor));
    color2 = cold.map((c, i) => Math.round(c + (neutral[i] - c) * (factor + 0.2)));
  } else {
    // Interpolate between neutral and warm
    const factor = (normalizedTemp - 0.5) * 2;
    color1 = neutral.map((c, i) => Math.round(c + (warm[i] - c) * factor));
    color2 = neutral.map((c, i) => Math.round(c + (warm[i] - c) * (factor + 0.2)));
  }
  
  return `linear-gradient(135deg, rgb(${color1.join(',')}) 0%, rgb(${color2.join(',')}) 100%)`;
};

// Update the updateSensor function
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

  // Generate background gradient for temperature sensors
  const backgroundStyle = sensor.sensorType.toLowerCase() === 'temperature' 
    ? `style="background: ${getTemperatureGradient(sensor.value)}"` 
    : `class="${sensor.sensorType.toLowerCase()}"`;

  sensorDiv.innerHTML = `
    <div class="sensor-card ${sensor.sensorType.toLowerCase()}" ${backgroundStyle}>
      <div class="sensor-icon">
        ${sensor.sensorType.toLowerCase() === 'temperature' ? '🌡️' : '💧'}
      </div>
      <div class="sensor-content">
        <div class="sensor-value">
          ${sensor.value}${sensor.sensorType.toLowerCase() === 'temperature' ? '°C' : '%'}
        </div>
        <div class="sensor-type">${sensor.sensorType}</div>
        <div class="sensor-device">${sensor.deviceId}</div>
        <div class="sensor-timestamp">Updated: ${new Date(sensor.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  `;
};

// Simplify the HTML template
document.querySelector('#app').innerHTML = `
  <div>
    <div id="connection-status">Connection Status: <span>Connecting...</span></div>
    <div id="sensors"></div>
  </div>
`;

// Simplify message handling
const handleMessage = (message) => {
  const topicParts = message.destinationName.split("/");
  const deviceId = topicParts[3];
  const sensorType = topicParts[5];

  console.log(message);

  if (EXCLUDED_SENSORS.includes(sensorType)) return;

  updateSensor({
    deviceId,
    sensorType,
    value: message.payloadString,
    timestamp: new Date().toISOString()
  });
};

// Initialize MQTT service with message handler and connect
mqttService.addMessageHandler(handleMessage);
mqttService.connect();
