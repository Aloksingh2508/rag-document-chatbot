import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { ArrowUp, Check, FileText, Files, Loader2, MessageSquareText, Paperclip, Plus, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
type Citation = { fileName: string; page?: number; timestamp?: string };
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Citation[] };

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

import { Link as LinkIcon, Youtube } from "lucide-react";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [ytInput, setYtInput] = useState("");
  const [documentId, setDocumentId] = useState<string>();
  const [chunkCount, setChunkCount] = useState(0);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const ingest = trpc.documents.ingest.useMutation();
  const ask = trpc.documents.ask.useMutation();

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(file => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${file.name} is not a PDF file.`);
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than 20MB.`);
        return false;
      }
      return true;
    });
    setFiles(current => [...current, ...valid.filter(file => !current.some(item => item.name === file.name && item.size === file.size))]);
  };

  const indexFiles = async () => {
    if (!files.length && !youtubeUrls.length) return;
    try {
      const payload = await Promise.all(files.map(async file => ({ name: file.name, size: file.size, data: await readAsBase64(file) })));
      const result = await ingest.mutateAsync({ files: payload, youtubeUrls });
      setDocumentId(result.id);
      setChunkCount(result.chunkCount);
      setMessages([]);
      toast.success(`${result.files.length} source${result.files.length > 1 ? "s" : ""} indexed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process the sources.");
    }
  };

  const addYoutubeUrl = () => {
    const url = ytInput.trim();
    if (!url) return;
    if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
      toast.error("Please enter a valid YouTube URL.");
      return;
    }
    if (youtubeUrls.includes(url)) {
      toast.error("This video is already added.");
      return;
    }
    setYoutubeUrls([...youtubeUrls, url]);
    setYtInput("");
  };

  const submitQuestion = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const prompt = question.trim();
    if (!prompt || !documentId || ask.isPending) return;
    const previousMessages = messages;
    setMessages([...messages, { role: "user", content: prompt }]);
    setQuestion("");
    try {
      const result = await ask.mutateAsync({ documentId, question: prompt, history: previousMessages.map(({ role, content }) => ({ role, content })) });
      setMessages(current => [...current, { role: "assistant", content: result.answer, citations: result.citations }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not answer that question.");
      setMessages(previousMessages);
    }
  };

  const resetWorkspace = () => {
    setFiles([]);
    setYoutubeUrls([]);
    setDocumentId(undefined);
    setChunkCount(0);
    setMessages([]);
    setQuestion("");
  };

  const starterPrompts = ["Summarize the key ideas", "What are the main conclusions?", "Find the important dates", "Explain this in simple terms"];

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#17202b] selection:bg-[#dce8ff]">
      <header className="border-b border-[#e5e8ed] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#162b4d] text-white shadow-[0_8px_20px_rgba(22,43,77,0.2)]"><Sparkles size={17} /></div>
            <div><p className="font-display text-[17px] font-semibold tracking-[-0.02em]">Contexta</p><p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8993a1]">Document intelligence</p></div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-medium text-[#758193] sm:flex"><ShieldCheck size={15} className="text-[#3f7b63]" /> Private by design <span className="mx-1 text-[#cfd4db]">•</span> In-memory indexing</div>
          <button onClick={resetWorkspace} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#687587] transition hover:bg-[#f0f2f5] hover:text-[#17202b]"><Plus size={15} /> New workspace</button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-74px)] max-w-[1440px] lg:grid-cols-[330px_1fr]">
        <aside className="border-b border-[#e5e8ed] bg-[#fbfbfc] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <div className="mb-8"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9aa3af]">Workspace</p><h1 className="font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.04em]">Ask your<br /><span className="text-[#5873a1]">documents.</span></h1><p className="mt-3 max-w-[250px] text-[13px] leading-6 text-[#7b8796]">Upload PDFs and explore their content with answers grounded in the source material.</p></div>
          <section className="rounded-2xl border border-[#e1e5eb] bg-white p-4 shadow-[0_10px_34px_rgba(34,45,60,0.04)]">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Your documents</p><p className="mt-1 text-[11px] text-[#9aa3af]">PDF · up to 20MB each</p></div><Files size={18} className="text-[#8b98aa]" /></div>
            <button onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={event => { event.preventDefault(); setIsDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={`group flex min-h-[132px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center transition ${isDragging ? "border-[#5873a1] bg-[#f1f5fb]" : "border-[#cfd6df] bg-[#fbfcfd] hover:border-[#8ea2c0] hover:bg-[#f7f9fb]"}`}><span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#edf2f8] text-[#5873a1] transition group-hover:scale-105"><UploadCloud size={17} /></span><span className="text-xs font-semibold text-[#3b4654]">Drop PDFs here</span><span className="mt-1 text-[11px] text-[#a0a9b4]">or browse from your device</span></button>
            <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />

            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-lg border border-[#e1e5eb] bg-[#fbfcfd] p-1 pl-3 transition-within:border-[#aabbd1]">
                <Youtube size={14} className="text-[#ff0000]" />
                <input type="text" value={ytInput} onChange={e => setYtInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addYoutubeUrl()} placeholder="Paste YouTube link..." className="flex-1 bg-transparent py-1 text-xs outline-none" />
                <button onClick={addYoutubeUrl} className="flex h-7 w-7 items-center justify-center rounded-md bg-[#edf2f8] text-[#5873a1] hover:bg-[#e1e9f3]"><Plus size={14} /></button>
              </div>
            </div>

            {(files.length > 0 || youtubeUrls.length > 0) && (
              <div className="mt-4 space-y-2">
                {files.map(file => <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg bg-[#f7f8fa] px-3 py-2"><FileText size={14} className="shrink-0 text-[#c45d50]" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-[#4f5b6a]">{file.name}</span><span className="text-[10px] text-[#a1a9b3]">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button onClick={() => setFiles(current => current.filter(item => item !== file))} className="text-[#a6afb9] hover:text-[#556170]"><X size={14} /></button></div>)}
                {youtubeUrls.map(url => <div key={url} className="flex items-center gap-2 rounded-lg bg-[#f7f8fa] px-3 py-2"><Youtube size={14} className="shrink-0 text-[#ff0000]" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-[#4f5b6a]">{url.replace(/https?:\/\/(www\.)?/, "")}</span><button onClick={() => setYoutubeUrls(current => current.filter(item => item !== url))} className="text-[#a6afb9] hover:text-[#556170]"><X size={14} /></button></div>)}
              </div>
            )}
            <button onClick={indexFiles} disabled={(!files.length && !youtubeUrls.length) || ingest.isPending} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#162b4d] text-xs font-semibold text-white shadow-[0_8px_18px_rgba(22,43,77,0.16)] transition hover:bg-[#203d68] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45">{ingest.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {ingest.isPending ? "Indexing sources…" : documentId ? "Re-index all sources" : "Build unified index"}</button>
          </section>
          <div className="mt-6 space-y-3 text-[11px] leading-5 text-[#8c96a3]"><div className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8aa2c4]" />Each upload creates a fresh in-memory index.</div><div className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8aa2c4]" />Answers are restricted to retrieved document context.</div></div>
        </aside>

        <section className="flex min-h-[calc(100vh-74px)] flex-col bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4 lg:px-10"><div className="flex items-center gap-3"><div className={`h-2 w-2 rounded-full ${documentId ? "bg-[#4d9b70] shadow-[0_0_0_4px_rgba(77,155,112,0.12)]" : "bg-[#c8ced7]"}`} /><div><p className="text-sm font-semibold">Document chat</p><p className="text-[11px] text-[#98a2ae]">{documentId ? `${files.length} file${files.length > 1 ? "s" : ""} · ${chunkCount} chunks ready` : "Upload a document to begin"}</p></div></div><div className="hidden items-center gap-2 rounded-full bg-[#f6f8fa] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b96a4] md:flex"><MessageSquareText size={13} /> Grounded chat</div></div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-8 lg:px-16 lg:py-12">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-[420px] max-w-[680px] flex-col items-center justify-center text-center"><div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#edf2f8] text-[#5873a1]"><Sparkles size={28} strokeWidth={1.5} /></div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca7b4]">A quieter way to read</p><h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#1b2738]">What would you like to know?</h2><p className="mt-3 max-w-[430px] text-sm leading-6 text-[#8c97a5]">{documentId ? "Your documents are indexed. Ask a question and every answer will include its source pages." : "Upload one or more PDFs on the left, then ask focused questions about their contents."}</p><div className="mt-7 grid w-full max-w-[520px] gap-2 sm:grid-cols-2">{starterPrompts.map(prompt => <button key={prompt} disabled={!documentId} onClick={() => setQuestion(prompt)} className="rounded-xl border border-[#e8ebef] bg-[#fbfcfd] px-4 py-3 text-left text-xs font-medium text-[#697687] transition hover:border-[#bcc9da] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50">{prompt}<span className="mt-1 block text-[10px] text-[#aab2bd]">Ask the documents</span></button>)}</div></div>
              ) : (
                <div className="mx-auto max-w-[720px] space-y-7">
                  {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf2f8] text-[#5873a1]"><Sparkles size={14} /></div>}
                    <div className={`max-w-[88%] ${message.role === "user" ? "order-1" : ""}`}><div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-[#162b4d] px-4 py-3 text-white" : "rounded-2xl rounded-bl-md bg-[#f4f6f8] px-5 py-4 text-[#334052]"}><div className="text-[13px] leading-6">{message.role === "assistant" ? <Streamdown>{message.content}</Streamdown> : message.content}</div></div>{message.role === "assistant" && <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[10px] text-[#8b96a4]"><span className="font-semibold uppercase tracking-[0.12em]">Sources</span>{(message.citations ?? []).map((source, sIdx) => <span key={`${source.fileName}-${source.page}-${source.timestamp}-${sIdx}`} className="rounded-md bg-[#f0f3f6] px-2 py-1 font-medium text-[#697688]">{source.fileName}{source.page ? ` · p. ${source.page}` : ""}{source.timestamp ? ` · ${source.timestamp}` : ""}</span>)}</div>}</div>
                  </div>)}
                  {ask.isPending && <div className="flex items-start gap-3"><div className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf2f8] text-[#5873a1]"><Sparkles size={14} /></div><div className="rounded-2xl rounded-bl-md bg-[#f4f6f8] px-5 py-4"><div className="flex gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9eabbc]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9eabbc] [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9eabbc] [animation-delay:240ms]" /></div></div></div>}
                </div>
              )}
            </div>
            <div className="border-t border-[#edf0f3] bg-white px-5 pb-5 pt-4 lg:px-16 lg:pb-8"><form onSubmit={submitQuestion} className="mx-auto max-w-[720px]"><div className={`flex items-end gap-3 rounded-2xl border bg-[#fbfcfd] p-2 pl-4 shadow-[0_8px_30px_rgba(38,50,66,0.05)] transition ${documentId ? "border-[#dce2e9] focus-within:border-[#aabbd1] focus-within:ring-4 focus-within:ring-[#e7edf5]" : "border-[#e8ebef]"}`}><Paperclip size={17} className="mb-2.5 text-[#a0aab7]" /><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitQuestion(); } }} disabled={!documentId || ask.isPending} placeholder={documentId ? "Ask something about your documents…" : "Upload and index a PDF to start asking questions"} rows={1} className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-2 text-[13px] text-[#263344] outline-none placeholder:text-[#a8b0ba] disabled:cursor-not-allowed" /><button type="submit" disabled={!documentId || !question.trim() || ask.isPending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#162b4d] text-white transition hover:bg-[#203d68] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"><ArrowUp size={17} /></button></div><p className="mt-3 text-center text-[10px] text-[#a8b0ba]">Contexta answers only from your uploaded documents · Press Enter to send</p></form></div>
          </div>
        </section>
      </div>
    </main>
  );
}
