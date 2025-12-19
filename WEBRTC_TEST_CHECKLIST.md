# WebRTC Audio Spaces - Test Checklist

## Pre-Testing Setup

1. **Enable Debug Logging**: Open browser console to see WebRTC debug logs
2. **Check Environment**: Ensure development mode is active (debug logs enabled)
3. **Microphone Permissions**: Grant microphone access when prompted

## Test Scenarios

### ✅ Test 1: Basic Audio Flow (Same Network)
**Setup**: Host and listener on same Wi-Fi network

**Steps**:
1. Host creates space
2. Host starts space (status → "live")
3. Listener joins space
4. Host speaks into microphone

**Expected Results**:
- [ ] Listener sees "Connecting audio..." status
- [ ] Listener sees "✓ Audio connected" status
- [ ] Listener hears host's audio
- [ ] Console shows WebRTC debug logs:
  - `[WebRTC] Creating peer connection`
  - `[WebRTC] Offer created`
  - `[WebRTC] Answer received`
  - `[WebRTC] Track received`
  - `[WebRTC] Audio playing`

**Pass Criteria**: Listener hears host's audio within 5 seconds

---

### ✅ Test 2: Cross-Network Audio (Requires TURN)
**Setup**: Host and listener on different networks (e.g., different Wi-Fi, mobile data)

**Steps**:
1. Configure TURN server in `.env`:
   ```
   VITE_TURN_SERVER_URL=turn:your-turn-server.com:3478
   VITE_TURN_USERNAME=your-username
   VITE_TURN_CREDENTIAL=your-credential
   ```
2. Host creates and starts space
3. Listener joins from different network
4. Host speaks

**Expected Results**:
- [ ] Listener hears host's audio
- [ ] Console shows ICE candidates being exchanged
- [ ] Connection state becomes "connected"

**Pass Criteria**: Listener hears audio across networks

**Note**: Without TURN, this test will likely fail. TURN is required for NAT traversal.

---

### ✅ Test 3: Mobile Browser Join
**Setup**: Test on mobile device (iOS Safari, Chrome Android)

**Steps**:
1. Host creates and starts space on desktop
2. Open space on mobile browser
3. Join as listener
4. Grant microphone permission if prompted
5. Host speaks

**Expected Results**:
- [ ] Mobile browser receives audio
- [ ] If autoplay blocked, "Tap to enable audio" button appears
- [ ] After tapping button, audio plays

**Pass Criteria**: Mobile listener hears audio (may require manual enable)

---

### ✅ Test 4: Late Join (Space Already Live)
**Setup**: Space is live with active speakers

**Steps**:
1. Host creates and starts space
2. Speaker 1 joins and speaks
3. Listener joins after 30 seconds
4. Speaker 1 continues speaking

**Expected Results**:
- [ ] Listener immediately connects to existing speakers
- [ ] Listener hears audio within 5 seconds
- [ ] Console shows connections being established

**Pass Criteria**: Late-joining listener receives audio

---

### ✅ Test 5: Role Switching (Listener → Speaker → Listener)
**Setup**: User starts as listener

**Steps**:
1. User joins as listener
2. Verify receiving audio
3. Switch to speaker
4. Verify microphone is active (check mute/unmute button)
5. Switch back to listener
6. Verify still receiving audio

**Expected Results**:
- [ ] Role switch doesn't break connections
- [ ] Speaker mode: mute/unmute button appears
- [ ] Listener mode: audio continues playing
- [ ] No duplicate connections

**Pass Criteria**: Role switching works without breaking audio

---

### ✅ Test 6: Disconnect/Reconnect Recovery
**Setup**: Active space with speaker and listener

**Steps**:
1. Host and listener connected and audio working
2. Simulate network disconnect (disable Wi-Fi for 5 seconds)
3. Re-enable network
4. Wait for reconnection

**Expected Results**:
- [ ] Connection state shows "disconnected" then "connected"
- [ ] Audio resumes automatically
- [ ] Console shows reconnection attempts

**Pass Criteria**: Audio recovers after network interruption

---

