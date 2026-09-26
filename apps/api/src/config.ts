import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(__dirname, "../../..", ".env"), quiet: true });
