import * as assert from "assert";
import { DecorationOptions, MarkdownString, Range } from "vscode";
import { Coverage } from "../../src/coverage-info";
import {
  UNCOVERED_LINE_MESSAGE,
  mapDecorationOptions,
} from "../../src/coverage-decorations";

interface Test {
  coverage: Coverage;
  expected: DecorationOptions[];
}

interface TestMap {
  [key: string]: Test;
}

suite("mapDecorationOptions", () => {
  function generateCoverage(
    found: number,
    hit: number,
    details: Array<{ hit: number; line: number }>,
  ): Coverage {
    return {
      lines: { found, hit, details },
      branches: { found: 0, hit: 0, details: [] },
      functions: { found: 0, hit: 0, details: [] },
      title: "Test Coverage",
      file: "testFile.ts",
    };
  }
  function generateDecorationOptions(
    ranges: Array<[number, number, number, number]>,
  ): DecorationOptions[] {
    return ranges.map((range) => ({
      hoverMessage: new MarkdownString(UNCOVERED_LINE_MESSAGE),
      range: new Range(...range),
    }));
  }

  const tests: TestMap = {
    "should return the correct decoration for blank file": {
      coverage: generateCoverage(0, 0, []),
      expected: generateDecorationOptions([]),
    },
    "should return the correct decoration for 0 uncovered lines": {
      coverage: generateCoverage(1, 1, [{ hit: 1, line: 1 }]),
      expected: generateDecorationOptions([]),
    },
    "should return the correct decoration for 1 uncovered line": {
      coverage: generateCoverage(1, 0, [{ hit: 0, line: 1 }]),
      expected: generateDecorationOptions([[0, 1, 0, 1]]),
    },
    "should return the correct decoration for 2 uncovered lines": {
      coverage: generateCoverage(5, 2, [
        { hit: 1, line: 1 },
        { hit: 0, line: 2 },
        { hit: 1, line: 3 },
        { hit: 1, line: 4 },
        { hit: 0, line: 5 },
      ]),
      expected: generateDecorationOptions([
        [1, 1, 1, 1],
        [4, 1, 4, 1],
      ]),
    },
    "should return the correct decoration for 2 uncovered lines, out of order":
      {
        coverage: generateCoverage(5, 2, [
          { hit: 0, line: 5 },
          { hit: 1, line: 4 },
          { hit: 1, line: 3 },
          { hit: 0, line: 2 },
          { hit: 1, line: 1 },
        ]),
        expected: generateDecorationOptions([
          [1, 1, 1, 1],
          [4, 1, 4, 1],
        ]),
      },
    "should return the correct decoration for multiple ranges of uncovered lines":
      {
        coverage: generateCoverage(5, 2, [
          { hit: 1, line: 1 },
          { hit: 0, line: 2 },
          { hit: 1, line: 3 },
          { hit: 0, line: 4 },
          { hit: 0, line: 5 },
          { hit: 1, line: 6 },
          { hit: 0, line: 7 },
          { hit: 0, line: 8 },
          { hit: 0, line: 9 },
        ]),
        expected: generateDecorationOptions([
          [1, 1, 1, 1],
          [3, 1, 4, 1],
          [6, 1, 8, 1],
        ]),
      },
  };

  Object.entries(tests).forEach(([testName, args]) => {
    test(testName, () => {
      assert.deepStrictEqual(
        mapDecorationOptions(args.coverage),
        args.expected,
      );
    });
  });
});
