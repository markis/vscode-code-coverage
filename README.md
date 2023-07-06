# Code Coverage

Code coverage will highlight lines of code that are not covered by tests. It will list the uncovered lines under the problems window. And it conveniently shows the coverage ratio in the status bar.

![Demo](images/demo.png)

## Features

* Small memory and processor footprint
* Multiple lcov file handler

## Setup

* Generate `.lcov` coverage files using your language's code coverage tools
* Set the coverage location setting `markiscodecoverage.searchCriteria`, default: `coverage/lcov*.info`
* Optionally set the default behavior with `markiscodecoverage.enableOnStartup`, default: `true`

## Commands

There are commands to hide and show lines of coverage. Also, it's possible to map commands to [key bindings](https://code.visualstudio.com/docs/getstarted/keybindings) in vscode.

* `code-coverage.hide` will hide the code coverage
* `code-coverage.show` will show the code coverage
