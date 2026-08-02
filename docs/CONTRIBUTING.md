# Contributing

## Rules

- Keep the repository platform-first.
- Do not add app-specific business logic.
- Use strict TypeScript.
- Do not use `any`.
- Prefer immutable values.
- Return `Result<T, E>` for expected failures.
- Keep packages independently testable.
- Update documentation with architectural changes.

## Commits

Use Conventional Commits:

- `feat(kernel): initialize kernel`
- `feat(event): add event bus`
- `feat(workflow): implement runtime`
- `fix(kernel): resolve Result bug`
- `docs: update architecture`

