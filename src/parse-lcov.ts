import { exists, readFile } from "fs";
import { Coverage, CoverageCollection } from "./coverage-info";

function walkFile(str: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    let data: CoverageCollection = [];
    let item: Coverage | undefined;
    const lines = ["end_of_record"].concat(str.split("\n"));

    for (let line of lines) {
      line = line.trim();
      const allparts = line.split(":");
      const metrics = allparts.shift();
      const args = allparts.join(":");
      const parts = [allparts.shift(), allparts.join(":")];

      if (item) {
        switch (metrics && metrics.toUpperCase()) {
          case "TN": {
            item.title = args.trim();
            break;
          }
          case "SF": {
            item.file = args.trim();
            break;
          }
          case "FNF": {
            item.functions.found = Number(args.trim());
            break;
          }
          case "FNH": {
            item.functions.hit = Number(args.trim());
            break;
          }
          case "LF": {
            item.lines.found = Number(args.trim());
            break;
          }
          case "LH": {
            item.lines.hit = Number(args.trim());
            break;
          }
          case "DA": {
            if (item) {
              const details = args.split(",");
              item.lines.details.push({
                line: Number(details[0]),
                hit: Number(details[1]),
              });
            }
            break;
          }
          case "BRF": {
            item.branches.found = Number(parts[1]);
            break;
          }
          case "BRH": {
            item.branches.hit = Number(parts[1]);
            break;
          }
          case "FN": {
            if (item) {
              const fn = args.split(",");
              item.functions.details.push({
                name: fn[1],
                line: Number(fn[0]),
              });
            }
            break;
          }
          case "FNDA": {
            if (item) {
              const fn = args.split(",");
              item.functions.details.some((i, k) => {
                if (item && item.functions.details) {
                  if (i.name === fn[1] && i.hit === undefined) {
                    item.functions.details[k].hit = Number(fn[0]);
                    return true;
                  }
                }
                return false;
              });
            }
            break;
          }
          case "BRDA": {
            if (item) {
              const fn = args.split(",");
              item.branches.details.push({
                line: Number(fn[0]),
                block: Number(fn[1]),
                branch: Number(fn[2]),
                hit: fn[3] === "-" ? 0 : Number(fn[3]),
              });
            }
            break;
          }
        }
      }

      if (line.indexOf("end_of_record") > -1) {
        item && data.push(item);
        item = {
          file: "",
          title: "",
          lines: {
            found: 0,
            hit: 0,
            details: [],
          },
          functions: {
            hit: 0,
            found: 0,
            details: [],
          },
          branches: {
            hit: 0,
            found: 0,
            details: [],
          },
        };
      }
    }

    if (data.length) {
      resolve(data);
    } else {
      reject("Failed to parse string");
    }
  });
}

export function parse(file: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    exists(file, (exists) => {
      !exists
        ? walkFile(file).then(resolve).catch(reject)
        : readFile(file, "utf8", (_, str) => {
            walkFile(str).then(resolve).catch(reject);
          });
    });
  });
}