### ✅ Test 7: Poor Connection Indicator
**Setup**: Simulate poor network (throttle in DevTools)

**Steps**:
1. Open DevTools → Network → Throttle to "Slow 3G"
2. Host and listener connect
3. Observe connection state

**Expected Results**:
- [ ] "Poor connection" indicator appears after 3 seconds of failed/disconnected state
- [ ] Reconnection attempts are made
- [ ] Audio quality may degrade but connection persists

**Pass Criteria**: Poor connection is detected and indicated

---

### ✅ Test 8: Multiple Listeners
**Setup**: One speaker, multiple listeners

**Steps**:
1. Host creates and starts space
2. Listener 1 joins
3. Listener 2 joins
4. Listener 3 joins
5. Host speaks

**Expected Results**:
- [ ] All listeners hear audio
- [ ] Each listener has separate peer connection
- [ ] No audio mixing issues

**Pass Criteria**: All listeners receive audio simultaneously

---

### ✅ Test 9: Cleanup on Leave
**Setup**: Active space with connections

**Steps**:
1. Host and listener connected
2. Listener clicks "Leave"
3. Check browser console and network tab

**Expected Results**:
- [ ] All peer connections closed
- [ ] Audio tracks stopped
- [ ] No memory leaks (check DevTools Memory)
- [ ] Socket leaves space room

**Pass Criteria**: Clean exit with no lingering connections

---

### ✅ Test 10: Space End Cleanup
**Setup**: Active space with multiple participants

**Steps**:
1. Host creates and starts space
2. Multiple listeners join
3. Host ends space

**Expected Results**:
- [ ] All participants see "Space has ended" message
- [ ] All connections closed
- [ ] All audio tracks stopped
- [ ] Participants redirected to spaces list

**Pass Criteria**: Clean shutdown of all connections

---

## Debugging Tips

### If Listener Doesn't Hear Audio:

1. **Check Console Logs**:
   - Look for `[WebRTC]` prefixed logs
   - Verify `ontrack` event fires
   - Check ICE connection state

2. **Check Audio Element**:
   - Open DevTools → Elements
   - Find `<audio>` elements in body
   - Verify `srcObject` is set
   - Check if `muted` attribute is false

3. **Check Permissions**:
   - Verify microphone permission granted
   - Check browser settings

4. **Check Network**:
   - Verify STUN/TURN servers accessible
   - Check firewall rules
   - Test on same network first

5. **Check Connection State**:
   - Look for `connectionState: "connected"`
   - Look for `iceConnectionState: "connected"`

### If Speaker Audio Not Publishing:

1. **Check Microphone**:
   - Verify `getUserMedia` succeeds
   - Check track `enabled` state
   - Verify track is not muted

2. **Check Peer Connection**:
   - Verify `addTrack` is called
   - Check offer SDP contains `m=audio`
   - Verify transceiver direction is `sendonly`

3. **Check Signaling**:
   - Verify offer/answer exchange completes
   - Check ICE candidates exchanged

---

## Known Issues & Workarounds

1. **Autoplay Blocked**: Some browsers block autoplay. Solution: Click "Enable Audio" button.

2. **Cross-Network Fails**: Without TURN server, connections may only work on same network. Solution: Configure TURN server.

3. **Mobile Browser Limitations**: iOS Safari has strict autoplay policies. Solution: User must interact with page first.

4. **Firewall/NAT Issues**: Some corporate firewalls block WebRTC. Solution: Configure TURN server with TCP fallback.

---

## Performance Benchmarks

- **Connection Time**: < 5 seconds (same network), < 10 seconds (cross-network with TURN)
- **Audio Latency**: < 200ms (same network), < 500ms (cross-network)
- **Memory Usage**: ~5-10MB per peer connection
- **CPU Usage**: < 5% per active connection

---

## Success Criteria

All tests pass with:
- ✅ Audio reliably received by listeners
- ✅ No memory leaks
- ✅ Proper cleanup on leave/end
- ✅ Role switching works
- ✅ Cross-network works (with TURN)
- ✅ Mobile browser support
- ✅ Poor connection detection

