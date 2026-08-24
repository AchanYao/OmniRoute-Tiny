import * as http2 from "node:http2";
import * as zlib from "node:zlib";
import { decodeVarint, WT_LEN, WT_VARINT } from "../utils/cursorAgentProtobuf/wire.ts";
const CURSOR_VARIANT_SUFFIX_REGEX =
  /^(.+?)-(extra-high|none|minimal|low|medium|high|xhigh|max)(-fast)?$/;

function cleanCursorDisplayName(name: string, baseId: string): string {
  if (!name) return baseId;
  const cleaned = name
    .replace(/\s+(Minimal|Low|Medium|High|Extra High|XHigh|Max)\b/gi, "")
    .replace(/\s+Fast\b/gi, "")
    .trim();
  return cleaned || baseId;
}

/**
 * Collapse model variants:
 * Group raw models by base ID (stripping effort/thinking/fast suffixes), create primary
 * collapsed base model entries at the top of the list, followed by raw variant models.
 */
export function collapseCursorUsableModels(rawModels: CursorUsableModel[]): CursorUsableModel[] {
  if (!rawModels || rawModels.length === 0) return [];

  const rawMap = new Map<string, CursorUsableModel>();
  const baseGroups = new Map<string, CursorUsableModel[]>();

  for (const model of rawModels) {
    if (!model || !model.id) continue;
    rawMap.set(model.id, model);

    const match = CURSOR_VARIANT_SUFFIX_REGEX.exec(model.id);
    const baseId = match ? match[1] : model.id;

    const group = baseGroups.get(baseId);
    if (group) {
      group.push(model);
    } else {
      baseGroups.set(baseId, [model]);
    }
  }

  const result: CursorUsableModel[] = [];
  const addedIds = new Set<string>();

  for (const [baseId, group] of baseGroups.entries()) {
    let baseModel: CursorUsableModel;
    if (rawMap.has(baseId)) {
      baseModel = rawMap.get(baseId)!;
    } else {
      const sampleName = group[0]?.name || baseId;
      baseModel = {
        id: baseId,
        name: cleanCursorDisplayName(sampleName, baseId),
        owned_by: "cursor",
      };
    }

    if (!addedIds.has(baseModel.id)) {
      addedIds.add(baseModel.id);
      result.push(baseModel);
    }
  }

  for (const model of rawModels) {
    if (!addedIds.has(model.id)) {
      addedIds.add(model.id);
      result.push(model);
    }
  }

  return result;
}
export type CursorUsableModel = {
  id: string;
  name: string;
  owned_by: "cursor";
};

const CURSOR_GET_USABLE_MODELS_PATH = "/agent.v1.AgentService/GetUsableModels";
const CURSOR_DEFAULT_BASE_URL = "https://api2.cursor.sh";
const CURSOR_DEFAULT_CLIENT_VERSION = "cli-2026.02.13-41ac335";

/**
 * Decode a ModelDetails protobuf message (field 1 of GetUsableModelsResponse).
 * Field 1: string model_id
 * Field 2: string display_name
 * Field 3: string display_name_short
 * Field 4: string display_model_id
 */
function decodeModelDetails(buf: Buffer): CursorUsableModel | null {
  let pos = 0;
  let modelId = "";
  let displayName = "";

  while (pos < buf.length) {
    const [tag, nextPos] = decodeVarint(buf, pos);
    pos = nextPos;
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 0x07n);

    if (wireType === WT_LEN) {
      const [len, lenPos] = decodeVarint(buf, pos);
      const strLen = Number(len);
      const strBytes = buf.subarray(lenPos, lenPos + strLen);
      pos = lenPos + strLen;

      if (fieldNumber === 1 && !modelId) {
        modelId = strBytes.toString("utf8");
      } else if (fieldNumber === 2 && !displayName) {
        displayName = strBytes.toString("utf8");
      }
    } else if (wireType === WT_VARINT) {
      const [, nextPos] = decodeVarint(buf, pos);
      pos = nextPos;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }

  if (!modelId) return null;
  return {
    id: modelId,
    name: displayName || modelId,
    owned_by: "cursor",
  };
}

