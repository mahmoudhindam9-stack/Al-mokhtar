Al Mokhtar ERP — Offline Desktop Package
========================================

START
1. Extract the entire ZIP archive to a normal folder.
2. Double-click setup.bat once to create the desktop shortcut and launch the app.
3. Use the "Al Mokhtar ERP" desktop shortcut next time.

OFFLINE BEHAVIOR
- Core screens use the local browser store and IndexedDB.
- The app can open without an internet connection after this package has been prepared.
- Keep the same Windows/browser profile to retain local offline data.
- Cloud synchronization requires an authenticated Supabase account and a working connection.
- Changes stay local if the connection is unavailable. The synchronization indicator reports the current state.
- If the app detects concurrent local and cloud changes, choose which snapshot to keep; it will not overwrite either version automatically.

LIMITATIONS
- Features that call online services, such as AI chat and remote GitHub release operations, need internet and their own service credentials.
- A static local launch is not a full local copy of the Supabase backend. Database-dependent features that have not been moved to the local ERP store need a cloud connection.
- Do not delete the extracted application folder while using the desktop shortcut.
