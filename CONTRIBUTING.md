# Contributing to ResearchInk (研墨)

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/sixtdreanight/ResearchInk.git
cd ResearchInk
pip install -e ".[dev]"
pytest
```

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pytest` to verify all tests pass
4. Add tests for new functionality
5. Commit using [Conventional Commits][conv] format
6. Push and open a pull request

## Commit Convention

```
feat: add Zotero integration plugin
fix: sanitize plugin execution scope
refactor: extract SecurityManager from engine
test: add plugin sandbox tests
docs: update plugin API guide
```

Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `ci`

## Code Style

- Full type hints on all public functions
- Use Pydantic models for data validation
- Functions under 50 lines; files under 800 lines
- Follow PEP 8
- Plugin APIs must document security boundaries

## Plugin Development

See [plugin_schema/API.md](plugin_schema/API.md) for the plugin API guide.

- All plugins must pass security review
- Third-party plugins require user consent dialog
- Never expose raw `engine` internals to plugins

## Pull Request Checklist

- [ ] All tests pass (`pytest`)
- [ ] Type hints added for new public APIs
- [ ] New tests added for new behavior
- [ ] Plugin API changes documented in `plugin_schema/API.md`
- [ ] Security implications considered for any plugin-facing code

## Questions?

Open a [discussion](https://github.com/sixtdreanight/ResearchInk/discussions).

[conv]: https://www.conventionalcommits.org/
