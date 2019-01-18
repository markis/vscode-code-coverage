# Code Coverage

[![Greenkeeper badge](https://badges.greenkeeper.io/markis/vscode-code-coverage.svg)](https://greenkeeper.io/)

Code coverage will put squiggly lines under functions, lines or code branches that are not covered by unit tests. And will list the uncovered lines under the problems window.

![Demo](images/demo.png)

## Features

* Simple and easy to use
* Small memory and processor footprint
* Multiple lcov file handler

## Setup

* Ensure your project has generated lcov file(s) using [nyc](https://www.npmjs.com/package/nyc), [istanbul](https://www.npmjs.com/package/istanbul) or other code coverage tools.
* Update the `markiscodecoverage.searchCriteria` setting, default: `coverage/lcov*.info`