/**
 * Decode a GetUsableModelsResponse protobuf message.
 * Field 1 (repeated length-delimited): ModelDetails
 */
export function decodeGetUsableModelsResponse(payload: Buffer): CursorUsableModel[] {
  if (!payload || payload.length === 0) return [];

  // Connect-RPC unary frame header: 1-byte flag + 4-byte big-endian length
  let buf = payload;
  if (buf.length > 5 && (buf[0] === 0x00 || buf[0] === 0x01)) {
    const isCompressed = (buf[0] & 0x01) !== 0;
    const frameLen = buf.readUInt32BE(1);
    if (buf.length >= 5 + frameLen) {
      buf = buf.subarray(5, 5 + frameLen);
      if (isCompressed) {
        try {
          buf = zlib.gunzipSync(buf);
        } catch {
          return [];
        }
      }
    }
  }

  const models: CursorUsableModel[] = [];
  const seenIds = new Set<string>();
  let pos = 0;

  while (pos < buf.length) {
    const [tag, nextPos] = decodeVarint(buf, pos);
    pos = nextPos;
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 0x07n);

    if (wireType === WT_LEN) {
      const [len, lenPos] = decodeVarint(buf, pos);
      const msgLen = Number(len);
      const msgBytes = buf.subarray(lenPos, lenPos + msgLen);
      pos = lenPos + msgLen;

      if (fieldNumber === 1) {
        const model = decodeModelDetails(msgBytes);
        if (model && model.id && !seenIds.has(model.id)) {
          seenIds.add(model.id);
          models.push(model);
        }
      }
    } else if (wireType === WT_VARINT) {
      const [, nextPos] = decodeVarint(buf, pos);
      pos = nextPos;
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }

  return collapseCursorUsableModels(models);
}

/**
 * Fetch usable models dynamically from Cursor's GetUsableModels RPC (omp mode).
 * Returns array of models, or null on error.
 */
export async function fetchCursorUsableModels(options: {
  accessToken: string;
  baseUrl?: string;
  clientVersion?: string;
  timeoutMs?: number;
}): Promise<CursorUsableModel[] | null> {
  const accessToken = options.accessToken?.trim();
  if (!accessToken) return null;

  const baseUrl = (options.baseUrl || CURSOR_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 10_000;

  const { promise, resolve } = Promise.withResolvers<CursorUsableModel[] | null>();
  let resolved = false;
  const client = http2.connect(baseUrl);

  const timer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      client.destroy();
      resolve(null);
    }
  }, timeoutMs);

  const req = client.request({
    ":method": "POST",
    ":path": CURSOR_GET_USABLE_MODELS_PATH,
    "content-type": "application/proto",
    te: "trailers",
    authorization: `Bearer ${accessToken}`,
    "x-ghost-mode": "true",
    "x-cursor-client-version": options.clientVersion ?? CURSOR_DEFAULT_CLIENT_VERSION,
    "x-cursor-client-type": "cli",
  });

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));

  req.on("end", () => {
    if (!resolved) {
      resolved = true;
      clearTimeout(timer);
      client.destroy();
      const payload = Buffer.concat(chunks);
      const models = decodeGetUsableModelsResponse(payload);
      resolve(models);
    }
  });

  req.on("error", () => {
    if (!resolved) {
      resolved = true;
      clearTimeout(timer);
      client.destroy();
      resolve(null);
    }
  });

  req.on("response", (headers) => {
    const status = Number(headers[":status"] ?? 0);
    if (status < 200 || status >= 300) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        client.destroy();
        resolve(null);
      }
    }
  });

  // Empty GetUsableModelsRequest body: 5-byte Connect-RPC frame with 0 length payload
  req.end();

  return promise;
}
