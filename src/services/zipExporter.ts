/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-Browser Pure TypeScript ZIP Archive Generator
 * Zero-dependency, stream-compliant ZIP packaging for client deliverables.
 */

interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

// Generate standard CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class SimpleZipBuilder {
  private entries: ZipEntry[] = [];

  public addFile(filename: string, content: string | Uint8Array): void {
    const data =
      typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.entries.push({ filename, data });
  }

  public addTextFile(filename: string, content: string): void {
    this.addFile(filename, content);
  }

  public addBinaryFile(filename: string, content: Uint8Array): void {
    this.addFile(filename, content);
  }

  public async addFileFromUrl(filename: string, url: string): Promise<void> {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    this.addFile(filename, new Uint8Array(buf));
  }

  public buildBlob(): Blob {
    const fileRecords: Uint8Array[] = [];
    const centralDirectoryRecords: Uint8Array[] = [];
    let currentOffset = 0;

    for (const entry of this.entries) {
      const nameBytes = new TextEncoder().encode(entry.filename);
      const crc = calculateCrc32(entry.data);
      const size = entry.data.length;

      // 1. Local File Header (30 bytes + name length)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lView = new DataView(localHeader.buffer);
      lView.setUint32(0, 0x04034b50, true); // Local file header signature
      lView.setUint16(4, 20, true);         // Version needed to extract
      lView.setUint16(6, 0, true);          // General purpose bit flag
      lView.setUint16(8, 0, true);          // Compression method (0 = store)
      lView.setUint16(10, 0, true);         // File last mod time
      lView.setUint16(12, 0, true);         // File last mod date
      lView.setUint32(14, crc, true);       // CRC-32
      lView.setUint32(18, size, true);      // Compressed size
      lView.setUint32(22, size, true);      // Uncompressed size
      lView.setUint16(26, nameBytes.length, true); // Filename length
      lView.setUint16(28, 0, true);         // Extra field length
      localHeader.set(nameBytes, 30);

      fileRecords.push(localHeader, entry.data);

      // 2. Central Directory Header (46 bytes + name length)
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true); // Central directory header signature
      cdView.setUint16(4, 20, true);         // Version made by
      cdView.setUint16(6, 20, true);         // Version needed to extract
      cdView.setUint16(8, 0, true);          // General purpose bit flag
      cdView.setUint16(10, 0, true);         // Compression method (0 = store)
      cdView.setUint16(12, 0, true);         // Mod time
      cdView.setUint16(14, 0, true);         // Mod date
      cdView.setUint32(16, crc, true);       // CRC-32
      cdView.setUint32(20, size, true);      // Compressed size
      cdView.setUint32(24, size, true);      // Uncompressed size
      cdView.setUint16(28, nameBytes.length, true); // Filename length
      cdView.setUint16(30, 0, true);         // Extra field length
      cdView.setUint16(32, 0, true);         // File comment length
      cdView.setUint16(34, 0, true);         // Disk number start
      cdView.setUint16(36, 0, true);         // Internal file attributes
      cdView.setUint32(38, 0, true);         // External file attributes
      cdView.setUint32(42, currentOffset, true); // Relative offset of local header
      cdHeader.set(nameBytes, 46);

      centralDirectoryRecords.push(cdHeader);
      currentOffset += localHeader.length + size;
    }

    const cdStartOffset = currentOffset;
    let cdTotalSize = 0;
    for (const cd of centralDirectoryRecords) {
      cdTotalSize += cd.length;
    }

    // 3. End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true);          // Number of this disk
    eocdView.setUint16(6, 0, true);          // Disk where central directory starts
    eocdView.setUint16(8, this.entries.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, this.entries.length, true); // Total number of central directory records
    eocdView.setUint32(12, cdTotalSize, true);        // Size of central directory
    eocdView.setUint32(16, cdStartOffset, true);      // Offset of start of central directory
    eocdView.setUint16(20, 0, true);                  // Comment length

    const allParts: any[] = [...fileRecords, ...centralDirectoryRecords, eocd];
    return new Blob(allParts, {
      type: 'application/zip',
    });
  }

  public buildUint8Array(): Uint8Array {
    const fileRecords: Uint8Array[] = [];
    const centralDirectoryRecords: Uint8Array[] = [];
    let currentOffset = 0;

    for (const entry of this.entries) {
      const nameBytes = new TextEncoder().encode(entry.filename);
      const crc = calculateCrc32(entry.data);
      const size = entry.data.length;

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lView = new DataView(localHeader.buffer);
      lView.setUint32(0, 0x04034b50, true);
      lView.setUint16(4, 20, true);
      lView.setUint16(6, 0, true);
      lView.setUint16(8, 0, true);
      lView.setUint16(10, 0, true);
      lView.setUint16(12, 0, true);
      lView.setUint32(14, crc, true);
      lView.setUint32(18, size, true);
      lView.setUint32(22, size, true);
      lView.setUint16(26, nameBytes.length, true);
      lView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      fileRecords.push(localHeader, entry.data);

      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, size, true);
      cdView.setUint32(24, size, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, currentOffset, true);
      cdHeader.set(nameBytes, 46);

      centralDirectoryRecords.push(cdHeader);
      currentOffset += localHeader.length + size;
    }

    const cdStartOffset = currentOffset;
    let cdTotalSize = 0;
    for (const cd of centralDirectoryRecords) {
      cdTotalSize += cd.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, this.entries.length, true);
    eocdView.setUint16(10, this.entries.length, true);
    eocdView.setUint32(12, cdTotalSize, true);
    eocdView.setUint32(16, cdStartOffset, true);
    eocdView.setUint16(20, 0, true);

    const all = [...fileRecords, ...centralDirectoryRecords, eocd];
    const totalLen = all.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of all) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }
}
