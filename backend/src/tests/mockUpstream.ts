import express from "express";
import http from "node:http";

export interface MockUpstreamServer {
  server: http.Server;
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

export function startMockUpstream(): Promise<MockUpstreamServer> {
  const app = express();
  app.use(express.json());

  // 1. Basic Health / Hello
  app.get("/hello", (_req, res) => {
    res.status(200).json({ message: "Hello from mock upstream!" });
  });

  // 2. Echo request: returns body, query, and received headers
  app.all("/echo", (req, res) => {
    res.status(200).json({
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: req.headers,
    });
  });

  // 3. Delayed response to test gateway timeouts
  app.get("/delay", (req, res) => {
    const ms = parseInt(req.query.ms as string, 10) || 1000;
    setTimeout(() => {
      res.status(200).json({ message: `Delayed by ${ms}ms` });
    }, ms);
  });

  // 4. Return specific HTTP status code
  app.all("/status/:code", (req, res) => {
    const code = parseInt(req.params.code, 10) || 200;
    res.status(code).json({
      status: code,
      message: `Simulated upstream status ${code}`,
    });
  });

  return new Promise((resolve) => {
    // Port 0 tells the OS to assign an available ephemeral port
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      resolve({
        server,
        port,
        baseUrl,
        close: () =>
          new Promise<void>((resClose) => {
            server.close(() => resClose());
          }),
      });
    });
  });
}
