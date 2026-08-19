# Contexta — PDF-Powered RAG Document Chat

> **Ask your documents. Get answers grounded in the source.**

Contexta is a polished, single-page document question-answering application built around a Retrieval-Augmented Generation (RAG) workflow. Users upload one or more PDF files, the application extracts and chunks their text with page metadata, creates in-memory embeddings, retrieves the most relevant passages for each question, and sends only that retrieved context to a language model. Every answer is accompanied by page-level source citations, while unsupported questions receive the exact response: **“I don't know based on the document.”**

The project is designed as a portfolio-quality application that is easy to explain in an interview. The user interface and server-side RAG pipeline are deliberately separated so that ingestion, retrieval, answer generation, and presentation remain understandable and testable.

## Features

| Capability | Implementation |
| --- | --- |
| Multi-file PDF upload | Accepts multiple PDFs with a 20MB limit per file |
| Page-aware extraction | Uses `pdfjs-dist` to extract text separately for each PDF page |
| Text chunking | LangChain `RecursiveCharacterTextSplitter` with an 800-character chunk size and 100-character overlap |
| Embeddings | `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers` |
| Retrieval | In-memory cosine-similarity retrieval returning the top four chunks |
| Grounded generation | Server-side `invokeLLM` call with a strict context-only system prompt |
| Citations | Displays the source filename and page number below every assistant response |
| Session behavior | Rebuilds the index on each upload; documents are not persisted across sessions |
| Error handling | Handles invalid files, oversized uploads, empty or image-only PDFs, expired sessions, and LLM failures |
| User experience | Responsive editorial UI with upload states, empty states, loading indicators, keyboard submission, and persistent chat history |

## How RAG Works

Retrieval-Augmented Generation separates document lookup from answer generation. First, the uploaded PDFs are converted into page-level text and split into overlapping chunks. Each chunk and the user’s question are transformed into vectors using the same embedding model. The application compares the question vector with the document vectors, selects the four closest chunks, and includes only those chunks in the LLM prompt. Because the model is instructed to answer exclusively from that context, the application can provide source citations and return a controlled fallback when the answer is not supported by the documents.

```text
PDF files
   │
   ▼
Page-aware text extraction
   │
   ▼
Overlapping chunks + page metadata
   │
   ▼
all-MiniLM-L6-v2 embeddings
   │
   ▼
In-memory document index
   │
   ├── User question → query embedding
   │                         │
   │                         ▼
   └────────────── Top-4 similarity retrieval
                             │
                             ▼
                 Strict context-only LLM prompt
                             │
                             ▼
                    Answer + page citations
```

## Architecture

The application is implemented as a full-stack TypeScript web application rather than a Streamlit prototype. This keeps the user experience deployable as a single managed website while preserving the same RAG stages requested in the original project brief.

