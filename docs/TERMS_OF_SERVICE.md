# Drive Therapy — Terms of Service

- **Effective Date**: November 20, 2026
- **Version**: `2.2.0`
- **Public HTML Endpoint**: `/terms` (`public/terms.html`)

---

## 1. Open-Source License (`AGPL-3.0-or-later`)

Drive Therapy is free and open-source software licensed under the **GNU Affero General Public License v3.0 or later (`SPDX-License-Identifier: AGPL-3.0-or-later`)**.

- You may freely run, study, self-host, and modify Drive Therapy.
- Under Section 13 of the AGPL-3.0, if you modify Drive Therapy or operate it as a network-accessible service (SaaS), you must make the complete Corresponding Source of your version available to all network users under the AGPL-3.0 and preserve all creator attribution notices in [`NOTICE`](../NOTICE).

---

## 2. Non-Destructive Operation & User Responsibilities

- Drive Therapy is architected to be non-destructive: curation metadata is stored in IndexedDB (`drive_therapy_catalog_v2`) and optional `.xmp` sidecar files, and any operation that mutates or deletes files requires explicit confirmation via the in-app confirmation dialog.
- You are responsible for maintaining backups of your Google Workspace and local files and for securing any local workstation or server on which you run Drive Therapy.

---

## 3. Disclaimer of Warranty

Drive Therapy is provided on an **"AS IS"** basis, without warranties or conditions of any kind, either express or implied, including without limitation any warranties of merchantability, fitness for a particular purpose, or non-infringement.
