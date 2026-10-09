export type SseEvent = Readonly<{
  event: string | null;
  data: string;
}>;

export type SseParser = {
  feed(chunk: string): SseEvent[];
  /** Flush a trailing event with no terminating blank line. */
  end(): SseEvent[];
};

export function createSseParser(): SseParser {
  let buffer = '';
  let event: string | null = null;
  let data: string[] = [];

  function flush(out: SseEvent[]): void {
    if (data.length === 0 && event === null) return;
    out.push(Object.freeze({ event, data: data.join('\n') }));
    event = null;
    data = [];
  }

  function consumeLine(line: string, out: SseEvent[]): void {
    if (line === '') {
      flush(out);
      return;
    }
    if (line.startsWith(':')) return; // comment / keepalive
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    // id / retry are ignored.
  }

  return {
    feed(chunk) {
      const out: SseEvent[] = [];
      buffer += chunk.replace(/\r\n?/g, '\n');
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline), out);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      return out;
    },
    end() {
      const out: SseEvent[] = [];
      if (buffer.length > 0) {
        consumeLine(buffer, out);
        buffer = '';
      }
      flush(out);
      return out;
    },
  };
}

export function parseSseText(text: string): SseEvent[] {
  const parser = createSseParser();
  return [...parser.feed(text), ...parser.end()];
}

/** Parse each event's data as JSON, dropping `[DONE]` and non-JSON frames. */
export function sseJsonFrames(
  events: readonly SseEvent[],
): Array<{ event: string | null; json: Record<string, unknown> }> {
  const frames: Array<{ event: string | null; json: Record<string, unknown> }> =
    [];
  for (const e of events) {
    if (e.data === '' || e.data === '[DONE]') continue;
    try {
      const json: unknown = JSON.parse(e.data);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        frames.push({ event: e.event, json: json as Record<string, unknown> });
      }
    } catch {
      // A non-JSON frame is noise, not an error.
    }
  }
  return frames;
}
