import { google } from "googleapis";

export function getGoogleClient(accessToken: string) {
  const auth = new google.auth.OAuth2();

  auth.setCredentials({
    access_token: accessToken,
  });

  return {
    auth,
    sheets: google.sheets({ version: "v4", auth }),
    gmail: google.gmail({ version: "v1", auth }),
    calendar: google.calendar({ version: "v3", auth }),
  };
}
