const WebSocket = require('ws');
const express = require('express');
const net = require('net');

const HTTP_PORT = 9000; // HTTP API for external clients
const WS_PORT = 9001;   // WebSocket for web clients
const TCP_PORT = 9002;  // TCP connection with Camera

const app = express();
const server = app.listen(HTTP_PORT, () => {
	console.log(`HTTP Server running on port ${HTTP_PORT}`);
});

const wss = new WebSocket.Server({ port: WS_PORT }, () => {
	console.log(`WebSocket Server running on port ${WS_PORT}`);
});

let cameras = {}; // Store connected cameras by MAC address

// Handle TCP connections from the Camera
const tcpServer = net.createServer((socket) => {
	console.log('Camera connected.');

	let cameraMacAddress = null;

	socket.on('data', (data) => {
		console.log(data.toString().trim());
		// Assume the first message is the MAC address
		if (!cameraMacAddress) {
			cameraMacAddress = data.toString().trim();
			cameras[cameraMacAddress] = socket; // Store socket by MAC address
			console.log(`Camera MAC Address: ${cameraMacAddress}`);
		} else {
			// Handle further data from the camera if needed
			console.log(`Received data from camera ${cameraMacAddress}: ${data}`);
		}
	});

	socket.on('close', () => {
		// Remove camera from the collection when disconnected
		if (cameraMacAddress) {
			console.log(`Camera with MAC address ${cameraMacAddress} disconnected.`);
			delete cameras[cameraMacAddress];
		}
	});

	socket.on('error', (err) => {
		console.error(`Camera connection error: ${err.message}`);
	});
});

tcpServer.listen(TCP_PORT, () => {
	console.log(`TCP Server listening on port ${TCP_PORT}`);
});

// API Endpoint to forward requests to the specific Camera
app.get('*', (req, res) => {
	const macAddress = req.hostname.split('.')[0]; // Extract MAC address from the hostname

	if (!macAddress || !cameras[macAddress]) {
		return res.status(500).send(`Camera with MAC address ${macAddress} not connected`);
	}

	const cameraSocket = cameras[macAddress];
	const command = req.originalUrl;

	console.log(`Forwarding request to camera ${macAddress}: ${command}`);
	cameraSocket.write(command + '\n');

	// Wait for the response from the camera
	let responseData = '';
	cameraSocket.once('data', (data) => {
		responseData = data.toString();
		console.log(`Response from camera ${macAddress}: ${responseData}`);
		res.send(responseData);
	});

	// Timeout in case of no response
	setTimeout(() => {
		if (!responseData) {
			res.status(504).send('Camera did not respond');
		}
	}, 5000);
});
