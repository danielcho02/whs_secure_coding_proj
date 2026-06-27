# Pipes

Global request validation is configured in `src/main.ts` with:

```ts
ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

Feature-specific pipes can be added here when domain modules are implemented.
