import crypto from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@huggingface/transformers";
import { invokeLLM } from "./_core/llm";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const FALLBACK_ANSWER = "I don't know based on the document.";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const TOP_K = 4;
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type Citation = { fileName: string; page: number };
type SourceChunk = { id: string; text: string; page: number; fileName: string; vector: number[] };
type DocumentIndex = { id: string; files: string[]; chunks: SourceChunk[]; createdAt: number };

const indexes = new Map<string, DocumentIndex>();
let extractorPromise: Promise<any> | undefined;

async function getExtractor() {
  extractorPromise ??= pipeline("feature-extraction", MODEL_ID);
  return extractorPromise;
}

async function embedText(text: string) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array) as number[];
}

async function extractPages(buffer: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    pages.push(text);
  }
  return pages;
}

export async function buildDocumentIndex(files: Array<{ name: string; size: number; data: string }>) {
  if (!files.length) throw new Error("Upload at least one PDF to begin.");
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  const chunks: SourceChunk[] = [];
  const fileNames: string[] = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error(`${file.name} is not a PDF file.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 20MB file limit.`);
    const pages = await extractPages(Buffer.from(file.data, "base64"));
    if (!pages.some(page => page.length > 0)) throw new Error(`${file.name} appears to be empty or image-only.`);
    fileNames.push(file.name);
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageText = pages[pageIndex];
      if (!pageText) continue;
      const pageChunks = await splitter.splitText(pageText);
      for (const text of pageChunks) {
        chunks.push({ id: crypto.randomUUID(), text, page: pageIndex + 1, fileName: file.name, vector: await embedText(text) });
      }
    }
  }

  if (!chunks.length) throw new Error("No readable text was found in the uploaded PDFs.");
  const id = crypto.randomUUID();
  indexes.set(id, { id, files: fileNames, chunks, createdAt: Date.now() });
  return { id, files: fileNames, chunkCount: chunks.length };
}

function cosineSimilarity(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function retrieveTopK(chunks: SourceChunk[], queryVector: number[]) {
  return chunks.map(chunk => ({ chunk, score: cosineSimilarity(queryVector, chunk.vector) })).sort((a, b) => b.score - a.score).slice(0, TOP_K).map(({ chunk }) => chunk);
}

export async function answerQuestion(documentId: string, question: string, history: Array<{ role: "user" | "assistant"; content: string }>) {
  const index = indexes.get(documentId);
  if (!index) throw new Error("This document session has expired. Upload the PDFs again to continue.");
  const query = question.trim();
  if (!query) throw new Error("Enter a question about your documents.");

  const matches = retrieveTopK(index.chunks, await embedText(query));
  const context = matches.map((chunk, i) => `[Source ${i + 1} | ${chunk.fileName}, page ${chunk.page}]\n${chunk.text}`).join("\n\n");
  const citations = Array.from(new Map(matches.map(chunk => [`${chunk.fileName}-${chunk.page}`, { fileName: chunk.fileName, page: chunk.page } as Citation])).values());

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: `You answer questions using only the supplied document context. Do not use outside knowledge, assumptions, or unsupported conversation facts. If the answer is not explicitly supported, reply with exactly: ${FALLBACK_ANSWER}. Keep answers concise and useful. Do not add citations; the application adds them separately.` },
        ...history.slice(-6).map(message => ({ role: message.role, content: message.content })),
        { role: "user", content: `DOCUMENT CONTEXT:\n${context}\n\nQUESTION:\n${query}` },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    return { answer: typeof content === "string" && content.trim() ? content.trim() : FALLBACK_ANSWER, citations, retrieved: matches.length };
  } catch (error) {
    console.error("[RAG] LLM request failed", error);
    throw new Error("The answer service is temporarily unavailable. Please try again.");
  }
}

export const __testing = { retrieveTopK, cosineSimilarity };
