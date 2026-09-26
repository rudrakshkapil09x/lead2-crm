import { spawn } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawn(npm, ["run", "build:demo", "-w", "apps/api"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
build.on("exit", (code) => {
  if (code) process.exit(code);
  const api = spawn(process.execPath, ["dist-demo/test/demo-server.js"], {
    cwd: "apps/api",
    stdio: "inherit",
  });
  const web = spawn(npm, ["run", "dev", "-w", "apps/web"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log(
    "Open http://localhost:3000 — workspace lead2-demo, admin@lead2.demo, password Lead2-Demo-2026!",
  );
  const stop = () => {
    api.kill();
    web.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  api.on("exit", stop);
  web.on("exit", stop);
});
