export type CoverageCollection = Coverage[];

export interface Coverage {
  branches: CoverageInfoCollection<BranchCoverageInfo>;
  functions: CoverageInfoCollection<FunctionCoverageInfo>;
  lines: CoverageInfoCollection<LineCoverageInfo>;
  title: string;
  file: string;
}

export interface CoverageInfoCollection<T> {
  found: number;
  hit: number;
  details: T[];
}

export interface LineCoverageInfo {
  hit: number;
  line: number;
}

export interface BranchCoverageInfo {
  block: number;
  branch: number;
  line: number;
  hit: number;
}

export interface FunctionCoverageInfo {
  hit?: number;
  line: number;
  name: string;
}
