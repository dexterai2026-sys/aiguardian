import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * A minimal static file server for e2e fixture pages. Manifest content-script `matches` patterns
 * don't include a port component (match patterns apply regardless of port), so binding to an
 * ephemeral `localhost` port and matching `http://localhost/*` in the manifest works without
 * needing a fixed port or `file://` access (which unpacked extensions don't get by default,
 * unlike the "Allow access to file URLs" toggle a person can set manually in chrome://extensions).
 */
export async function startFixtureServer(fixtureFile: string): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const filePath = fileURLToPath(new URL(fixtureFile, import.meta.url));
  const content = await readFile(filePath);

  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(content);
  });

  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected the fixture server to bind to a TCP port");
  }

  return {
    url: `http://localhost:${address.port}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        // Plain server.close() waits for open connections to end on their own; the browser's
        // HTTP/1.1 keep-alive connection to this page never does on its own, so close() would
        // hang until the test's own timeout killed it (found by an actual hang, not anticipated -
        // see e2e/README.md). closeAllConnections() force-ends them immediately.
        server.closeAllConnections();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
