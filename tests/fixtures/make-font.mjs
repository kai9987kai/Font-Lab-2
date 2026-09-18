/**
 * Builds small, synthetic OpenType containers for the font-parsing tests.
 *
 * The fonts are not renderable - they carry no glyf or CFF table - but they
 * are byte-accurate sfnt and WOFF 1 containers with real head, hhea, OS/2,
 * name, fvar and GSUB tables. That is exactly the surface the lab's parser
 * reads, and it keeps the test suite hermetic: no binaries in the repository
 * and no network fetch.
 */

import zlib from 'node:zlib';

const NAME_IDS = {
  1: 'Lab Test',
  2: 'Regular',
  5: 'Version 2.000',
  9: 'Font Lab test suite, Font Lab test suite, Font Lab test suite, Font Lab test suite',
  13: 'Synthetic fixture, not for distribution. Synthetic fixture, not for distribution.',
  16: 'Lab Test',
  17: 'Variable',
  256: 'Weight',
  257: 'Softness',
  258: 'Light',
  259: 'Bold',
  260: 'Soft Bold'
};

export const EXPECTED = {
  family: 'Lab Test',
  unitsPerEm: 1000,
  xHeight: 520,
  capHeight: 700,
  weightClass: 400,
  axes: [
    { tag: 'SOFT', min: 0, def: 0, max: 100, name: 'Softness' },
    { tag: 'wght', min: 100, def: 400, max: 900, name: 'Weight' }
  ],
  instances: [
    { name: 'Light', coords: { wght: 300, SOFT: 0 } },
    { name: 'Bold', coords: { wght: 700, SOFT: 0 } },
    { name: 'Soft Bold', coords: { wght: 700, SOFT: 60 } }
  ],
  features: ['calt', 'kern', 'liga', 'ss01', 'tnum']
};

const tag = text => {
  const bytes = Buffer.alloc(4, 0x20);
  bytes.write(text.slice(0, 4), 'latin1');
  return bytes;
};

const fixed = value => {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32BE(Math.round(value * 65536));
  return bytes;
};

function headTable() {
  const table = Buffer.alloc(54);
  table.writeUInt32BE(0x00010000, 0); // version
  table.writeUInt32BE(0x5f0f3cf5, 12); // magic number
  table.writeUInt16BE(EXPECTED.unitsPerEm, 18);
  table.writeInt16BE(0, 50); // indexToLocFormat
  return table;
}

function hheaTable() {
  const table = Buffer.alloc(36);
  table.writeUInt32BE(0x00010000, 0);
  table.writeInt16BE(880, 4); // ascender
  table.writeInt16BE(-220, 6); // descender
  return table;
}

function os2Table() {
  const table = Buffer.alloc(96);
  table.writeUInt16BE(2, 0); // version 2 exposes sxHeight and sCapHeight
  table.writeInt16BE(500, 2); // xAvgCharWidth
  table.writeUInt16BE(EXPECTED.weightClass, 4);
  table.writeUInt16BE(5, 6); // usWidthClass
  table.write('LABX', 58, 'latin1'); // achVendID
  table.writeInt16BE(880, 68); // sTypoAscender
  table.writeInt16BE(-220, 70); // sTypoDescender
  table.writeInt16BE(0, 72); // sTypoLineGap
  table.writeUInt16BE(1000, 74); // usWinAscent
  table.writeUInt16BE(250, 76); // usWinDescent
  table.writeInt16BE(EXPECTED.xHeight, 86);
  table.writeInt16BE(EXPECTED.capHeight, 88);
  return table;
}

function nameTable() {
  const ids = Object.keys(NAME_IDS).map(Number).sort((a, b) => a - b);
  const strings = [];
  let stringLength = 0;
  ids.forEach(id => {
    const encoded = Buffer.from(NAME_IDS[id], 'utf16le').swap16();
    strings.push({ id, encoded, offset: stringLength });
    stringLength += encoded.length;
  });
  const recordsLength = ids.length * 12;
  const header = Buffer.alloc(6 + recordsLength);
  header.writeUInt16BE(0, 0); // format
  header.writeUInt16BE(ids.length, 2);
  header.writeUInt16BE(6 + recordsLength, 4); // stringOffset
  strings.forEach((entry, index) => {
    const base = 6 + index * 12;
    header.writeUInt16BE(3, base); // platformID: Windows
    header.writeUInt16BE(1, base + 2); // encodingID: UCS-2
    header.writeUInt16BE(0x0409, base + 4); // languageID: en-US
    header.writeUInt16BE(entry.id, base + 6);
    header.writeUInt16BE(entry.encoded.length, base + 8);
    header.writeUInt16BE(entry.offset, base + 10);
  });
  return Buffer.concat([header, ...strings.map(s => s.encoded)]);
}

