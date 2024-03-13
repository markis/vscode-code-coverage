import { existsSync, readFile } from "fs";
import { Coverage, CoverageCollection } from "./coverage-info";

type MetricsMap = {
  [key: string]: (item: Coverage, value: string) => void;
};

/**
 * @description This method creates a new Coverage object with default values.
 */
function createCoverageItem(): Coverage {
  return {
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

/**
 * @description This object maps lcov metrics to a handler function.
 */
const metricsMap: MetricsMap = {
  TN: (item, val) => {
    item.title = val;
  },
  SF: (item, val) => {
    item.file = val;
  },
  LF: (item, val) => {
    item.lines.found = Number(val);
  },
  LH: (item, val) => {
    item.lines.hit = Number(val);
  },
  DA: (item, val) => {
    const [line, hit, ..._] = val.split(",").map((v) => Number(v));
    item.lines.details.push({ line, hit });
  },
  FNF: (item, val) => {
    item.functions.found = Number(val);
  },
  FNH: (item, val) => {
    item.functions.hit = Number(val);
  },
  FNDA: (item, val) => {
    const [line, name, ..._] = val.split(",");
    item.functions.details.push({ line: Number(line), name });
  },
  BRF: (item, val) => {
    item.branches.found = Number(val);
  },
  BRH: (item, val) => {
    item.branches.hit = Number(val);
  },
  BRDA: (item, val) => {
    const [line, block, branch, hit, ..._] = val
      .split(",")
      .map((v) => (v === "-" ? 0 : Number(v)));
    item.branches.details.push({ line, block, branch, hit });
  },
};

/**
 * @description Parses a string of lcov data into a CoverageCollection
 * @param str The string to parse
 * @returns A CoverageCollection
 */
function parseFile(str: string): CoverageCollection {
  const data: CoverageCollection = [];
  const lines = str.split("\n");
  let item = createCoverageItem();

  for (const line of lines) {
    const trimmedLine = line.trim();
    const allParts = trimmedLine.split(":");
    const metrics = allParts[0];
    const args = allParts.slice(1).join(":");

    if (metrics) {
      const handler = metricsMap[metrics.toUpperCase()];
      if (handler) {
        try {
          handler(item, args.trim());
        } catch (e) {
          console.error(`Error parsing line: ${line}`);
          console.error(e);
        }
      }
    }

    if (trimmedLine.includes("end_of_record")) {
      if (item) {
        data.push(item);
      }
      item = createCoverageItem();
    }
  }

  return data;
}

/**
 * @description Parses a file of lcov data into a CoverageCollection
 * @param file The file to parse
 * @returns A CoverageCollection
 * @throws Error if the file does not exist
 */
export async function parse(file: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    !existsSync(file)
      ? reject(new Error(`File not found: ${file}`))
      : readFile(file, "utf8", (_, str) => {
          resolve(parseFile(str));
        });
  });
}
