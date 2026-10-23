
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB_NAME || "Sheet1";

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!SPREADSHEET_ID || !clientEmail || !privateKey) {
    throw new Error(
      "Google Sheets configuration is missing. Check GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY."
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export type GoogleSheetSpin = {
  requestId: string;
  customerName: string;
  phoneNumber: string;
  billAmount: number;
  storeName: string;
  prizeName: string;
  timestamp: string;
};

export async function appendToGoogleSheet(
  data: GoogleSheetSpin
): Promise<{ added: boolean }> {
  const sheets = getSheetsClient();

  const escapedTab = `'${SHEET_TAB.replace(/'/g, "''")}'`;
  const spreadsheetId = SPREADSHEET_ID!;

  // Check existing Request IDs in column G before appending.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab}!G2:G`,
  });

  const existingIds = (existing.data.values ?? []).flat().map(String);

  if (existingIds.includes(data.requestId)) {
    console.log("Spin already exists in Google Sheets:", data.requestId);
    return { added: false };
  }

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${escapedTab}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        data.customerName,
        data.phoneNumber,
        data.billAmount,
        data.storeName,
        data.prizeName,
        data.timestamp,
        data.requestId,
      ]],
    },
  });

  console.log(
    "Google Sheets row appended:",
    result.data.updates?.updatedRange
  );

  return { added: true };
}
