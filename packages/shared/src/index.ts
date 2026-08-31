export * from "./common.js";
export * from "./todo.js";
export * from "./project.js";
export * from "./event.js";
export * from "./reference.js";
export * from "./incoming.js";
export * from "./tag.js";
export * from "./workspace.js";
export * from "./share.js";
export * from "./home.js";

/** Shape of an API error body (RFC 7807-ish). */
export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
