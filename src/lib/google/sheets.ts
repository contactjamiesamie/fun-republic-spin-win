import { google } from 'googleapis';
import path from 'path';

export async function appendToGoogleSheet(data: {
  customerName: string;
  phoneNumber: string;
  billAmount: number;
  storeName: string;
  prizeName: string;
  timestamp: string;
}) {
  try {
    if (!process.env.GOOGLE_SHEET_ID) {
      console.error('Missing GOOGLE_SHEET_ID in .env.local!');
      return;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:F', 
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            data.customerName,
            data.phoneNumber,
            data.billAmount,
            data.storeName,
            data.prizeName,
            data.timestamp, // Placed at the end (Column F)
          ],
        ],
      },
    });

    console.log('Successfully appended row to Google Sheet:', response.data.updates?.updatedRange);
  } catch (error) {
    console.error('DETAILED Google Sheets API Error:', error);
    throw error;
  }
}