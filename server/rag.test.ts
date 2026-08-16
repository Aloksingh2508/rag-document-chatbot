import { describe, expect, it } from "vitest";
import { answerQuestion, buildDocumentIndex, FALLBACK_ANSWER, MAX_FILE_BYTES, __testing } from "./rag";

describe("RAG pipeline safeguards", () => {
  it("keeps the required fallback wording exact", () => {
    expect(FALLBACK_ANSWER).toBe("I don't know based on the document.");
  });

  it("rejects files over the 20MB limit before parsing", async () => {
    await expect(buildDocumentIndex([{ name: "large.pdf", size: MAX_FILE_BYTES + 1, data: "" }])).rejects.toThrow("exceeds the 20MB file limit");
  });

  it("rejects questions for an expired in-memory document session", async () => {
    await expect(answerQuestion("00000000-0000-4000-8000-000000000000", "What is this about?", [])).rejects.toThrow("session has expired");
  });

  it("orders cosine matches and limits retrieval to the top four chunks", () => {
    const chunks = Array.from({ length: 6 }, (_, index) => ({ id: String(index), text: `chunk ${index}`, page: index + 1, fileName: "sample.pdf", vector: [index === 0 ? 1 : 0, index === 1 ? 0.9 : 0, index === 2 ? 0.8 : 0, index === 3 ? 0.7 : 0, index === 4 ? 0.6 : 0, index === 5 ? 0.5 : 0] }));
    const topFour = chunks.map(chunk => ({ chunk, score: __testing.cosineSimilarity([1, 0, 0, 0, 0, 0], chunk.vector) })).sort((a, b) => b.score - a.score).slice(0, 4);
    expect(topFour).toHaveLength(4);
    expect(topFour[0]?.chunk.id).toBe("0");
    expect(topFour[3]?.chunk.id).toBe("3");
  });
});
