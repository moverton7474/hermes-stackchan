"""Read/write xiaozhi-esp32 "assets" partition images (esp mmap-assets layout, index.json v1).

OFFLINE TOOL ONLY - it never talks to a device.

Layout (little-endian), verified against the StackChan 1.5.1 factory assets partition:
  header   : u32 file_count, u32 checksum, u32 combined_len
  table    : file_count x { char name[32]; u32 size; u32 offset; u16 width; u16 height }
  data     : per file: b"\\x5a\\x5a" + raw bytes   (offset is relative to data start, points at the magic)
  checksum = sum(table + data) & 0xFFFF ; combined_len = len(table + data)

  python pack_assets.py unpack assets.bin outdir/        # writes files + order.txt
  python pack_assets.py pack   outdir/ new_assets.bin    # repacks in order.txt order
  python pack_assets.py verify some_assets.bin           # header/checksum/index.json sanity
"""
import json, os, struct, sys

ENTRY = struct.Struct("<32sIIHH")
PART_SIZE = 0x400000


def parse(blob):
    n, ck, ln = struct.unpack_from("<III", blob, 0)
    base = 12 + n * ENTRY.size
    files = []
    for i in range(n):
        name, size, off, w, h = ENTRY.unpack_from(blob, 12 + i * ENTRY.size)
        p = base + off
        if blob[p:p + 2] != b"\x5a\x5a":
            raise ValueError(f"bad magic for entry {i}")
        files.append((name.rstrip(b"\0").decode(), blob[p + 2:p + 2 + size], w, h))
    calc = sum(blob[12:12 + ln]) & 0xFFFF
    return files, ck, calc, ln


def build(files):
    table, data = bytearray(), bytearray()
    for name, payload, w, h in files:
        nb = name.encode()
        if len(nb) > 32:
            raise ValueError(f"name too long (max 32 bytes): {name}")
        table += ENTRY.pack(nb.ljust(32, b"\0"), len(payload), len(data), w, h)
        data += b"\x5a\x5a" + payload
    combined = bytes(table + data)
    out = struct.pack("<III", len(files), sum(combined) & 0xFFFF, len(combined)) + combined
    if len(out) > PART_SIZE:
        raise ValueError(f"pack {len(out)} bytes exceeds 4MB assets partition")
    return out


def verify(blob):
    files, ck, calc, ln = parse(blob)
    names = {f[0] for f in files}
    idx = json.loads(next(f[1] for f in files if f[0] == "index.json"))
    problems = []
    if ck != calc:
        problems.append(f"checksum header {ck:#06x} != computed {calc:#06x}")
    if idx.get("version") != 1:
        problems.append("index.json version != 1")
    for key in ("srmodels", "text_font"):
        if idx.get(key) and idx[key] not in names:
            problems.append(f"{key} -> {idx[key]} missing")
    for e in idx.get("emoji_collection", []):
        if e["file"] not in names:
            problems.append(f"emoji {e['name']} -> {e['file']} missing")
    for x in idx.get("extra_files", []):
        if x not in names:
            problems.append(f"extra file {x} missing")
    print(f"{len(files)} files, {12 + ln} bytes used of {PART_SIZE}, checksum {ck:#06x} (computed {calc:#06x})")
    print("OK" if not problems else "PROBLEMS:\n  " + "\n  ".join(problems))
    return not problems


def main(argv):
    cmd = argv[1]
    if cmd == "unpack":
        files, *_ = parse(open(argv[2], "rb").read())
        os.makedirs(argv[3], exist_ok=True)
        with open(os.path.join(argv[3], "order.txt"), "w") as o:
            for name, payload, w, h in files:
                open(os.path.join(argv[3], name), "wb").write(payload)
                o.write(f"{name} {w} {h}\n")
        print(f"unpacked {len(files)} files")
    elif cmd == "pack":
        files = []
        for line in open(os.path.join(argv[2], "order.txt")):
            name, w, h = line.split()
            files.append((name, open(os.path.join(argv[2], name), "rb").read(), int(w), int(h)))
        open(argv[3], "wb").write(build(files))
        verify(open(argv[3], "rb").read())
    elif cmd == "verify":
        sys.exit(0 if verify(open(argv[2], "rb").read()) else 1)
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv)
