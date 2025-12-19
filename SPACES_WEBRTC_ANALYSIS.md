# Audio Spaces WebRTC Implementation Analysis

## Current Architecture Map

### Roles + State Model
- **Host**: Creator of space, can start/end space, record
- **Speaker**: Can speak (publish audio), automatically includes host
- **Listener**: Can only listen (receive audio)
- **State**: `scheduled` → `live` → `ended`

### Current Implementation Status
❌ **NO WebRTC IMPLEMENTATION FOUND**
- SpaceRoom.jsx has `localStream` and `remoteStreams` state but they're never used
- No RTCPeerConnection instances
- No WebRTC signaling (offer/answer/ICE)
- No audio track publishing/subscribing
- Only MediaRecorder for recording (not real-time streaming)

### Signaling Message Flow
**CURRENT**: Only basic socket events:
- `space:join` - Join socket room
- `space:leave` - Leave socket room
- `space:recordingStatus` - Recording state updates
- `space:statusChanged` - Space status updates
- `space:participantJoined` - Participant role changes

**MISSING**: WebRTC signaling events:
- `space:webrtc:offer` - SDP offer
- `space:webrtc:answer` - SDP answer
- `space:webrtc:ice` - ICE candidate
- `space:webrtc:ready` - Peer ready for negotiation

### Peer Connection Topology
**PLANNED**: P2P Mesh
- Each speaker maintains peer connections to all listeners
- Each listener maintains peer connections to all speakers
- Host/speakers publish audio tracks
- Listeners subscribe to audio tracks

### Where Audio Tracks Should Be Published/Subscribed
**SPEAKER (Host/Speaker)**:
1. Get user media: `getUserMedia({audio: true})`
2. Create RTCPeerConnection
3. Add track: `pc.addTrack(audioTrack, stream)`
4. Create offer with `sendonly` transceiver
5. Send offer via socket
6. Receive answer, set remote description
7. Exchange ICE candidates

**LISTENER**:
1. Create RTCPeerConnection
2. Add transceiver: `addTransceiver('audio', {direction: 'recvonly'})` BEFORE createOffer
3. Create offer
4. Send offer via socket
5. Receive answer, set remote description
6. Exchange ICE candidates
7. On `ontrack` event: set audio element srcObject and play()

## Root Causes Identified

### 1. Missing WebRTC Implementation
**File**: `threads-app/frontend/src/Pages/SpaceRoom.jsx`
**Issue**: No RTCPeerConnection code exists
**Symptom**: Listeners cannot receive audio because there's no WebRTC setup
**Why it breaks**: Without peer connections, audio cannot be streamed

### 2. Missing Signaling Layer
**File**: `threads-app/backend/socket/socket.js`
**Issue**: No WebRTC signaling event handlers
**Symptom**: No way to exchange SDP offers/answers and ICE candidates
**Why it breaks**: WebRTC requires signaling to establish connections

### 3. Missing Transceiver Setup
**Issue**: No transceiver configuration for listeners
**Symptom**: Even if signaling existed, listeners wouldn't request audio
**Why it breaks**: Unified-plan requires explicit transceiver setup

### 4. Missing Audio Element Setup
**Issue**: No audio elements to play remote streams
**Symptom**: Even if tracks arrive, they won't play
**Why it breaks**: Audio needs HTMLAudioElement with srcObject set

## Implementation Plan

1. Add WebRTC signaling handlers in backend
2. Implement peer connection management in frontend
3. Add proper transceiver setup
4. Add ICE server configuration
5. Add debug logging
6. Add autoplay handling
7. Add cleanup and edge case handling

