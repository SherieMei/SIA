# Atlas to Firebase migration

Target project: `siaa-20635`. Each MySQL table becomes a Firestore collection.
Primary keys become document IDs; foreign key values and column types are preserved
as returned by PDO. SQL JSON remains a string. Empty tables have no documents.
This copies database records, not the media files referenced by their paths.
It does not switch the application away from PHP/MySQL.

The CLI export includes password hashes. Keep exports and administrator keys
outside the website and Git. The importer removes passwords from Firestore
and imports bcrypt accounts into Firebase Authentication with the same user IDs.
Roles are preserved in app_users; application access rules and login migration
are separate work. This tool does not deploy security rules or grant client access.

1. Enable Firebase Authentication's Email/Password provider and create Firestore.
2. Obtain an administrator service-account key for this project and save it outside
   the web root (never paste it into chat).
3. Export a fresh snapshot:

```sh
/Applications/XAMPP/xamppfiles/bin/php tools/firebase-migration/export.php /private/tmp/atlas-export.json
```

4. Check the data without making remote changes:

```sh
node tools/firebase-migration/import.mjs /private/tmp/atlas-export.json
```

5. Install the importer dependencies and apply:

```sh
cd tools/firebase-migration
npm install
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/website/firebase-admin.json node import.mjs /private/tmp/atlas-export.json --apply
```

Destination accounts and documents must be absent. The importer checks for
their respective destinations. Use `--firestore-only` to import database records
without login accounts, then `--auth-only` once Firebase Authentication is enabled.
These flags can be used with `--apply` or a dry run.

The importer checks for
collisions and refuses to overwrite them. It rejects unsupported password hashes
and oversized documents before contacting Firebase. Authentication and multiple
Firestore batches cannot be committed together atomically. If interrupted or an
import fails, inspect the partial destination before retrying; automatic retries
will stop on existing records. Firestore contents are checked after upload.
SQL constraints, joins, cascade deletion and indexes need application-specific
implementation; copying rows does not reproduce those behaviors.

Pause app writes and export again immediately before the final migration if the
local app has changed since the snapshot. Keep MySQL until the Firebase app has
been migrated and verified.
