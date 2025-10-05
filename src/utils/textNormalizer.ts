import path from "path";
import { PDFParse, pdf } from 'pdf-parse';
import mammoth from "mammoth";
import { readFile } from 'node:fs/promises';


export type Chunk = {
    text: string;
    chunk_index: number;
    startChar: number;
    endChar: number;
  };

export function normalizeText(s: string): string {
    return s
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, "  ")
      .replace(/[ \u00A0]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  export async function extractTextFromFile(filePath: string): Promise<{ text: string; meta: Record<string, any> }> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".pdf") {
        const buf = await readFile(filePath);
        const buffer = new Uint8Array(buf);
        const result = await pdf(buffer);

        return {
            text: normalizeText(result.text || ""),
            meta: { pages: result.pages ?? undefined }
        };
    }
    
    

    if (ext === ".docx") {
        const res = await mammoth.extractRawText({path: filePath});
        return {
            text: normalizeText(res.value || ""),
            meta: {}
        };
    }

    if (ext === ".txt" || ext === ".md") {
        const raw = await readFile(filePath, "utf8");
        return { text: normalizeText(raw), meta: {} };
    }

    throw new Error(`Unsupported file type: ${ext} (${filePath})`);

}



  
  /**
   * Splits text into overlapping chunks. 
   * Defaults target ~1200 characters per chunk with ~150 char overlap.
   * This approximates ~500–700 tokens without needing a tokenizer.
   */
  export function splitIntoChunks(
    text: string,
    opts: { chunkSize?: number; overlap?: number } = {}
  ): Chunk[] {
    const chunkSize = opts.chunkSize ?? 1200;
    const overlap = opts.overlap ?? 150;
  
    if (!text || text.length <= chunkSize) {
      return text ? [{ text, chunk_index: 0, startChar: 0, endChar: text.length }] : [];
    }
  
    // Prefer to break on sentence boundaries when possible
    const sentences = text
      .split(/(?<=[\.!?])\s+(?=[A-Z(“"'])/g) // simple sentence splitter
      .filter(Boolean);
  
    const chunks: Chunk[] = [];
    let current = "";
    let cursor = 0; // char position in the original text
    let chunkIndex = 0;
  
    // Helper to push a chunk and compute positions
    const pushChunk = (content: string) => {
      const startChar = cursor - content.length;
      const endChar = cursor;
      chunks.push({ text: content.trim(), chunk_index: chunkIndex++, startChar, endChar });
    };
  
    for (const s of sentences) {
      if ((current + " " + s).trim().length <= chunkSize) {
        current = current ? current + " " + s : s;
        cursor += s.length + 1; // +1 for the space we added
      } else {
        // finalize current chunk
        if (current) {
          pushChunk(current);
        }
        // create an overlapped seed from the tail of current
        const tail = current.slice(Math.max(0, current.length - overlap));
        current = tail ? tail + " " + s : s;
        cursor += s.length + 1;
      }
    }
  
    if (current.trim()) pushChunk(current);
  
    // Fallback: if sentence splitting made weird tiny chunks, merge them greedily
    const merged: Chunk[] = [];
    let buffer: Chunk | null = null;
  
    for (const c of chunks) {
      if (!buffer) {
        buffer = { ...c };
        continue;
      }
      if ((buffer.text + " " + c.text).length <= chunkSize + 200) {
        buffer.text = (buffer.text + " " + c.text).trim();
        buffer.endChar = c.endChar;
      } else {
        merged.push(buffer);
        buffer = { ...c };
      }
    }
    if (buffer) merged.push(buffer);
  
    // Re-number chunk_index
    return merged.map((c, i) => ({ ...c, chunk_index: i }));
  }

export function normalizeName(name?: string): string | null {
    if (!name) return null;
    return name.toLowerCase().replace(/\s+/g, '_');
}

export function clipTranscript(t: string, maxChars = 15000) {
    if (t.length <= maxChars) return t;
    // keep head and tail; drop middle
    const head = t.slice(0, Math.floor(maxChars * 0.6));
    const tail = t.slice(-Math.floor(maxChars * 0.4));
    return `${head}\n...\n${tail}`;
  }