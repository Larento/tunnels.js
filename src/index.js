import * as packetriot from "./packetriot/index.js";
import * as cloudflare from "./cloudflare/index.js";
import { NAMES, PATHS, SCR_ERROR, readYamlConfig } from "./util.js";

const credentials = readYamlConfig(PATHS.CREDS_PATH);
const definedTunnels = readYamlConfig(PATHS.TUNNELS_PATH);

const cfToken = credentials.cloudflare.token;
const prAccounts = credentials.packetriot.accounts;
const cookie = packetriot.cookie;

const cf = cloudflare.init(cfToken);
const zone = await cloudflare.findZone(cf, credentials.hostname);
console.log(`Zone ID: ${zone.id}`);

const availableAccounts = packetriot.account.getAvailable(prAccounts);
console.log(
  `Available accounts: ${JSON.stringify(Array.from(availableAccounts))}`
);

for (let i = 0; i < definedTunnels.length; i++) {
  await authorize(definedTunnels[i]);
}

async function authorize(tunnel) {
  const account = tunnel.account;
  console.log(`Account: ${account}`);

  if (!availableAccounts.has(account)) {
    console.warn(SCR_ERROR.ACCOUNT_NOT_FOUND(tunnel, account));
    return;
  }

  let sessionID = cookie.load(
    PATHS.COOKIES_PATH,
    account,
    NAMES.SESSION_ID_COOKIE_KEY
  );

  if (!sessionID) {
    cookie.createFile(PATHS.COOKIES_PATH, availableAccounts);
    sessionID = await cookie.getSessionIDCookie(prAccounts, account);
    cookie.updateFile(PATHS.COOKIES_PATH, account, sessionID);
  }

  console.log(`Account: ${account}; Session ID: ${sessionID.value}`);
}
