import * as fs from 'fs';
import * as path from 'path';
import { Coverage, CoverageCollection } from './coverage-info';

function walkFile(str: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    let data: CoverageCollection = []
    let item: Coverage;
    const lines = ['end_of_record'].concat(str.split('\n'));

    for (let line of lines) {
      line = line.trim();
      const allparts = line.split(':');
      const parts = [allparts.shift(), allparts.join(':')];

      switch (parts[0].toUpperCase()) {
        case 'TN': {
          item.title = parts[1].trim();
          break;
        } case 'SF': {
          item.file = parts.slice(1).join(':').trim();
          break;
        } case 'FNF': {
          item.functions.found = Number(parts[1].trim());
          break;
        } case 'FNH': {
          item.functions.hit = Number(parts[1].trim());
          break;
        } case 'LF': {
          item.lines.found = Number(parts[1].trim());
          break;
        } case 'LH': {
          item.lines.hit = Number(parts[1].trim());
          break;
        } case 'DA': {
          const details = parts[1].split(',');
          item.lines.details.push({
            line: Number(details[0]),
            hit: Number(details[1])
          });
          break;
        } case 'BRF': {
          item.branches.found = Number(parts[1]);
          break;
        } case 'BRH': {
          item.branches.hit = Number(parts[1]);
          break;
        } case 'FN': {
          const fn = parts[1].split(',');
          item.functions.details.push({
            name: fn[1],
            line: Number(fn[0])
          });
          break;
        } case 'FNDA': {
          const fn = parts[1].split(',');
          item.functions.details.some((i, k) => {
            if (i.name === fn[1] && i.hit === undefined) {
              item.functions.details[k].hit = Number(fn[0]);
              return true;
            }
          });
          break;
        } case 'BRDA': {
          const fn = parts[1].split(',');
          item.branches.details.push({
            line: Number(fn[0]),
            block: Number(fn[1]),
            branch: Number(fn[2]),
            hit: ((fn[3] === '-') ? 0 : Number(fn[3]))
          });
          break;
        }
      }

      if (line.indexOf('end_of_record') > -1) {
        data.push(item);
        item = {
          file: '',
          title: '',
          lines: {
            found: 0,
            hit: 0,
            details: []
          },
          functions: {
            hit: 0,
            found: 0,
            details: []
          },
          branches: {
            hit: 0,
            found: 0,
            details: []
          }
        };
      }
    }

    data.shift();

    if (data.length) {
      resolve(data);
    } else {
      reject('Failed to parse string');
    }
  });
};

export function parse(file: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    fs.exists(file, exists => {
      const promises: Array<Promise<CoverageCollection>> = [];
      !exists ?
        walkFile(file).then(resolve).catch(reject) :
        fs.readFile(file, 'utf8', (err, str) => {
          walkFile(str).then(resolve).catch(reject);
        });
    });
  });
};
