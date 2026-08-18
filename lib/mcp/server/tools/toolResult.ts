export type ToolPayload = Record<string, unknown> | string | unknown[];

function toJsonSafe<T>(value: T): T {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return (Number.isSafeInteger(asNumber) ? asNumber : value.toString()) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item)) as T;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString() as T;
    }

    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toJsonSafe(item);
    }

    return output as T;
  }

  return value;
}

export function createStructuredToolResult(payload: ToolPayload) {
  if (typeof payload === "string") {
    return {
      content: [
        {
          type: "text" as const,
          text: payload,
        },
      ],
    };
  }

  const safePayload = toJsonSafe(payload);
  const structuredContent = Array.isArray(safePayload)
    ? { items: safePayload }
    : safePayload;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(safePayload),
      },
    ],
    structuredContent,
  };
}
