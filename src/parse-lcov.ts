import { existsSync, readFile } from "fs";
import { Coverage, CoverageCollection } from "./coverage-info";

type MetricsMap = {
  [key: string]: (item: Coverage, args: string) => void;
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
  TN: (item: Coverage, args: string) => (item.title = args.trim()),
  SF: (item: Coverage, args: string) => (item.file = args.trim()),
  LF: (item: Coverage, args: string) =>
    (item.lines.found = Number(args.trim())),
  LH: (item: Coverage, args: string) => (item.lines.hit = Number(args.trim())),
  DA: (item: Coverage, args: string) => {
    const details = args.split(",");
    item.lines.details.push({
      line: Number(details[0]),
      hit: Number(details[1]),
    });
  },
  FNF: (item: Coverage, args: string) =>
    (item.functions.found = Number(args.trim())),
  FNH: (item: Coverage, args: string) =>
    (item.functions.hit = Number(args.trim())),
  FNDA: (item: Coverage, args: string) => {
    const details = args.split(",");
    item.functions.details.push({
      line: Number(details[0]),
      name: details[1],
    });
  },
  BRF: (item: Coverage, args: string) =>
    (item.branches.found = Number(args.trim())),
  BRH: (item: Coverage, args: string) =>
    (item.branches.hit = Number(args.trim())),
  BRDA: (item: Coverage, args: string) => {
    const details = args.split(",");
    item.branches.details.push({
      line: Number(details[0]),
      block: Number(details[1]),
      branch: Number(details[2]),
      hit: details[3] === "-" ? 0 : Number(details[3]),
    });
  },
};

/**
 * @description Parses a string of lcov data into a CoverageCollection
 * @param str The string to parse
 * @returns A CoverageCollection
 */
function parseFile(str: string): CoverageCollection {
  let data: CoverageCollection = [];
  let item: Coverage = createCoverageItem();
  const lines = str.split("\n");

  for (let line of lines) {
    line = line.trim();
    const allparts = line.split(":");
    const metrics = allparts.shift();
    const args = allparts.join(":");

    if (item && metrics) {
      const handler = metricsMap[metrics.toUpperCase()];
      if (handler) {
        handler(item, args);
      }
    }

    if (line.indexOf("end_of_record") > -1) {
      item && data.push(item);
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
