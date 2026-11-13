# Hermes StackChan Build Guide

Complete step-by-step instructions for setting up the StackChan robot as a GVC Hermes voice agent.

## Pre-requisites

### Hardware
- [ ] M5Stack StackChan AI Desktop Robot Kit ($99)
- [ ] USB-C data cable (for initial config)
- [ ] Computer on same WiFi network (runs bridge server)

### Software
- [ ] Node.js 20+ installed
- [ ] Python 3.8+ installed (for NVS flash)
- [ ] `esptool` installed (`pip install esptool`)
- [ ] GVC Hermes account with auth token

## Phase 1: Backup Stock Firmware (5 min)

**DO THIS FIRST before any changes.**

```bash
cd hermes-stackchan/firmware/config

# Connect robot via USB-C
# Find serial port:
#   Windows: Device Manager → Ports → COMx
#   macOS: ls /dev/tty.usb*
#   Linux: ls /dev/ttyUSB*

# Backup everything
./backup_firmware.sh COM3  # Replace with your port
```

Verify backup:
```bash
ls -la backups/*/
# Should see: full_flash.bin (~16MB), nvs.bin, chip_info.txt
```

## Phase 2: Set Up Bridge Server (10 min)

```bash
cd hermes-stackchan/server

# Install dependencies
npm install

# Configure
cp .env.example .env
```

Edit `.env`:
```env
# Your WiFi network's IP for this computer
# Find with: ipconfig (Windows) or ifconfig (macOS/Linux)
BRIDGE_HOST=0.0.0.0

# GVC Hermes auth — get from browser after logging in
# Open DevTools → Application → Cookies → copy session cookie value
HERMES_AUTH_TOKEN=your_session_cookie_here

# Or if using API key:
# HERMES_AUTH_TOKEN=sk-your-api-key
```

Test the server:
```bash
npm run dev

# In another terminal, test OTA endpoint:
curl -X POST http://localhost:8003/xiaozhi/ota/ \
  -H "Content-Type: application/json" \
  -d '{"version": 2, "language": "en-US"}'

# Should return JSON with websocket.url pointing to localhost:8000
```

## Phase 3: Flash Robot NVS (5 min)

```bash
cd hermes-stackchan/firmware/config

# Find your computer's local IP
# Windows: ipconfig | grep "IPv4"
# macOS: ifconfig en0 | grep inet
# Linux: ip addr show | grep "inet "

# Flash NVS to redirect robot to your bridge server
python flash_nvs.py \
  --ssid "YOUR_WIFI_SSID" \
  --password "YOUR_WIFI_PASSWORD" \
  --ota-url "http://YOUR_IP:8003/xiaozhi/ota/" \
  --port COM3
```

## Phase 4: First Boot (2 min)

1. Start the bridge server: `cd server && npm run dev`
2. Power on the robot
3. Watch the bridge server logs — you should see:
   ```
   OTA request from device aa:bb:cc:dd:ee:ff
   Device connected: aa:bb:cc:dd:ee:ff
   Client hello received
   Minting new ephemeral token from Hermes
   OpenAI Realtime connected
   Session established
   ```
4. Say the wake word or press the button
5. Talk to Hermes!

## Phase 5: Verify Tool Integration

Test that Hermes tools work through the robot:

- "What's on my calendar today?" → calendar tool
- "Send a message to the team" → dispatch tool
- "What are my current goals?" → goal management
- "Check the latest news" → research tool

## Troubleshooting

### Robot won't connect to WiFi
- Verify SSID/password in NVS flash
- Check robot is in range of WiFi
- Robot only supports 2.4GHz WiFi (not 5GHz)

### OTA endpoint not reached
- Check firewall allows port 8003
- Verify robot and computer on same network
- Check OTA URL in NVS matches your IP

### WebSocket connection fails
- Check firewall allows port 8000
- Verify bridge server is running
- Check logs for hello timeout

### No audio / garbled audio
- OPUS codec must be properly initialized
- Check sample rates match (16kHz up, 24kHz down)
- Verify frame duration is 60ms

### Hermes token errors
- Check HERMES_AUTH_TOKEN in .env
- Session cookies expire — refresh from browser
- Check voice.visionaryai.marketing is accessible

### Restoring stock firmware
```bash
# Use the backup from Phase 1
esptool.py --port COM3 --baud 921600 write_flash 0 backups/<timestamp>/full_flash.bin
```

## Network Architecture

```
Home WiFi Network
├── Router (192.168.1.1)
├── Milton's Laptop (192.168.1.100)
│   └── Bridge Server
│       ├── OTA: port 8003
│       └── WS:  port 8000
├── StackChan Robot #1 (DHCP)
│   └── Hermes voice agent
└── StackChan Robot #2 (DHCP)
    └── AMIE coach (future)
```

## Files Modified on Robot

Only the NVS partition is changed:
- `wifi:sta.ssid` → Your WiFi SSID
- `wifi:sta.password` → Your WiFi password
- `wifi:ota_url` → Bridge server OTA endpoint
- `websocket:url` → Cleared (set by OTA response)
- `websocket:token` → Cleared

The firmware binary itself is **not modified**. You can restore the original NVS to return to Xiaozhi cloud.
