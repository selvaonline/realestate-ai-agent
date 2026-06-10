import { z, ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return res.status(400).json({ error: "Validation failed", details: errors });
    }
    req.body = result.data;
    next();
  };
}

export const runSchema = z.object({
  query: z.string().min(1, "query is required").max(500),
  dataSources: z.object({
    enabledDomains: z.array(z.string()),
    apiKeys: z.record(z.string(), z.string()),
  }).optional(),
  orgSettings: z.object({}).passthrough().optional(),
});

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    )
    .min(1, "at least one message required"),
  context: z.object({}).passthrough().optional(),
  stream: z.boolean().optional(),
});

export const chatEnhancedSchema = z.object({
  user: z.string().min(1, "user message is required").max(2000),
  sessionId: z.string().optional(),
  context: z.object({}).passthrough().optional(),
  orgSettings: z.object({}).passthrough().optional(),
});

export const toolExecuteSchema = z.object({
  tool: z.string().min(1, "tool name is required"),
  args: z.record(z.string(), z.any()).optional().default({}),
  orgSettings: z.object({}).passthrough().optional(),
});
