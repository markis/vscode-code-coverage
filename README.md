# Code Coverage

Code Coverage is a powerful Visual Studio Code extension that helps you analyze and improve the test coverage of your codebase. It highlights lines of code that are not covered by tests, providing valuable insights into areas that require additional testing. With Code Coverage, you can easily identify and track the coverage status of your project, improving its overall quality and reliability.

![Demo](images/demo.png)

## Features

* **Comprehensive Coverage Analysis:** Code Coverage identifies and highlights lines of code that are not covered by tests, allowing you to focus on improving the areas with low coverage.

* **Efficient Resource Usage:** With a small memory and processor footprint, Code Coverage seamlessly integrates into your development workflow without impacting your productivity.

* **Support for Multiple lcov File Formats:** Code Coverage supports multiple lcov file formats, enabling you to use your language's code coverage tools and seamlessly integrate them with the extension.

## Getting Started

To start using Code Coverage, follow these simple steps:

1. Generate `.lcov` coverage files using your preferred code coverage tools for your programming language.

2. In Visual Studio Code, navigate to the extension settings by clicking on the gear icon in the sidebar and selecting "Settings" (or by using the shortcut `Ctrl+,` on Windows or `Cmd+,` on Mac).

3. Locate the "Coverage Location" setting (`markiscodecoverage.searchCriteria`) and set it to the path where your coverage files are located. The default value is `coverage/lcov*.info`, but you can customize it to match your project's setup.

4. Optionally, you can modify the default behavior of Code Coverage by changing the "Enable on Startup" setting (`markiscodecoverage.enableOnStartup`). By default, Code Coverage is enabled when Visual Studio Code starts, but you can disable this behavior if desired.

5. Open your project in Visual Studio Code and navigate to the file you want to analyze. Code Coverage will automatically highlight the uncovered lines under the Problems window, providing you with a clear overview of your project's coverage status.

## Commands

Code Coverage provides the following commands that you can use to control the display of coverage information. You can also map these commands to custom key bindings in Visual Studio Code to further streamline your workflow.

* `code-coverage.hide`: Hides the code coverage overlay, allowing you to focus on your code without the distraction of coverage highlighting.

* `code-coverage.show`: Shows the code coverage overlay, highlighting the lines of code that are not covered by tests.

To map these commands to key bindings, refer to the [official Visual Studio Code documentation](https://code.visualstudio.com/docs/getstarted/keybindings).

## Feedback and Contributions

We welcome your feedback and contributions to make Code Coverage even better. If you encounter any issues, have suggestions for improvements, or would like to contribute to the project, please visit our [GitHub repository](https://github.com/markis/vscode-code-coverage) and open an issue or pull request.

## License

Code Coverage is released under the [MIT License](LICENSE).

## About the Author

This extension is developed and maintained by [Markis Taylor](https://markis.codes). Feel free to reach out to me with any questions or feedback you may have.
