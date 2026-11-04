import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildAssistantKnowledge } from "../lib/assistant-knowledge.js";

const destination = new URL("../embeding/data.json", import.meta.url);
const knowledge = buildAssistantKnowledge();

await writeFile(destination, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");
console.log(`Exported ${knowledge.projects.length} projects to ${fileURLToPath(destination)}`);
