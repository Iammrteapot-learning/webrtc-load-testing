const janusServerUrl = "http://localhost:8088/janus"; // REST API endpoint
const mountpointId = 1; // The ID of the RTSP stream mountpoint
let sessionId = null;
let pluginId = null;
let webrtcConnection = null;

async function startWebRTCStream() {
  // Step 1: Create a Janus session
  const sessionResponse = await fetch(`${janusServerUrl}`, {
    method: "POST",
    body: JSON.stringify({ transaction: "create-session" }),
  });
  const sessionData = await sessionResponse.json();
  sessionId = sessionData.data.id;
  console.log("Session created:", sessionId);

  // Step 2: Attach to the Streaming plugin
  const attachResponse = await fetch(`${janusServerUrl}/${sessionId}`, {
    method: "POST",
    body: JSON.stringify({
      transaction: "attach-plugin",
      plugin: "janus.plugin.streaming",
    }),
  });
  const attachData = await attachResponse.json();
  pluginId = attachData.data.id;
  console.log("Attached to plugin:", pluginId);

  // Step 3: Request to watch the RTSP mountpoint
  const watchResponse = await fetch(
    `${janusServerUrl}/${sessionId}/${pluginId}`,
    {
      method: "POST",
      body: JSON.stringify({
        transaction: "watch-stream",
        body: { request: "watch", id: mountpointId },
      }),
    }
  );
  const watchData = await watchResponse.json();
  console.log("Watch response:", watchData);

  // Step 4: Create a WebRTC peer connection
  const jsepOffer = watchData.jsep;
  webrtcConnection = new RTCPeerConnection();
  webrtcConnection.ontrack = (event) => {
    document.getElementById("stream").srcObject = event.streams[0];
  };

  // Step 5: Handle WebRTC signaling
  await webrtcConnection.setRemoteDescription(
    new RTCSessionDescription(jsepOffer)
  );
  const localDescription = await webrtcConnection.createAnswer();
  await webrtcConnection.setLocalDescription(localDescription);

  // Step 6: Send the SDP answer to Janus
  await fetch(`${janusServerUrl}/${sessionId}/${pluginId}`, {
    method: "POST",
    body: JSON.stringify({
      transaction: "send-sdp-answer",
      body: { request: "start" },
      jsep: localDescription,
    }),
  });

  console.log("WebRTC connection established!");
}

// Start the WebRTC stream
startWebRTCStream().catch((err) => console.error("Error:", err));
