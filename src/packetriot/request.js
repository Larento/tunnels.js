import got from "got";
import { NAMES, PATHS, SCR_ERROR } from "../util.js";

const URLBase = new URL(NAMES.PACKETRIOT_HOME);
const loginURL = new URL(NAMES.PACKETRIOT_LOGIN, URLBase);
const domainsURL = new URL(NAMES.PACKETRIOT_DOMAINS, URLBase);
const tunnelsURL = new URL(NAMES.PACKETRIOT_TUNNELS, URLBase);

async function loginGet(cookieJar) {
  return await got.get(loginURL, { cookieJar });
}

async function loginPost(cookieJar, credentials) {
  return await got.post(loginURL, {
    cookieJar,
    form: {
      email: credentials.email,
      password: credentials.password,
      google: "",
    },
  });
}

async function domainsGet(cookieJar) {
  return await got.get(tunnelsURL, { cookieJar });
}

async function tunnelsGet(cookieJar) {
  return await got.get(domainsURL, { cookieJar });
}

export { loginGet, loginPost, domainsGet, tunnelsGet };
