export class APIError extends Error {
  constructor(public code: string, public status = 409, public retryable = false) { super(code); }
}
