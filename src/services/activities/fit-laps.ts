/**
 * Minimal FIT decoder that reads `lap` messages and nothing else.
 *
 * Why this exists: `icu_intervals` is Intervals.icu's *interval analysis* — a
 * derived, editable segmentation that usually tracks the device's laps but is
 * free to diverge from them. When it diverges, a planned-vs-actual review is
 * silently wrong about which reps were delivered (see
 * `docs/adr/0006-device-laps-as-the-execution-record.md`). The laps the head
 * unit wrote are the only faithful record of what the athlete actually marked,
 * and the original upload is the only place the API exposes them.
 *
 * Deliberately partial: it walks the record stream well enough to find global
 * message 19 and skips everything else by declared field size. It never throws
 * — a file it cannot make sense of yields `null`, and the caller falls back to
 * the derived intervals rather than losing the review entirely.
 */

/** One lap as the recording device wrote it. */
export interface FitLap {
  /** Position in the file, 0-based. */
  index: number;
  /** Seconds from the first lap's start. */
  startTimeSeconds: number;
  /** `total_elapsed_time` — wall-clock, matching how Intervals.icu reports laps. */
  durationSeconds: number;
  /** `total_timer_time` — excludes paused time. */
  timerSeconds?: number;
  averageWatts?: number;
  maxWatts?: number;
  averageHeartrate?: number;
  averageCadence?: number;
}

const LAP_GLOBAL_MESSAGE = 19;

// Lap field numbers from the FIT global profile.
const FIELD_START_TIME = 2;
const FIELD_TOTAL_ELAPSED_TIME = 7;
const FIELD_TOTAL_TIMER_TIME = 8;
const FIELD_AVG_HEART_RATE = 15;
const FIELD_AVG_CADENCE = 17;
const FIELD_AVG_POWER = 19;
const FIELD_MAX_POWER = 20;

/** Size in bytes of each FIT base type, indexed by the base type's low 5 bits. */
const BASE_TYPE_SIZES = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8];

/**
 * The sentinel each base type uses for "not recorded". A field carrying its
 * invalid value must be reported absent, not as a plausible-looking number:
 * an unrecorded `avg_power` decodes to 65535 W otherwise.
 */
const BASE_TYPE_INVALID = [
  0xff, 0x7f, 0xff, 0x7fff, 0xffff, 0x7fffffff, 0xffffffff, 0x00, 0xffffffff,
  0xffffffffffffffff, 0x00, 0x0000, 0x00000000, 0xff, 0x7fffffffffffffff,
  0xffffffffffffffff, 0x0000000000000000,
];

interface FieldDefinition {
  fieldNumber: number;
  size: number;
  baseType: number;
}

interface MessageDefinition {
  globalMessageNumber: number;
  littleEndian: boolean;
  fields: FieldDefinition[];
  /** Total bytes of developer fields appended to each data message. */
  developerBytes: number;
}

/**
 * Decode the `lap` messages from a raw FIT file.
 *
 * Returns `null` when the bytes are not a FIT file or the record stream cannot
 * be walked, and an empty array when the file is valid but carries no laps.
 */
export function decodeFitLaps(bytes: Uint8Array): FitLap[] | null {
  try {
    return decode(bytes);
  } catch {
    return null;
  }
}

function decode(bytes: Uint8Array): FitLap[] | null {
  if (bytes.length < 14) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const headerSize = bytes[0];
  if (headerSize !== 12 && headerSize !== 14) return null;
  // ".FIT" magic sits at offset 8 in both header lengths.
  if (
    bytes[8] !== 0x2e ||
    bytes[9] !== 0x46 ||
    bytes[10] !== 0x49 ||
    bytes[11] !== 0x54
  ) {
    return null;
  }

  const dataSize = view.getUint32(4, true);
  const end = Math.min(bytes.length, headerSize + dataSize);

  const definitions = new Map<number, MessageDefinition>();
  const raw: Array<Map<number, number>> = [];

  let offset = headerSize;
  while (offset < end) {
    const header = bytes[offset];
    offset += 1;

    // Compressed-timestamp header: a data message whose local type lives in
    // bits 5-6. No definition can arrive this way.
    if (header & 0x80) {
      const localType = (header >> 5) & 0x03;
      const def = definitions.get(localType);
      if (!def) return null;
      offset = readDataMessage(view, bytes, offset, def, raw);
      continue;
    }

    const localType = header & 0x0f;
    const isDefinition = (header & 0x40) !== 0;
    const hasDeveloperFields = (header & 0x20) !== 0;

    if (isDefinition) {
      const parsed = readDefinition(view, bytes, offset, hasDeveloperFields);
      if (!parsed) return null;
      definitions.set(localType, parsed.definition);
      offset = parsed.offset;
      continue;
    }

    const def = definitions.get(localType);
    if (!def) return null;
    offset = readDataMessage(view, bytes, offset, def, raw);
  }

  return toLaps(raw);
}

