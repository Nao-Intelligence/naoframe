import { readFileSync, writeFileSync } from "node:fs";

const path = ".env";
const original = readFileSync(path, "utf8");

const fixed = original.replace(
  /^(DATABASE_URL|DIRECT_DATABASE_URL)=(postgres(?:ql)?:\/\/[^:]+:)\[([^\]]+)\]@/gm,
  "$1=$2$3@",
);

if (fixed === original) {
  console.log("No [brackets] found around the password — nothing changed.");
} else {
  writeFileSync(`${path}.bak`, original);
  writeFileSync(path, fixed);
  console.log("Brackets around the password removed. Backup: .env.bak");
}