| Layer | Responsibility | Main files |
| --- | --- | --- |
| React client | Upload interface, chat thread, loading/error states, citations, and session history | `client/src/pages/Home.tsx`, `client/src/index.css` |
| tRPC API | Typed document ingestion and question-answering procedures | `server/routers.ts` |
| RAG pipeline | PDF extraction, chunking, embeddings, retrieval, and grounded generation | `server/rag.ts` |
| LLM gateway | Server-side model invocation without exposing credentials to the browser | `server/_core/llm.ts` |
| Project configuration | Dependencies, scripts, and deployment configuration | `package.json`, `vite.config.ts` |
| Tests | Authentication regression and RAG safety/retrieval tests | `server/*.test.ts` |

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Lucide icons, Streamdown
- **Backend:** Node.js, Express, tRPC 11
- **PDF extraction:** `pdfjs-dist`
- **Chunking:** `@langchain/textsplitters`
- **Embeddings:** `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2`
- **Answer generation:** The project’s server-side `invokeLLM` gateway helper
- **Validation:** Zod
- **Testing:** Vitest
- **Deployment:** Managed Manus WebDev hosting with the published application available at [ragchatbot-iegvwp4w.manus.space](https://ragchatbot-iegvwp4w.manus.space)

## Getting Started

### Prerequisites

Install Node.js 22 or a compatible current LTS release and enable pnpm. The application also requires access to the project’s configured server-side LLM gateway credentials. Do not commit credentials or `.env` files to GitHub.

### Installation

```bash
git clone <your-repository-url>
cd rag-document-chatbot
pnpm install
```

### Development

```bash
pnpm dev
```

Open the local development URL printed by the server. Upload a PDF, select **Build document index**, and ask a question from the chat composer.

### Verification

```bash
pnpm test
pnpm check
pnpm build
```

The test suite covers the exact fallback wording, upload-size protection, expired in-memory sessions, and top-four similarity retrieval. The type check validates the client and server contracts, while the production build verifies that the deployable bundle can be generated.

## Environment and Security

The server-side LLM helper reads credentials from the managed project environment. The browser never receives the server-side gateway key. If you run the application outside the managed environment, configure the corresponding gateway URL and secret through your hosting provider’s secret manager rather than committing values to source control.

The document index is intentionally held in process memory. Uploaded PDF contents, vectors, and chunk metadata are not written to the application database and are not persisted after the process or document session ends. A new upload replaces the active document session with a fresh index.

## Chat Model Selection

The answer-generation call currently invokes `invokeLLM` without a hardcoded `model` field. Therefore, the configured LLM gateway selects the project’s default chat model. This keeps the project portable across environments where the available model catalog may differ. To pin a specific model, add a verified model identifier to the `invokeLLM` call in `server/rag.ts` and document the chosen model’s capabilities and cost.

The embedding model is explicit and independent of the chat model:

```ts
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
```

## Grounding Contract

The system prompt enforces the application’s most important correctness rule:

> The assistant may answer only from the retrieved document context. When the answer is not explicitly supported, it must reply exactly: `I don't know based on the document.`

The server adds citations from the retrieved chunks rather than asking the model to invent or format citations. This makes the citation display deterministic and ensures that every assistant message has a source section in the UI.

## Project Structure

```text
.
├── client/
│   └── src/
│       ├── pages/Home.tsx          # Main upload and chat experience
│       ├── components/             # Reusable UI components
│       ├── contexts/                # Theme and application contexts
│       ├── lib/trpc.ts              # Typed tRPC client
│       └── index.css                # Global design system and typography
├── server/
│   ├── rag.ts                      # PDF ingestion, embeddings, retrieval, and answers
│   ├── routers.ts                  # Typed document procedures
│   ├── rag.test.ts                 # RAG behavior tests
│   └── _core/                      # Managed authentication and platform helpers
├── drizzle/                        # Database schema and migrations
├── todo.md                         # Implementation checklist
├── package.json
└── README.md
```

## Interview Explanation

A concise way to explain the project is:

> “Contexta is a RAG document chatbot. When a user uploads a PDF, I extract its text page by page, split it into overlapping chunks, and embed those chunks with `all-MiniLM-L6-v2`. For each question, I embed the query, retrieve the four most similar chunks, and pass only those chunks to the language model in a strict prompt. The UI displays the generated answer together with the pages that supplied the context, and the index remains in memory so document data is not persisted.”

The design deliberately avoids hiding the core workflow behind a single large function. `server/rag.ts` owns document intelligence, `server/routers.ts` defines the typed API boundary, and `Home.tsx` focuses on the user interaction model.

## Future Improvements

A production-scale version could move document bytes and indexes to durable, access-controlled storage, add background ingestion for large files, stream answer tokens to the client, introduce per-user document collections, add OCR for scanned PDFs, and replace brute-force in-memory similarity search with a managed vector database or a verified native FAISS deployment. Those changes would improve scale, but they would also introduce persistence, authorization, lifecycle, and operational complexity that the current portfolio implementation intentionally avoids.

## License

Add the license that matches your intended GitHub distribution before publishing the repository. For a public portfolio project, the MIT License is a common permissive option, but the final choice should reflect your ownership and reuse requirements.
