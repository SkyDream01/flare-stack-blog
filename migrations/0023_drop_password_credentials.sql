-- Users sign in with GitHub or a Sign-in Code; passwords are gone (ADR 0030).
-- Delete the stored password hashes. A User with no other account row keeps
-- their User row and signs in next time with a Sign-in Code to the same email.
DELETE FROM `account` WHERE `provider_id` = 'credential';
--> statement-breakpoint
-- Pending password-reset tokens can no longer be redeemed. Email-verification
-- links were stateless JWTs and left no rows here.
DELETE FROM `verification` WHERE `identifier` LIKE 'reset-password:%';
