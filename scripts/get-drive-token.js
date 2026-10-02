import 'dotenv/config';
import http from 'node:http';
import { OAuth2Client } from 'google-auth-library';

const PORT = 53682;

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

const redirectUri =
  GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/callback`;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error(
    'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.'
  );
  process.exit(1);
}

const client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  redirectUri
);

const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/drive',
  ],
});

console.log(
  '\nOpen this URL in your browser and sign in with the Google account that owns the Bleeve Creations Drive:\n'
);

console.log(url);
console.log('\n');

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, redirectUri);

  if (requestUrl.pathname !== '/callback') {
    res.statusCode = 404;
    return res.end('Not found');
  }

  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  if (error) {
    res.statusCode = 400;
    res.end('Google authorization was not completed. Check the terminal.');
    console.error(`Google OAuth error: ${error}`);
    server.close();
    return;
  }

  if (!code) {
    res.statusCode = 400;
    res.end('Authorization code was not provided.');
    console.error('No authorization code received.');
    server.close();
    return;
  }

  try {
    const { tokens } = await client.getToken(code);

    res.end(
      'Authorization successful. You can close this tab and return to the terminal.'
    );

    if (!tokens.refresh_token) {
      console.error(
        '\nNo refresh token was returned.'
      );
      console.error(
        'If this Google account has already authorized this app, revoke the existing authorization and try again.'
      );
    } else {
      console.log(
        '\nGoogle OAuth authorization successful.\n'
      );

      console.log(
        'Add the following to your local .env and Vercel environment variables:\n'
      );

      console.log(
        `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`
      );
    }
  } catch (err) {
    res.statusCode = 500;
    res.end('OAuth error. Check the terminal.');

    console.error('\nOAuth token exchange failed:');
    console.error(err.message);
  }

  server.close();
});

server.listen(PORT, () => {
  console.log(
    `OAuth callback server listening on ${redirectUri}`
  );
});