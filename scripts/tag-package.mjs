#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import process from "node:process";

function shOut(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
}

function formatCmd(cmd, args) {
  const parts = [cmd, ...(args ?? [])];
  return parts
    .map((p) => {
      if (/[\s"]/g.test(p)) return JSON.stringify(p);
      return p;
    })
    .join(" ");
}

function sh(cmd, args, opts = {}) {
  if (!opts.quiet) {
    // eslint-disable-next-line no-console
    console.log(`> ${formatCmd(cmd, args)}`);
  }
  // eslint-disable-next-line no-unused-vars
  const { quiet, ...rest } = opts;
  execFileSync(cmd, args, { stdio: "inherit", ...rest });
}

function parseArgs(argv) {
  /** @type {{package?: string, dir?: string, dryRun?: boolean, noPush?: boolean, force?: boolean, interactive?: boolean}} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--package" || a === "-p") out.package = argv[++i];
    else if (a === "--dir" || a === "-d") out.dir = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-push") out.noPush = true;
    else if (a === "--force") out.force = true;
    else if (a === "--interactive" || a === "-i") out.interactive = true;
    else if (a === "--quiet") out.quiet = true;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listWorkspacePackages(repoRoot) {
  const packagesDir = path.join(repoRoot, "packages");
  if (!fs.existsSync(packagesDir)) return [];
  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(packagesDir, e.name));

  /** @type {{dir: string, pkg: any}[]} */
  const out = [];
  for (const dir of dirs) {
    const pkgJsonPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    out.push({ dir, pkg: readJson(pkgJsonPath) });
  }
  return out;
}

function resolveTarget(repoRoot, args) {
  if (args.dir) {
    const dir = path.resolve(repoRoot, args.dir);
    const pkgJsonPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`No package.json found at: ${pkgJsonPath}`);
    }
    return { dir, pkg: readJson(pkgJsonPath) };
  }

  const all = listWorkspacePackages(repoRoot);
  if (!args.package) {
    if (args.interactive) return { __needsPrompt: true, all };
    throw new Error("Missing --package <name> (or use --dir <path>, or pass -i for picker)");
  }

  const hit = all.find((p) => p.pkg?.name === args.package);
  if (!hit) throw new Error(`Package not found in ./packages: ${args.package}`);
  return hit;
}

function isCleanGit() {
  return shOut("git", ["status", "--porcelain"]) === "";
}

function tagForPackage(pkgName, version) {
  // Your GitHub Actions workflows trigger on:
  // - "v*" for the full publish pipeline
  // - "dashboard-v*" for dashboard-only publishes
  if (pkgName === "@sgedda/mockifyer-dashboard") return `dashboard-v${version}`;
  return `v${version}`;
}

async function promptForPackage(all) {
  if (!all.length) throw new Error("No packages found under ./packages");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    // eslint-disable-next-line no-console
    console.log("Select a package to tag:");
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      // eslint-disable-next-line no-console
      console.log(`${String(i + 1).padStart(2, " ")}. ${p.pkg.name}  (${path.relative(process.cwd(), p.dir)})`);
    }

    // Optional filter helper (also accepts a number to select immediately)
    const filter = (await rl.question("Filter (optional) or number to select: ")).trim();
    if (filter) {
      const asNumber = Number(filter);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= all.length) {
        return all[asNumber - 1];
      }
    }

    let choices = all;
    if (filter) {
      const lower = filter.toLowerCase();
      choices = all.filter((p) => String(p.pkg?.name ?? "").toLowerCase().includes(lower));
      if (!choices.length) throw new Error(`No packages match filter: ${filter}`);
      // eslint-disable-next-line no-console
      console.log("");
      // eslint-disable-next-line no-console
      console.log("Filtered results:");
      for (let i = 0; i < choices.length; i++) {
        const p = choices[i];
        // eslint-disable-next-line no-console
        console.log(`${String(i + 1).padStart(2, " ")}. ${p.pkg.name}  (${path.relative(process.cwd(), p.dir)})`);
      }
    }

    const answer = (await rl.question("Enter number: ")).trim();
    const n = Number(answer);
    if (!Number.isInteger(n) || n < 1 || n > choices.length) {
      throw new Error(`Invalid selection: "${answer}"`);
    }
    return choices[n - 1];
  } finally {
    rl.close();
  }
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  let resolved = resolveTarget(repoRoot, { ...args, interactive: args.interactive ?? (!args.package && !args.dir) });
  if (resolved?.__needsPrompt) {
    resolved = await promptForPackage(resolved.all);
  }
  const { dir, pkg } = resolved;

  if (!pkg?.name || !pkg?.version) {
    throw new Error(`Invalid package.json in ${dir} (missing name/version)`);
  }

  if (!args.dryRun && !args.force && !isCleanGit()) {
    throw new Error("Working tree is dirty. Commit/stash before tagging (or pass --force).");
  }

  const tag = tagForPackage(pkg.name, pkg.version);

  if (args.dryRun) {
    // eslint-disable-next-line no-console
    console.log(`[dry-run] package: ${pkg.name}`);
    // eslint-disable-next-line no-console
    console.log(`[dry-run] version: ${pkg.version}`);
    // eslint-disable-next-line no-console
    console.log(`[dry-run] tag: ${tag}`);
    // eslint-disable-next-line no-console
    console.log(`[dry-run] git tag ${tag}`);
    if (!args.noPush) {
      // eslint-disable-next-line no-console
      console.log(`[dry-run] git push origin ${tag}`);
    }
    return;
  }

  // Create tag (fails if it already exists; that's usually what you want)
  sh("git", ["tag", tag], { quiet: args.quiet });

  if (!args.noPush) {
    sh("git", ["push", "origin", tag], { quiet: args.quiet });
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

