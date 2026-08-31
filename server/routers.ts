import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { answerQuestion, buildCombinedIndex, MAX_FILE_BYTES } from "./rag";

const uploadedFile = z.object({
  name: z.string().min(1),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  data: z.string().min(1),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  documents: router({
    ingest: publicProcedure.input(z.object({
      files: z.array(uploadedFile).max(12).default([]),
      youtubeUrls: z.array(z.string().url()).max(5).default([]),
    })).mutation(async ({ input }) => {
      if (input.files.length === 0 && input.youtubeUrls.length === 0) {
        throw new Error("Provide at least one PDF or YouTube link to begin.");
      }
      return buildCombinedIndex(input.files, input.youtubeUrls);
    }),
    ask: publicProcedure.input(z.object({
      documentId: z.string().uuid(),
      question: z.string().min(1).max(2000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).default([]),
    })).mutation(async ({ input }) => {
      return answerQuestion(input.documentId, input.question, input.history);
    }),
  }),
});

export type AppRouter = typeof appRouter;
