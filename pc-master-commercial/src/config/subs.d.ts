export const MAX_CHARS: number;
export function chunkLine(text: string): string[];
export function buildChunks(voice: {text: string; start: number; dur: number; words?: {w: string; s: number; e: number}[]}[]): {text: string; start: number; end: number}[];
export function resolveVoice(tl: unknown, gen: unknown): {id: string; scene: string; text: string; start: number; dur: number; words?: {w: string; s: number; e: number}[]}[];
