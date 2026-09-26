# API contracts

One file per feature that spans FullScanServer and FullScanApp, written before either side is built:
method, path, auth scope, request body, response body, and status/error codes. The server implements it,
the app's repository consumes it — when they disagree, this file decides (or gets updated first).
