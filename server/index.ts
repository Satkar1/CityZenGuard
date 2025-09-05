import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// ✅ CORS middleware FIRST
app.use(
  cors({
    origin: (origin, callback) => {
      if (process.env.NODE_ENV === "development") {
        return callback(null, true); // allow all in dev
      }

      if (!origin) {
        return callback(null, false); // block requests without origin
      }

      const allowedOrigins = [
        "https://city-zen-guard.vercel.app", // main production frontend
      ];

      // Allow main prod OR any vercel preview subdomain
      if (
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ✅ Allow preflight for all routes
app.options("*", cors());

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

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // ✅ Error handler AFTER routes
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Ensure CORS headers are set even for errors
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

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // Warm up the RAG system in background
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
