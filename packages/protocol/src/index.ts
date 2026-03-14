import { z } from "zod";

export const SignalSchema = z.enum(["ctrl_c"]);

const AgentScopedSchema = z.object({
  agentId: z.string().min(1)
});

export const SessionEnsureMessageSchema = z.object({
  type: z.literal("session.ensure"),
  payload: AgentScopedSchema
});

export const PtyInputMessageSchema = z.object({
  type: z.literal("pty.input"),
  payload: AgentScopedSchema.extend({
    text: z.string().min(1)
  })
});

export const PtySignalMessageSchema = z.object({
  type: z.literal("pty.signal"),
  payload: AgentScopedSchema.extend({
    signal: SignalSchema
  })
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  SessionEnsureMessageSchema,
  PtyInputMessageSchema,
  PtySignalMessageSchema
]);

export const PtyOutputMessageSchema = z.object({
  type: z.literal("pty.output"),
  payload: AgentScopedSchema.extend({
    chunk: z.string()
  })
});

export const AgentStatusMessageSchema = z.object({
  type: z.literal("agent.status"),
  payload: AgentScopedSchema.extend({
    online: z.boolean(),
    name: z.string().min(1).optional()
  })
});

export const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  payload: z.object({
    code: z.string().min(1),
    message: z.string().min(1)
  })
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
  PtyOutputMessageSchema,
  AgentStatusMessageSchema,
  ErrorMessageSchema
]);

export const AnyMessageSchema = z.discriminatedUnion("type", [
  SessionEnsureMessageSchema,
  PtyInputMessageSchema,
  PtySignalMessageSchema,
  PtyOutputMessageSchema,
  AgentStatusMessageSchema,
  ErrorMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type AnyMessage = z.infer<typeof AnyMessageSchema>;
export type Signal = z.infer<typeof SignalSchema>;

export function parseClientMessage(input: unknown): ClientMessage {
  return ClientMessageSchema.parse(input);
}

export function parseServerMessage(input: unknown): ServerMessage {
  return ServerMessageSchema.parse(input);
}
