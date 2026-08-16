declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

  const pdfParse: (buffer: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
