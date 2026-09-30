/**
 * Custom Next.js server that also hosts the Socket.IO endpoint used by the
 * trainer <-> customer chat.
 *
 * Why a custom server at all: App Router route handlers are request/response
 * only, so there is nowhere to hang a long-lived WebSocket. Attaching Socket.IO
 * to the same HTTP server that serves Next keeps everything on one origin and
 * one process, which matters because the API routes hand the live `io` instance
 * off to this file through `globalThis` (see src/lib/chat.js).
 *
 * Deliberate split of responsibilities:
 *   - This file only *authenticates* a connection and relays events. It never
 *     touches MongoDB and never persists a message.
 *   - Saving a message, and deciding whether the sender is allowed to talk to
 *     the receiver, happens in the REST route handlers, which already own the
 *     Mongoose models and the auth helpers.
 * A client therefore cannot fabricate a stored message by emitting a socket
 * event, because no socket event writes anything.
 *
 * Run with `node server.js --dev` for development, `node server.js` for
 * production. The flag is used instead of a NODE_ENV prefix so the same scripts
 * work in bash, PowerShell and cmd.
 */

const { createServer } = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { loadEnvConfig } = require('@next/env');

const dev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Next reads NODE_ENV itself, so it has to be settled before `next()` is called.
process.env.NODE_ENV = dev ? 'development' : 'production';

const dir = __dirname;

// Populates process.env from .env / .env.local exactly the way `next dev` does.
// Without this, JWT_SECRET would be undefined in this file, since a custom
// server runs before Next has loaded anything.
loadEnvConfig(dir, dev);

const next = require('next');

// Only used for the startup log. Deliberately not process.env.HOSTNAME, which on
// Windows is the machine name and has nothing to do with the listen address.
const DISPLAY_HOST = process.env.HOST || 'localhost';
const PORT = Number(process.env.PORT) || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env');
}

/**
 * Minimal cookie header parser. The auth token is httpOnly, so the browser
 * attaches it to the Socket.IO handshake automatically and client JS never sees
 * it. That is also why there is no token in the handshake `auth` payload.
 */
function parseCookies(header) {
  const jar = {};
  if (!header) return jar;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (!key || jar[key] !== undefined) continue;
    try {
      jar[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // A malformed percent-escape shouldn't drop the rest of the jar.
      jar[key] = part.slice(eq + 1).trim();
    }
  }

  return jar;
}

const app = next({ dev, dir });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      try {
        // The parsed URL is left to Next. Passing url.parse() output here is the
        // old custom-server idiom, and it now emits a deprecation warning.
        handle(req, res);
      } catch (error) {
        console.error('Request handling error:', error);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    const io = new Server(httpServer, {
      path: '/socket.io',
      // Same-origin only: the browser loads the client from this very server, so
      // there is no need to open CORS up to other origins.
      cors: { origin: false },
      // Keeps a dropped laptop lid from looking like a permanent disconnect.
      pingTimeout: 25000,
      pingInterval: 20000,
    });

    /**
     * Handshake auth. Rejecting here means the client's `connect_error` fires and
     * no events are ever delivered, so every later handler can trust
     * `socket.data.userId`.
     */
    io.use((socket, nextMiddleware) => {
      const cookies = parseCookies(socket.handshake.headers?.cookie);
      const token = cookies.token;

      if (!token) {
        nextMiddleware(new Error('Not authenticated'));
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {
        nextMiddleware(new Error('Invalid or expired token'));
        return;
      }

      if (!decoded?.userId) {
        nextMiddleware(new Error('Invalid or expired token'));
        return;
      }

      socket.data.userId = String(decoded.userId);
      nextMiddleware();
    });

    io.on('connection', (socket) => {
      const { userId } = socket.data;

      // Every socket lands in a room keyed by its own user id. Emitting a new
      // message to `user:<a>` and `user:<b>` reaches both participants wherever
      // they are in the app, which is what lets the navbar unread badge update
      // while the recipient is not looking at the chat page.
      socket.join(`user:${userId}`);

      /**
       * Joining a conversation room is what enables typing indicators, and a
       * room name is guessable (it is derived from ids). Rather than query Mongo
       * from here, the client presents a short-lived token that only
       * GET /api/chat/messages issues, and only after it has verified the
       * trainer/enrollment relationship. So room membership inherits that
       * check.
       */
      socket.on('conversation:join', (payload, ack) => {
        const roomToken = typeof payload?.roomToken === 'string' ? payload.roomToken : '';

        if (!roomToken) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Missing room token' });
          return;
        }

        let claims;
        try {
          claims = jwt.verify(roomToken, JWT_SECRET);
        } catch {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room token' });
          return;
        }

        // The token must have been minted for chat, and for this exact user, so
        // one participant cannot replay another's token.
        if (claims?.purpose !== 'chat-room' || String(claims.uid) !== userId || !claims.room) {
          if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room token' });
          return;
        }

        socket.join(claims.room);
        if (typeof ack === 'function') ack({ ok: true, room: claims.room });
      });

      socket.on('conversation:leave', (payload) => {
        const room = typeof payload?.room === 'string' ? payload.room : '';
        if (room && socket.rooms.has(room)) {
          socket.leave(room);
        }
      });

      /**
       * Typing indicator. Only broadcast into rooms this socket has already been
       * admitted to, and always stamp the *authenticated* user id rather than
       * anything the client supplied.
       */
      socket.on('typing', (payload) => {
        const room = typeof payload?.room === 'string' ? payload.room : '';
        if (!room || !socket.rooms.has(room)) return;

        socket.to(room).emit('typing', {
          room,
          userId,
          isTyping: Boolean(payload?.isTyping),
        });
      });
    });

    // Handed to the API routes. They import a thin accessor from
    // src/lib/chat.js instead of reaching for this key directly.
    globalThis.__fitlabIO = io;

    httpServer.listen(PORT, () => {
      console.log(
        `> FitLab ready on http://${DISPLAY_HOST}:${PORT} (${dev ? 'development' : 'production'})`
      );
      console.log('> Socket.IO listening on /socket.io');
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
