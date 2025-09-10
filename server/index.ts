import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// ✅ Polyfill __dirname for ESM (Node.js ESM doesn’t provide __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------------------
// ✅ CORS middleware
// ------------------------------
const allowedOrigins = [
  "https://city-zen-guard.vercel.app", // main production frontend
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (process.env.NODE_ENV === "development") {
        return callback(null, true); // allow all in dev
      }

      if (!origin) {
        return callback(null, true); // allow server-to-server / curl
      }

      // Allow main prod or Vercel preview subdomains
      try {
        const hostname = new URL(origin).hostname;
        if (
          allowedOrigins.includes(origin) ||
          /\.vercel\.app$/.test(hostname)
        ) {
          return callback(null, true);
        }
      } catch {
        // invalid origin header
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Always handle preflight requests
app.options("*", cors());

// ------------------------------
// Middleware
// ------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 200) {
        logLine = logLine.slice(0, 199) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// ------------------------------
// Bootstrapping
// ------------------------------
(async () => {
  const server = await registerRoutes(app);

  // ✅ Error handler AFTER routes
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Always include CORS headers on errors
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    res.status(status).json({ message });
    log(`Error handled: ${status} - ${message}`);
  });

  // Setup Vite (dev) or serve static (prod)
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ------------------------------
  // Start Server
  // ------------------------------
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // Warm up the RAG/LLM system in background
      if (app.get("env") !== "development") {
        import("./services/generation/llm")
          .then(({ warmUpModel }) => {
            warmUpModel().catch((err) =>
              log(`Warning: Model warm-up failed: ${err.message}`)
            );
          })
          .catch(() => {
            log("Warning: Could not import LLM service for warm-up");
          });
      }
    }
  );
})();
