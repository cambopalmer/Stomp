export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const NotFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`);
export const Forbidden = (message = "You don't have access to this") =>
  new AppError(403, "forbidden", message);
export const BadRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);
export const Conflict = (message: string) => new AppError(409, "conflict", message);
