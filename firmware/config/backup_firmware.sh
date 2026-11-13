#!/bin/bash
# Backup stock StackChan firmware before any modifications
#
# Usage: ./backup_firmware.sh [serial_port]
# Example: ./backup_firmware.sh /dev/ttyUSB0
#          ./backup_firmware.sh COM3

set -euo pipefail

PORT="${1:-}"
BACKUP_DIR="$(dirname "$0")/../../backups/$(date +%Y%m%d_%H%M%S)"

if [ -z "$PORT" ]; then
  echo "Usage: $0 <serial_port>"
  echo "  macOS:   $0 /dev/tty.usbserial-*"
  echo "  Linux:   $0 /dev/ttyUSB0"
  echo "  Windows: $0 COM3"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "=== StackChan Firmware Backup ==="
echo "Port: $PORT"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Read flash ID for chip info
echo "1. Reading chip info..."
esptool.py --port "$PORT" flash_id | tee "$BACKUP_DIR/chip_info.txt"

# Backup full flash (16MB for ESP32-S3)
echo ""
echo "2. Reading full flash (16MB, this takes a few minutes)..."
esptool.py --port "$PORT" --baud 921600 read_flash 0 0x1000000 "$BACKUP_DIR/full_flash.bin"

# Backup NVS partition specifically
echo ""
echo "3. Reading NVS partition..."
esptool.py --port "$PORT" --baud 921600 read_flash 0x9000 0x6000 "$BACKUP_DIR/nvs.bin"

echo ""
echo "=== Backup Complete ==="
echo "Files:"
ls -la "$BACKUP_DIR/"
echo ""
echo "To restore: esptool.py --port $PORT --baud 921600 write_flash 0 $BACKUP_DIR/full_flash.bin"
