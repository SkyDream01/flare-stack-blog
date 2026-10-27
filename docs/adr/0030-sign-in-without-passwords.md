# Sign in without passwords

A User signs in with GitHub or with a Sign-in Code emailed to them; password sign-in, registration, password reset and password change are removed, and a migration deletes the stored password hashes. Readers found registering with a password too much friction to leave a comment, and few remember a password for a blog they rarely visit. We lowered that friction instead of adding guest comments, because Comments stay public immediately (ADR 0010) and Muting binds to a User (ADR 0017), both of which rely on every Comment having a verified email behind it.

## Considered Options

- **Guest comments.** Rejected: guests have no verified identity, so immediate publishing, Muting, author deletion and reply notifications to an unverified address would all need new mechanisms.
- **Magic link.** Rejected for the Sign-in Code: links open in the mail app's built-in browser or on another device, leaving the session in the wrong browser, and mail scanners that prefetch links consume the single-use token.
- **More OAuth providers (Google).** Rejected: each provider adds console setup for every site owner.

## Consequences

Email users cannot sign in while email delivery is broken or out of quota; GitHub sign-in does not depend on email and is how the first User becomes the Admin, so the site stays manageable. A first-time email sign-in creates the User and asks for a public name in the same flow. Sessions last 30 days and slide on use, so infrequent readers rarely need a new code.
