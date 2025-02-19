// Default MQTT configuration
const DEFAULT_CONFIG = {
  brokerUrl: "broker.emqx.io",
  port: 8084,
  useSSL: true,
  clientId: "vue-client-" + Math.random().toString(36).substring(7),
  topic: "projects/pandashouse/devices/+/sensor/#",
};

// MQTT Service implementation with improved error handling and reconnection
const createMqttService = (config = {}) => {
  let client = null;
  let messageHandlers = [];
  let reconnectTimeout = null;

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
      mqttConfig.callbacks?.onConnectionLost?.(responseObject);
      mqttConfig.callbacks?.onStatusChange?.("disconnected");
      // Clear any existing timeout and attempt to reconnect
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connect, 5000);
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

    mqttConfig.callbacks?.onStatusChange?.("connecting");
    client.connect({
      onSuccess: () => {
        console.log("Connected to MQTT broker");
        mqttConfig.callbacks?.onStatusChange?.("connected");
        client.subscribe(mqttConfig.topic);
        mqttConfig.callbacks?.onConnect?.();
        // Clear any pending reconnect attempts on successful connection
        clearTimeout(reconnectTimeout);
      },
      onFailure: (error) => {
        console.error("Failed to connect to MQTT:", error);
        mqttConfig.callbacks?.onStatusChange?.("disconnected");
        mqttConfig.callbacks?.onConnectionFailed?.(error);
        // Clear any existing timeout and attempt to reconnect
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      },
      useSSL: mqttConfig.useSSL,
    });
  };

  const disconnect = () => {
    if (client && client.isConnected()) {
      client.disconnect();
      // Clear any pending reconnect attempts on manual disconnect
      clearTimeout(reconnectTimeout);
    }
    mqttConfig.callbacks?.onStatusChange?.("disconnected");
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
    messageHandlers = messageHandlers.filter((h) => h !== handler);
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

export default createMqttService; 