// Deletes assets under the project folder that the catalog no longer references — orphans left
// behind when a file is renamed on the share or a public_id scheme changes.
//
//   npm run docs:prune -- --dry-run     # list what would be deleted (default: dry run)
//   npm run docs:prune -- --delete      # actually delete
//   npm run docs:prune -- --delete --keep-admin   # never touch admin/MCP uploads

import fs from "node:fs/promises";
import path from "node:path";
import { assertCloudinaryConfigured, destroyResource, listResources } from "../server/cloudinary.mjs";
import { loadEnv, REPO_ROOT } from "./lib/env.mjs";

loadEnv();

const CATALOG = path.join(REPO_ROOT, "src", "data", "documentCatalog.json");

async function allResources(prefix) {
  const resources = [];
  for (const resourceType of ["image", "raw", "video"]) {
    let cursor;
    do {
      const page = await listResources({ prefix, resourceType, nextCursor: cursor });
      resources.push(...(page.resources ?? []));
      cursor = page.next_cursor;
    } while (cursor);
  }
  return resources;
}

async function main() {
  assertCloudinaryConfigured();
  const shouldDelete = process.argv.includes("--delete");
  const keepAdmin = process.argv.includes("--keep-admin");
  const root = process.env.CLOUDINARY_ROOT_FOLDER || "v-tnf";

  const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8"));
  const referenced = new Set(catalog.documents.filter((doc) => doc.cloudinary?.publicId).map((doc) => doc.cloudinary.publicId));

  const resources = await allResources(`${root}/`);
  const orphans = resources.filter((resource) => {
    if (referenced.has(resource.public_id)) return false;
    if (keepAdmin) {
      const source = resource.context?.custom?.source ?? "";
      if (source === "admin" || source === "mcp") return false;
    }
    return true;
  });

  process.stdout.write(
    `${resources.length} asset(s) under ${root}/, ${referenced.size} referenced by the catalog, ${orphans.length} orphan(s).\n`
  );
  for (const orphan of orphans.slice(0, 40)) {
    process.stdout.write(`  ${shouldDelete ? "delete" : "would delete"} ${orphan.resource_type.padEnd(5)} ${orphan.public_id}\n`);
  }
  if (orphans.length > 40) process.stdout.write(`  … and ${orphans.length - 40} more\n`);

  if (!shouldDelete) {
    process.stdout.write("\nDry run. Re-run with --delete to remove them.\n");
    return;
  }

  let removed = 0;
  for (const orphan of orphans) {
    try {
      await destroyResource({ publicId: orphan.public_id, resourceType: orphan.resource_type });
      removed += 1;
    } catch (error) {
      process.stderr.write(`FAIL ${orphan.public_id}: ${error.message}\n`);
    }
  }
  process.stdout.write(`\nDeleted ${removed}/${orphans.length} orphan(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
