#!/usr/bin/env python3
"""
Flash NVS partition to redirect StackChan from Xiaozhi cloud to local bridge server.

This modifies the robot's NVS (Non-Volatile Storage) to:
1. Set WiFi credentials
2. Set OTA URL to point at the local bridge server
3. Clear any existing Xiaozhi tokens

Requires: esptool (pip install esptool)
Usage: python flash_nvs.py --ssid "MyWiFi" --password "MyPass" --ota-url "http://192.168.1.100:8003/xiaozhi/ota/"
"""

# ============================================================================
# DO NOT USE ON THE M5STACK STACKCHAN (CoreS3, stock xiaozhi firmware) — 2026-11-19
# Verified from a full flash backup (backups/stackchan_20261119_203320):
#   * NVS partition is 0x4000 (16 KB) at 0x9000 — this script assumed 0x6000, which
#     would overwrite otadata (0xd000) and phy_init and can break boot selection.
#   * NVS holds factory data this script would ERASE: namespace "servo"
#     (zero_pos_1, zero_pos_2 = head servo calibration) and "board" (uuid).
# Use the robot's own Wi-Fi setup portal instead (Advanced -> OTA URL):
#   http://<bridge-ip>:12802/xiaozhi/ota/   (Tutor Buddy)   — see BUILD-GUIDE.md
# ============================================================================
import sys as _sys
if '--i-have-read-the-warning' not in _sys.argv:
    _sys.exit("flash_nvs.py is disabled for the StackChan: it would erase servo calibration. See header.")
_sys.argv.remove('--i-have-read-the-warning')

import argparse
import csv
import io
import subprocess
import sys
import tempfile
import os

NVS_TEMPLATE = """key,type,encoding,value
wifi,namespace,,
sta.ssid,data,string,{ssid}
sta.password,data,string,{password}
ota,namespace,,
ota_url,data,string,{ota_url}
websocket,namespace,,
url,data,string,
token,data,string,
"""

def generate_nvs_csv(ssid: str, password: str, ota_url: str) -> str:
    """Generate NVS partition CSV content."""
    return NVS_TEMPLATE.format(
        ssid=ssid,
        password=password,
        ota_url=ota_url,
    )

def find_esptool() -> str:
    """Find esptool in PATH."""
    for cmd in ['esptool.py', 'esptool']:
        try:
            subprocess.run([cmd, 'version'], capture_output=True, check=True)
            return cmd
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    raise RuntimeError(
        'esptool not found. Install with: pip install esptool'
    )

def main():
    parser = argparse.ArgumentParser(
        description='Flash NVS config to redirect StackChan to local bridge server'
    )
    parser.add_argument('--ssid', required=True, help='WiFi SSID')
    parser.add_argument('--password', required=True, help='WiFi password')
    parser.add_argument('--ota-url', required=True,
                       help='Bridge server OTA URL (e.g., http://192.168.1.100:8003/xiaozhi/ota/)')
    parser.add_argument('--port', default=None,
                       help='Serial port (auto-detect if not specified)')
    parser.add_argument('--baud', type=int, default=921600,
                       help='Baud rate (default: 921600)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Generate NVS CSV without flashing')
    args = parser.parse_args()

    csv_content = generate_nvs_csv(args.ssid, args.password, args.ota_url)

    if args.dry_run:
        print('Generated NVS CSV:')
        print(csv_content)
        return

    print(f'WiFi SSID: {args.ssid}')
    print(f'OTA URL: {args.ota_url}')
    print()

    # Write CSV to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        csv_path = f.name

    try:
        # Generate NVS binary from CSV using nvs_partition_gen.py
        # (ships with ESP-IDF, or use the standalone tool)
        bin_path = csv_path.replace('.csv', '.bin')

        print('NOTE: NVS binary generation requires ESP-IDF nvs_partition_gen.py')
        print('Install ESP-IDF or use the standalone NVS tool:')
        print('  pip install nvs-partition-gen')
        print()
        print(f'Manual steps:')
        print(f'  1. python nvs_partition_gen.py generate {csv_path} {bin_path} 0x6000')
        print(f'  2. esptool.py --port COMx write_flash 0x9000 {bin_path}')
        print()
        print(f'NVS CSV saved to: {csv_path}')

    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
