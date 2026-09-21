const encoder = new TextEncoder();
const crcTable = new Uint32Array(256).map((_, n) => { let value = n; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
const crc32 = (bytes, seed = 0xffffffff) => { let value = seed; for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8); return value >>> 0; };
const le16 = (value) => Uint8Array.of(value & 255, value >>> 8 & 255);
const le32 = (value) => Uint8Array.of(value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255);
const le64 = (value) => { let number = BigInt(value); const out = new Uint8Array(8); for (let index = 0; index < 8; index += 1) { out[index] = Number(number & 255n); number >>= 8n; } return out; };
const concat = (...parts) => { const size = parts.reduce((sum, part) => sum + part.length, 0), out = new Uint8Array(size); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };
const asBytes = async (data) => data instanceof Uint8Array ? data : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data instanceof ArrayBuffer ? new Uint8Array(data) : encoder.encode(String(data));
const localHeader = (name) => concat(le32(0x04034b50), le16(20), le16(0), le16(0), le16(0), le16(0), le32(0), le32(0), le32(0), le16(name.length), le16(0), name);
const centralHeader = (item) => concat(le32(0x02014b50), le16(20), le16(20), le16(item.flags || 0), le16(0), le16(0), le16(0), le32(item.crc), le32(item.size), le32(item.size), le16(item.name.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(item.offset), item.name);

export function needsZip64({ size = 0n, offset = 0n, entries = 0 }) { return BigInt(size) >= 0x1_0000_0000n || BigInt(offset) >= 0x1_0000_0000n || entries >= 0xffff; }

/** Creates a standard uncompressed ZIP. Suitable for tests and small fallback exports. */
export async function createZip(entries) {
  const local = [], central = []; let offset = 0;
  if (entries.length >= 0xffff) throw new Error("Fallback ZIP richiede ZIP64: usa il salvataggio streaming del browser.");
  for (const entry of entries) { const name = encoder.encode(entry.name), bytes = await asBytes(entry.data); if (needsZip64({ size: bytes.length, offset })) throw new Error("Fallback ZIP oltre 4 GiB: usa il salvataggio streaming del browser."); const item = { name, size: bytes.length, crc: crc32(bytes) ^ 0xffffffff, offset }; const header = localHeader(name); local.push(header, bytes); central.push(centralHeader(item)); offset += header.length + bytes.length; }
  const directory = concat(...central), end = concat(le32(0x06054b50), le16(0), le16(0), le16(entries.length), le16(entries.length), le32(directory.length), le32(offset), le16(0));
  return new Blob([...local, directory, end], { type: "application/zip" });
}

/** Streams a ZIP64 archive with data descriptors to a user-chosen File System Access handle. */
export async function streamZip(entries, writable) {
  const central = []; let offset = 0n;
  for (const entry of entries) {
    const name = encoder.encode(entry.name); if (name.length > 0xffff) throw new Error("Nome file ZIP troppo lungo"); const extra = concat(le16(0x0001), le16(16), le64(0), le64(0)), header = concat(le32(0x04034b50), le16(45), le16(8), le16(0), le16(0), le16(0), le32(0), le32(0xffffffff), le32(0xffffffff), le16(name.length), le16(extra.length), name, extra);
    await writable.write(header); let size = 0n, crc = 0xffffffff;
    const chunks = entry.data instanceof Blob ? entry.data.stream() : new Blob([await asBytes(entry.data)]).stream();
    for await (const chunk of chunks) { const bytes = new Uint8Array(chunk); crc = crc32(bytes, crc); size += BigInt(bytes.length); await writable.write(bytes); }
    crc = crc ^ 0xffffffff; const descriptor = concat(le32(0x08074b50), le32(crc), le64(size), le64(size)); await writable.write(descriptor); const centralExtra = concat(le16(0x0001), le16(24), le64(size), le64(size), le64(offset)); central.push(concat(le32(0x02014b50), le16(45), le16(45), le16(8), le16(0), le16(0), le16(0), le32(crc), le32(0xffffffff), le32(0xffffffff), le16(name.length), le16(centralExtra.length), le16(0), le16(0), le16(0), le32(0), le32(0xffffffff), name, centralExtra)); offset += BigInt(header.length) + size + BigInt(descriptor.length);
  }
  const directory = concat(...central), directoryOffset = offset, directorySize = BigInt(directory.length), zip64End = concat(le32(0x06064b50), le64(44), le16(45), le16(45), le32(0), le32(0), le64(entries.length), le64(entries.length), le64(directorySize), le64(directoryOffset)), locator = concat(le32(0x07064b50), le32(0), le64(directoryOffset + directorySize), le32(1)), end = concat(le32(0x06054b50), le16(0), le16(0), le16(0xffff), le16(0xffff), le32(0xffffffff), le32(0xffffffff), le16(0)); await writable.write(directory); await writable.write(zip64End); await writable.write(locator); await writable.write(end); await writable.close();
}
