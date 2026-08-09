import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";

export function createGoogleAuthClient(clientId: string) {
  return createAuthClient({
    plugins: [
      oneTapClient({
        clientId,
        autoSelect: false,
        promptOptions: {
          fedCM: true,
          maxAttempts: 1
        }
      })
    ]
  });
}
