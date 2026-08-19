# Project TODO

- [x] Build single-page premium chat workspace layout
- [x] Add PDF uploader supporting multiple files with a 20MB per-file limit
- [x] Extract PDF text with page-aware metadata and reject empty PDFs clearly
- [x] Split extracted text into 800-character chunks with 100-character overlap
- [x] Embed chunks with all-MiniLM-L6-v2 and rebuild an in-memory vector index on every upload
- [x] Retrieve the top 4 most similar chunks for each question
- [x] Generate answers using strict document-context-only grounding
- [x] Use the exact fallback response: "I don't know based on the document."
- [x] Display page-level citations below every answer without exception
- [x] Preserve full chat history within the active session for follow-up questions
- [x] Handle LLM/API failures with clear user-facing messages
- [x] Add responsive polished styling, refined typography, spacing, and smooth interactions
- [x] Add Vitest coverage for core RAG and answer-grounding behavior
- [x] Run type checks, tests, and visual verification
- [x] Save a final checkpoint and deliver the project version
- [x] Create GitHub-ready README.md with project overview, architecture, setup, RAG flow, testing, deployment, and interview talking points
