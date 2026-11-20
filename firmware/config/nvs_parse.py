"""Minimal ESP-IDF NVS (v2) partition parser — read-only, for inspecting StackChan settings.

Usage: python nvs_parse.py <nvs.bin> [--json out.json]
Secrets (keys containing pass/psk/token/secret/key) are masked in printed output; the JSON
export keeps raw values so the partition can be regenerated faithfully (keep it local, gitignored).
"""
import json
import struct
import sys
import zlib

TYPES = {0x01: 'u8', 0x11: 'i8', 0x02: 'u16', 0x12: 'i16', 0x04: 'u32', 0x14: 'i32',
         0x08: 'u64', 0x18: 'i64', 0x21: 'string', 0x41: 'blob_legacy', 0x42: 'blob_data', 0x48: 'blob_index'}
INT_FMT = {'u8': '<B', 'i8': '<b', 'u16': '<H', 'i16': '<h', 'u32': '<I', 'i32': '<i', 'u64': '<Q', 'i64': '<q'}
PAGE = 4096
SECRET_HINTS = ('pass', 'psk', 'token', 'secret', 'key', 'pwd')


def entry_state(bitmap: bytes, idx: int) -> int:
    byte = bitmap[idx // 4]
    return (byte >> ((idx % 4) * 2)) & 0b11  # 3 empty, 2 written, 0 erased


def parse(buf: bytes):
    pages = []
    for p in range(0, len(buf), PAGE):
        page = buf[p:p + PAGE]
        state, seq, version = struct.unpack('<IIB', page[0:9])
        if state == 0xFFFFFFFF:
            continue
        pages.append((seq, p, state, version, page))
    pages.sort()
    namespaces = {0: None}
    items = []  # raw entries in order
    for seq, off, state, version, page in pages:
        bitmap = page[32:64]
        i = 0
        while i < 126:
            st = entry_state(bitmap, i)
            if st != 2:
                i += 1
                continue
            e = page[64 + i * 32: 64 + (i + 1) * 32]
            ns, typ, span, chunk = e[0], e[1], e[2], e[3]
            key = e[8:24].split(b'\0')[0].decode(errors='replace')
            data = e[24:32]
            span = max(span, 1)
            tname = TYPES.get(typ, hex(typ))
            val = None
            if tname in INT_FMT:
                val = struct.unpack(INT_FMT[tname], data[:struct.calcsize(INT_FMT[tname])])[0]
                if ns == 0:
                    namespaces[val] = key
            elif tname in ('string', 'blob_data', 'blob_legacy'):
                size = struct.unpack('<H', data[0:2])[0]
                raw = page[64 + (i + 1) * 32: 64 + (i + span) * 32][:size]
                val = raw
            elif tname == 'blob_index':
                size, chunks, start = struct.unpack('<IBB', data[0:6])
                val = {'size': size, 'chunks': chunks, 'start': start}
            items.append({'ns_idx': ns, 'type': tname, 'key': key, 'chunk': chunk, 'span': span,
                          'value': val, 'page_seq': seq})
            i += span
    # assemble
    out = []
    blobs = {}
    for it in items:
        if it['ns_idx'] == 0:
            continue
        ns = namespaces.get(it['ns_idx'], f"ns#{it['ns_idx']}")
        if it['type'] == 'blob_data':
            blobs.setdefault((ns, it['key']), []).append((it['chunk'], it['value']))
            continue
        if it['type'] == 'blob_index':
            continue
        out.append({'namespace': ns, 'key': it['key'], 'type': it['type'], 'value': it['value']})
    for (ns, key), parts in blobs.items():
        data = b''.join(v for _, v in sorted(parts))
        out.append({'namespace': ns, 'key': key, 'type': 'blob', 'value': data})
    return namespaces, out


def show(v, key):
    secret = any(h in key.lower() for h in SECRET_HINTS)
    if isinstance(v, bytes):
        if secret:
            return f'<masked {len(v)} bytes>'
        txt = v.rstrip(b'\0')
        if all(32 <= c < 127 for c in txt):
            return repr(txt.decode())
        return f'<{len(v)} bytes hex {v[:24].hex()}{"…" if len(v) > 24 else ""}>'
    return '<masked>' if secret else repr(v)


if __name__ == '__main__':
    buf = open(sys.argv[1], 'rb').read()
    nss, entries = parse(buf)
    print('namespaces:', {k: v for k, v in nss.items() if k})
    for e in entries:
        print(f"  {e['namespace']:<12} {e['key']:<16} {e['type']:<8} {show(e['value'], e['key'])}")
    if '--json' in sys.argv:
        path = sys.argv[sys.argv.index('--json') + 1]
        ser = [{**e, 'value': (e['value'].hex() if isinstance(e['value'], bytes) else e['value']),
                'is_bytes': isinstance(e['value'], bytes)} for e in entries]
        json.dump(ser, open(path, 'w'), indent=1)
        print('json ->', path)
