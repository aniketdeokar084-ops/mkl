# Contributing to FocusFlow

First off, thank you for considering contributing to FocusFlow! It's people like you that make FocusFlow such a great tool for productivity.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful and inclusive.
- Provide constructive feedback.
- Harassment or abusive behavior will not be tolerated.

## How to Report Bugs

When filing an issue, make sure to answer these five questions:
1. What version of FocusFlow are you using?
2. What operating system and browser are you using?
3. What did you do?
4. What did you expect to see?
5. What did you see instead?

Please include any errors from the browser console and/or screenshots to help us identify the issue.

## How to Suggest Features

We welcome feature requests! Please provide:
1. A clear and concise description of what the feature is.
2. The specific use case or problem this feature solves.
3. Any alternatives you've considered.

## Development Setup

1. Fork the repo and clone it to your local machine.
2. Navigate to the directory: `cd focusflow`
3. Serve the static files. You can use Python's built-in server:
   `python -m http.server 8000`
   or Node's HTTP server:
   `npx serve`
4. Open your browser and navigate to `http://localhost:8000`.

## Code Style Guidelines

- **Vanilla JS**: No frameworks (React, Vue, etc.) unless strictly necessary and discussed beforehand.
- **ES Modules**: Use `import` and `export` to keep code modular.
- **JSDoc**: Document all public functions, components, and non-trivial logic using JSDoc.
- **No Global Variables**: Encapsulate logic within modules or classes.
- **Security**: Always sanitize user inputs. Use `textContent` instead of `innerHTML` when displaying user-generated data.
- **Accessibility**: Ensure new UI components are keyboard navigable and use correct ARIA attributes.

## Pull Request Process

1. Fork the repository and create a new branch (`git checkout -b feature/your-feature-name`).
2. Make your changes and test them thoroughly.
3. Commit your changes. Use clear, descriptive commit messages.
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request (PR). Fill out the PR template completely.
6. Wait for code review. We will review your PR and provide feedback as soon as possible.
