-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "nif" TEXT NOT NULL DEFAULT '',
    "addressStreet" TEXT NOT NULL DEFAULT '',
    "addressCity" TEXT NOT NULL DEFAULT '',
    "addressProvince" TEXT NOT NULL DEFAULT '',
    "addressZip" TEXT NOT NULL DEFAULT '',
    "addressCountry" TEXT NOT NULL DEFAULT 'España',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "defaultVatRate" REAL NOT NULL DEFAULT 21,
    "defaultIrpfRate" REAL NOT NULL DEFAULT 15,
    "emailSubject" TEXT NOT NULL DEFAULT 'Documento {{number}} de {{company}}',
    "emailBody" TEXT NOT NULL DEFAULT 'Adjuntamos el documento {{number}}.

Un saludo,
{{company}}',
    "bankIban" TEXT,
    "bankName" TEXT,
    "themeBg" TEXT NOT NULL DEFAULT '#f3efe6',
    "themeBgElevated" TEXT NOT NULL DEFAULT '#faf7f0',
    "themeInk" TEXT NOT NULL DEFAULT '#1a2332',
    "themeInkMuted" TEXT NOT NULL DEFAULT '#5c6b7a',
    "themeLine" TEXT NOT NULL DEFAULT '#d4cbb8',
    "themeAccent" TEXT NOT NULL DEFAULT '#0d6e6e',
    "themeAccentHover" TEXT NOT NULL DEFAULT '#0a5858',
    "themeAccentSoft" TEXT NOT NULL DEFAULT '#e0f0ef',
    "themeSidebar" TEXT NOT NULL DEFAULT '#1a2332',
    "themeSidebarText" TEXT NOT NULL DEFAULT '#e8e4db',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("addressCity", "addressCountry", "addressProvince", "addressStreet", "addressZip", "bankIban", "bankName", "createdAt", "defaultIrpfRate", "defaultVatRate", "email", "emailBody", "emailSubject", "id", "logoUrl", "name", "nif", "phone", "updatedAt") SELECT "addressCity", "addressCountry", "addressProvince", "addressStreet", "addressZip", "bankIban", "bankName", "createdAt", "defaultIrpfRate", "defaultVatRate", "email", "emailBody", "emailSubject", "id", "logoUrl", "name", "nif", "phone", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
