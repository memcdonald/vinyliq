import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
} from "@/server/services/ai/chat";
import { isAIConfigured } from "@/server/services/ai";

export const chatRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAIConfigured()) {
        return {
          content:
            "AI is not configured. Please add an API key on the Credentials page.",
        };
      }
      return sendChatMessage(ctx.userId, input.message);
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return getChatHistory(ctx.userId);
  }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await clearChatHistory(ctx.userId);
    return { success: true };
  }),
});
