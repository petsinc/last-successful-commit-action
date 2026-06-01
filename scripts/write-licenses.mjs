import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const output = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
  encoding: "utf8",
});
const licensesByType = JSON.parse(output);

const rows = Object.entries(licensesByType)
  .flatMap(([license, packages]) =>
    packages.flatMap((pkg) =>
      pkg.versions.map((version) => ({
        license,
        name: pkg.name,
        version,
      }))
    )
  )
  .sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)
  );

const text = [
  "production dependency licenses",
  "",
  ...rows.map((row) => `${row.name}@${row.version}: ${row.license}`),
  "",
].join("\n");

mkdirSync("dist", { recursive: true });
writeFileSync("dist/licenses.txt", text);
