import process from "node:process";
import core from "@actions/core";
import path from "node:path";
import {
  getDenoVersionFromFile,
  parseVersionRange,
  resolveVersion,
} from "./version.ts";
import { install } from "./install.ts";

declare global {
  interface ImportMeta {
    dirname?: string;
    filename?: string;
  }
}

function exit(message: string): never {
  core.setFailed(message);
  process.exit();
}

function isCachingEnabled() {
  return core.getInput("cache") === "true" ||
    core.getInput("cache-hash").length > 0;
}

async function main() {
  try {
    const denoVersionFile = core.getInput("deno-version-file");
    const range = parseVersionRange(
      denoVersionFile
        ? getDenoVersionFromFile(denoVersionFile)
        : core.getInput("deno-version"),
    );

    if (range === null) {
      exit("The passed version range is not valid.");
    }

    const version = await resolveVersion(range);
    if (version === null) {
      exit("Could not resolve a version for the given range.");
    }

    core.info(`Going to install ${version.kind} version ${version.version}.`);

    await install(version);

    core.info(
      `::add-matcher::${
        path.join(
          import.meta.dirname ?? ".",
          "..",
          "deno-problem-matchers.json",
        )
      }`,
    );

    core.setOutput("deno-version", version.version);
    core.setOutput("release-channel", version.kind);

    core.info("Installation complete.");

    if (isCachingEnabled()) {
      const { restoreCache } = await import("./cache.ts");
      await restoreCache(core.getInput("cache-hash"));
    }
  } catch (err) {
    core.setFailed((err instanceof Error) ? err : String(err));
    process.exit();
  }
}

main();
