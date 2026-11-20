"""Append ONE string key to an ESP-IDF NVS partition image without touching existing entries.

Usage:
  python nvs_append_string.py <in.bin> <out.bin> <namespace> <key> <value>

Safety:
  * Self-tests the CRC routine against every existing written entry first (aborts on mismatch).
  * Refuses if the key already exists, if the namespace doesn't exist, or if the active page lacks room.
  * Only changes: the chosen empty entry slots + their 2-bit state in the page bitmap (11 -> 10).
"""
import struct
import sys
import zlib

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from nvs_parse import parse  # noqa: E402

PAGE = 4096
ACTIVE = 0xFFFFFFFE


def crc32_le(data: bytes) -> int:
    # ESP-IDF esp_rom_crc32_le(0xffffffff, buf, len): ROM inverts in/out, so it equals
    # zlib's CRC-32 seeded with 0xffffffff. Verified by the self-test against real entries.
    return zlib.crc32(data, 0xFFFFFFFF) & 0xFFFFFFFF


def entry_crc(e: bytes) -> int:
    return crc32_le(e[0:4] + e[8:32])


def state(bitmap, i):
    return (bitmap[i // 4] >> ((i % 4) * 2)) & 3


def main(src, dst, ns_name, key, value):
    buf = bytearray(open(src, 'rb').read())
    namespaces, entries = parse(bytes(buf))
    ns_idx = {v: k for k, v in namespaces.items() if v}.get(ns_name)
    if ns_idx is None:
        sys.exit(f'namespace {ns_name!r} not found: {namespaces}')
    if any(e['namespace'] == ns_name and e['key'] == key for e in entries):
        sys.exit(f'{ns_name}/{key} already exists — refusing (would need erase semantics)')

    # 1) CRC self-test over every written entry header
    checked = 0
    pages = []
    for p in range(0, len(buf), PAGE):
        st, seq = struct.unpack('<II', buf[p:p + 8])
        if st == 0xFFFFFFFF:
            continue
        pages.append((seq, p, st))
        bm = buf[p + 32:p + 64]
        i = 0
        while i < 126:
            if state(bm, i) != 2:
                i += 1
                continue
            e = bytes(buf[p + 64 + i * 32: p + 64 + (i + 1) * 32])
            stored = struct.unpack('<I', e[4:8])[0]
            if entry_crc(e) != stored:
                sys.exit(f'CRC self-test FAILED at page {p:#x} entry {i} key {e[8:24]!r}: '
                         f'calc {entry_crc(e):#010x} stored {stored:#010x}')
            checked += 1
            i += max(e[2], 1)
    print(f'CRC self-test OK on {checked} existing entries')

    # 2) find the ACTIVE page with room
    data = value.encode() + b'\0'
    span = 1 + (len(data) + 31) // 32
    active = [x for x in sorted(pages) if x[2] == ACTIVE]
    if not active:
        sys.exit('no ACTIVE page')
    _, p, _ = active[-1]
    bm = buf[p + 32:p + 64]
    used_hi = max([i for i in range(126) if state(bm, i) != 3] + [-1])
    first = used_hi + 1
    if first + span > 126:
        sys.exit('active page has no room — refusing (page rotation not implemented)')
    if any(state(bm, i) != 3 for i in range(first, first + span)):
        sys.exit('target slots not empty')

    # 3) build entry
    hdr = bytearray(32)
    hdr[0] = ns_idx
    hdr[1] = 0x21  # string
    hdr[2] = span
    hdr[3] = 0xFF  # chunk index (unused for strings)
    k = key.encode()
    if len(k) > 15:
        sys.exit('key too long')
    hdr[8:24] = k + b'\0' * (16 - len(k))
    hdr[24:32] = struct.pack('<HHI', len(data), 0xFFFF, crc32_le(data))
    struct.pack_into('<I', hdr, 4, entry_crc(bytes(hdr)))
    body = data + b'\xff' * ((span - 1) * 32 - len(data))
    off = p + 64 + first * 32
    buf[off:off + 32] = hdr
    buf[off + 32: off + 32 * span] = body
    for i in range(first, first + span):  # 11 -> 10 (written): clear the low bit of the pair
        buf[p + 32 + i // 4] &= ~(1 << ((i % 4) * 2)) & 0xFF
    open(dst, 'wb').write(bytes(buf))
    print(f'appended {ns_name}/{key} ({len(data)} bytes, span {span}) at page {p:#x} slot {first}')


if __name__ == '__main__':
    if len(sys.argv) != 6:
        sys.exit(__doc__)
    main(*sys.argv[1:])
