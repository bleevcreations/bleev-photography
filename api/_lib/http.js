export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function readBody(req, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, 'File too large (max 4 MB per image)');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const buf = await readBody(req, 200 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw httpError(400, 'Invalid JSON');
  }
}

// Wraps a handler so thrown httpErrors become clean JSON responses.
export function route(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      res.status(status).json({
        success: false,
        error: status < 500 ? err.message : 'Server error',
        message: status < 500 ? err.message : 'Server error',
      });
    }
  };
}

export function methodNotAllowed() {
  return httpError(405, 'Method not allowed');
}