function fvarTable() {
  const axes = EXPECTED.axes;
  const instances = EXPECTED.instances;
  const axisNameIds = { Weight: 256, Softness: 257 };
  const instanceNameIds = { Light: 258, Bold: 259, 'Soft Bold': 260 };
  const axisSize = 20;
  const instanceSize = 4 + axes.length * 4;

  const header = Buffer.alloc(16);
  header.writeUInt16BE(1, 0); // majorVersion
  header.writeUInt16BE(0, 2); // minorVersion
  header.writeUInt16BE(16, 4); // axesArrayOffset
  header.writeUInt16BE(2, 6); // reserved
  header.writeUInt16BE(axes.length, 8);
  header.writeUInt16BE(axisSize, 10);
  header.writeUInt16BE(instances.length, 12);
  header.writeUInt16BE(instanceSize, 14);

  const axisRecords = axes.map(axis => {
    const record = Buffer.alloc(axisSize);
    tag(axis.tag).copy(record, 0);
    fixed(axis.min).copy(record, 4);
    fixed(axis.def).copy(record, 8);
    fixed(axis.max).copy(record, 12);
    record.writeUInt16BE(0, 16); // flags
    record.writeUInt16BE(axisNameIds[axis.name], 18);
    return record;
  });

  const instanceRecords = instances.map(instance => {
    const record = Buffer.alloc(instanceSize);
    record.writeUInt16BE(instanceNameIds[instance.name], 0);
    record.writeUInt16BE(0, 2); // flags
    axes.forEach((axis, index) => {
      fixed(instance.coords[axis.tag] ?? axis.def).copy(record, 4 + index * 4);
    });
    return record;
  });

  return Buffer.concat([header, ...axisRecords, ...instanceRecords]);
}

function gsubTable() {
  const features = EXPECTED.features;
  const header = Buffer.alloc(10);
  header.writeUInt16BE(1, 0); // majorVersion
  header.writeUInt16BE(0, 2); // minorVersion
  header.writeUInt16BE(10, 4); // scriptListOffset
  header.writeUInt16BE(12, 6); // featureListOffset
  header.writeUInt16BE(12 + 2 + features.length * 6, 8); // lookupListOffset

  const scriptList = Buffer.alloc(2); // scriptCount 0
  const featureList = Buffer.alloc(2 + features.length * 6);
  featureList.writeUInt16BE(features.length, 0);
  features.forEach((feature, index) => {
    const base = 2 + index * 6;
    tag(feature).copy(featureList, base);
    featureList.writeUInt16BE(0, base + 4); // featureOffset, unused by the parser
  });
  const lookupList = Buffer.alloc(2); // lookupCount 0
  return Buffer.concat([header, scriptList, featureList, lookupList]);
}

function tables() {
  return [
    ['GSUB', gsubTable()],
    ['OS/2', os2Table()],
    ['fvar', fvarTable()],
    ['head', headTable()],
    ['hhea', hheaTable()],
    ['name', nameTable()]
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

const pad4 = n => (n + 3) & ~3;

/** A bare sfnt (TrueType-flavoured) container. */
export function makeTTF() {
  const entries = tables();
  const numTables = entries.length;
  const directoryLength = 12 + numTables * 16;
  let offset = pad4(directoryLength);

  const directory = Buffer.alloc(directoryLength);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(numTables, 4);
  directory.writeUInt16BE(16 * 2 ** Math.floor(Math.log2(numTables)), 6); // searchRange
  directory.writeUInt16BE(Math.floor(Math.log2(numTables)), 8);
  directory.writeUInt16BE(numTables * 16 - directory.readUInt16BE(6), 10);

  const body = [];
  entries.forEach(([name, table], index) => {
    const base = 12 + index * 16;
    tag(name).copy(directory, base);
    directory.writeUInt32BE(0, base + 4); // checksum, unused by the parser
    directory.writeUInt32BE(offset, base + 8);
    directory.writeUInt32BE(table.length, base + 12);
    const padded = Buffer.alloc(pad4(table.length));
    table.copy(padded);
    body.push(padded);
    offset += padded.length;
  });

  return Buffer.concat([directory, Buffer.alloc(pad4(directoryLength) - directoryLength), ...body]);
}

/** The same font wrapped in a WOFF 1 container with zlib-compressed tables. */
export function makeWOFF() {
  const entries = tables();
  const numTables = entries.length;
  const headerLength = 44 + numTables * 20;
  const sfnt = makeTTF();

  const directory = Buffer.alloc(headerLength);
  directory.writeUInt32BE(0x774f4646, 0); // 'wOFF'
  directory.writeUInt32BE(0x00010000, 4); // flavor
  directory.writeUInt16BE(numTables, 12);
  directory.writeUInt32BE(sfnt.length, 16); // totalSfntSize

  let offset = headerLength;
  const body = [];
  entries.forEach(([name, table], index) => {
    const compressed = zlib.deflateSync(table, { level: 9 });
    const stored = compressed.length < table.length ? compressed : table;
    const base = 44 + index * 20;
    tag(name).copy(directory, base);
    directory.writeUInt32BE(offset, base + 4);
    directory.writeUInt32BE(stored.length, base + 8);
    directory.writeUInt32BE(table.length, base + 12);
    directory.writeUInt32BE(0, base + 16); // origChecksum
    const padded = Buffer.alloc(pad4(stored.length));
    stored.copy(padded);
    body.push(padded);
    offset += padded.length;
  });

  const woff = Buffer.concat([directory, ...body]);
  woff.writeUInt32BE(woff.length, 8); // length
  return woff;
}

/** True when at least one table in the WOFF really is compressed. */
export function woffHasCompressedTable() {
  return tables().some(([, table]) => zlib.deflateSync(table, { level: 9 }).length < table.length);
}
