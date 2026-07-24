import { HttpError } from '../lib/http-error.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join('; ');
      return next(new HttpError(400, message));
    }
    req.body = result.data;
    next();
  };
}

// Express 5 makes req.query a getter with no setter in some middleware
// chains — reassigning it throws ("Cannot set property query of
// #<IncomingMessage> which has only a getter"). Validated data goes on
// req.validatedQuery instead of overwriting the original.
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join('; ');
      return next(new HttpError(400, message));
    }
    req.validatedQuery = result.data;
    next();
  };
}
