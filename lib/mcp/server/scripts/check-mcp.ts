import { discoverMcpCapabilities } from "../../client/mcpClient.ts";

async function main() {
  console.log("Connecting to MCP server...\n");

  const { tools, prompts, resources } = await discoverMcpCapabilities();

  console.log("=== TOOLS ===");
  tools.forEach((tool) => console.log(`  - ${tool.name}: ${tool.description}`));

  console.log("\n=== PROMPTS ===");
  prompts.forEach((prompt) => console.log(`  - ${prompt.name}`));

  console.log("\n=== RESOURCES ===");
  resources.forEach((resource) => console.log(`  - ${resource.name} -> ${resource.uri}`));
}

main().catch(console.error);
