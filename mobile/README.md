# Mobile App (Expo)

Fast launch mobile client for VA Beta.

## Setup

1. `cd mobile`
2. `npm install`
3. `npx expo start`

## Environment

Set API base URL before launching:

- `EXPO_PUBLIC_API_BASE_URL=https://yourdomain.com`

## Screens

- Home
- Jobs
- Earnings
- Messages
- Profile

## Voice Flow

Current build uses a simulated voice command trigger for fastest rollout.
Hook microphone capture to Whisper in a later phase and send transcribed text to `/api/voice/command`.
