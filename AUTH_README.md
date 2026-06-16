# Authentication and Roles

This document describes the authentication system from the production-style application.

In the public demo, authentication is simplified: the app automatically creates a demo session and uses mock users from `db/demoData.js`. The production-style authentication files are kept so reviewers can inspect how the real application is structured.

## Production-Style Design

The real application is designed around:

- `bcryptjs` for password hashing.
- `express-session` for sessions.
- MySQL-backed user records.
- Route protection middleware.
- Role-based access control.

## Demo Behavior

The public demo does not validate passwords against a database.

Default session:

```text
username: demo_admin
role:     admin
```

You can submit `demo_comercial` in the login form to simulate a `comercial_pro` role.

## Relevant Files

- `models/userModel.js`: production-style user model.
- `controllers/authController.js`: production-style login/logout logic.
- `middleware/auth.js`: route protection and role middleware.
- `views/login.ejs`: login page.
- `scripts/createUser.js`: production-style user creation script.
- `api/index.js`: demo runtime session setup.
- `routes/demo.js`: demo session behavior.

## Production User Creation

In a real deployment, users can be created with:

```bash
node scripts/createUser.js
```

The script asks for:

1. Username.
2. Email.
3. Password.

Passwords are hashed before storage.

## Role Model

The UI supports these roles:

- `admin`: full access.
- `comercial`: limited commercial workflow access.
- `comercial_pro`: commercial workflow plus selected advanced areas.

## Security Notes for Production

For a real deployment:

1. Set a strong `SESSION_SECRET`.
2. Use HTTPS.
3. Run with `NODE_ENV=production`.
4. Store sessions in a persistent store.
5. Add login rate limiting.
6. Consider two-factor authentication for administrators.

## Public Demo Safety

The public demo:

- Does not store real users.
- Does not validate real passwords.
- Does not connect to MySQL.
- Does not contain production credentials.
