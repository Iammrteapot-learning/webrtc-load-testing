import asyncio
import cv2
from aiortc import RTCPeerConnection, VideoStreamTrack, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from aiohttp import web

# Media relay to handle multiple RTSP clients
relay = MediaRelay()

# Video file stream
class VideoFileStream(VideoStreamTrack):
    def __init__(self, file_path):
        super().__init__()
        self.cap = cv2.VideoCapture(file_path)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open video file: {file_path}")

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        success, frame = self.cap.read()
        if not success:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Loop video
            success, frame = self.cap.read()
        if not success:
            raise RuntimeError("Cannot read frame from video file")

        # Convert the frame to RGB for WebRTC compatibility
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return self.video_frame(frame, pts, time_base)


# Create an RTSP endpoint
async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    # PeerConnection setup
    pc = RTCPeerConnection()
    pc.addTrack(relay.subscribe(VideoFileStream("testsrc_01.mp4")))

    # Set remote description and create an answer
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.json_response({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })


# Create the application and routes
app = web.Application()
app.router.add_post("/offer", offer)

# Run the application
if __name__ == "__main__":
    web.run_app(app, port=8554)