function readDefinition(
  view: DataView,
  bytes: Uint8Array,
  start: number,
  hasDeveloperFields: boolean
): { definition: MessageDefinition; offset: number } | null {
  let offset = start;
  // reserved(1) is skipped; architecture(1) selects endianness for this message.
  if (offset + 5 > bytes.length) return null;
  const littleEndian = bytes[offset + 1] === 0;
  const globalMessageNumber = view.getUint16(offset + 2, littleEndian);
  const fieldCount = bytes[offset + 4];
  offset += 5;

  const fields: FieldDefinition[] = [];
  for (let i = 0; i < fieldCount; i++) {
    if (offset + 3 > bytes.length) return null;
    fields.push({
      fieldNumber: bytes[offset],
      size: bytes[offset + 1],
      baseType: bytes[offset + 2],
    });
    offset += 3;
  }

  let developerBytes = 0;
  if (hasDeveloperFields) {
    if (offset + 1 > bytes.length) return null;
    const devCount = bytes[offset];
    offset += 1;
    for (let i = 0; i < devCount; i++) {
      if (offset + 3 > bytes.length) return null;
      developerBytes += bytes[offset + 1];
      offset += 3;
    }
  }

  return {
    definition: {
      globalMessageNumber,
      littleEndian,
      fields,
      developerBytes,
    },
    offset,
  };
}

/**
 * Walk one data message, collecting field values only when it is a lap.
 * Every message must be walked regardless, because field sizes are what
 * advance the cursor to the next record.
 */
function readDataMessage(
  view: DataView,
  bytes: Uint8Array,
  start: number,
  def: MessageDefinition,
  out: Array<Map<number, number>>
): number {
  let offset = start;
  const wanted = def.globalMessageNumber === LAP_GLOBAL_MESSAGE;
  const values = wanted ? new Map<number, number>() : null;

  for (const field of def.fields) {
    if (values && offset + field.size <= bytes.length) {
      const value = readValue(view, offset, field, def.littleEndian);
      if (value !== null) values.set(field.fieldNumber, value);
    }
    offset += field.size;
  }
  offset += def.developerBytes;

  if (values) out.push(values);
  return offset;
}

/**
 * Read a single field. Arrays (declared size larger than the base type) are
 * read as their first element — no lap field this decoder reads is an array,
 * and the cursor advances by the declared size regardless.
 */
function readValue(
  view: DataView,
  offset: number,
  field: FieldDefinition,
  littleEndian: boolean
): number | null {
  const type = field.baseType & 0x1f;
  const size = BASE_TYPE_SIZES[type];
  if (size === undefined || field.size < size) return null;

  let value: number;
  switch (type) {
    case 0: // enum
    case 2: // uint8
    case 10: // uint8z
    case 13: // byte
      value = view.getUint8(offset);
      break;
    case 1: // sint8
      value = view.getInt8(offset);
      break;
    case 3: // sint16
      value = view.getInt16(offset, littleEndian);
      break;
    case 4: // uint16
    case 11: // uint16z
      value = view.getUint16(offset, littleEndian);
      break;
    case 5: // sint32
      value = view.getInt32(offset, littleEndian);
      break;
    case 6: // uint32
    case 12: // uint32z
      value = view.getUint32(offset, littleEndian);
      break;
    case 8: // float32
      value = view.getFloat32(offset, littleEndian);
      break;
    case 9: // float64
      value = view.getFloat64(offset, littleEndian);
      break;
    default:
      // Strings and 64-bit types are never read by this decoder.
      return null;
  }

  if (!Number.isFinite(value)) return null;
  if (value === BASE_TYPE_INVALID[type]) return null;
  return value;
}

/**
 * Turn raw field maps into laps, anchored so `startTimeSeconds` is measured
 * from the first lap rather than from the FIT epoch.
 */
function toLaps(raw: Array<Map<number, number>>): FitLap[] {
  const withDuration = raw.filter((m) => {
    const elapsed = m.get(FIELD_TOTAL_ELAPSED_TIME);
    return elapsed !== undefined && elapsed > 0;
  });
  if (withDuration.length === 0) return [];

  const anchor = withDuration[0].get(FIELD_START_TIME);

  return withDuration.map((m, index) => {
    const start = m.get(FIELD_START_TIME);
    const lap: FitLap = {
      index,
      startTimeSeconds:
        start !== undefined && anchor !== undefined ? start - anchor : 0,
      durationSeconds: round(m.get(FIELD_TOTAL_ELAPSED_TIME)! / 1000),
    };

    const timer = m.get(FIELD_TOTAL_TIMER_TIME);
    if (timer !== undefined) lap.timerSeconds = round(timer / 1000);

    const avgPower = m.get(FIELD_AVG_POWER);
    if (avgPower !== undefined) lap.averageWatts = avgPower;

    const maxPower = m.get(FIELD_MAX_POWER);
    if (maxPower !== undefined) lap.maxWatts = maxPower;

    const hr = m.get(FIELD_AVG_HEART_RATE);
    if (hr !== undefined) lap.averageHeartrate = hr;

    const cadence = m.get(FIELD_AVG_CADENCE);
    if (cadence !== undefined) lap.averageCadence = cadence;

    return lap;
  });
}

function round(n: number): number {
  return Math.round(n);
}
