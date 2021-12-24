# Contributing

The `.vscode` folder contains launch configurations so you can test the extension.

### Get started

- Clone the repo
- Install dependencies - `npm install`
- Run tests - `npm test`
- Open VSCode and run the `Launch Extension` target

### Tests

#### VSCode extension host

Tests need to be run by the VSCode extension host, there are launch configurations provided to launch the extension in debug mode and test mode.

They then run as a Mocha test suite in the extension host, so their output isn't usually visible.

#### Automated tests

Running `npm test` will launch VSCode and run the integration tests against the running instance.

### Design considerations

Based on the nature of multi-root workspaces and how they operate, it means that the search criteria apply to all workspace folders at once.

In general this makes sense, as most projects will always have their coverage under `coverage/lcov*.info`.

However, in some cases this may be undesirable, so we may go back to it, possibly by adding another boolean configuration option such as `relative`, which would then mean the `searchCriteria` would require the name or path of the workspace folder along with the subpath.
