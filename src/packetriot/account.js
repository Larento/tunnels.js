import * as HTMLParser from "node-html-parser";

import { domainsGet, tunnelsGet } from "./request.js";
import { getJar } from "./cookie.js";
import { SCR_ERROR } from "../util.js";

function getAvailable(accounts) {
  const accountsSet = new Set(accounts.map((x) => x.name));

  if (accountsSet.size == 0) {
    throw new Error(SCR_ERROR.ACCOUNTS_NOT_FOUND);
  }

  return accountsSet;
}

function getCredentials(accounts, account) {
  console.log(accounts);
  const thisAccount = accounts.find((x) => x.name == account);
  return {
    email: thisAccount.email,
    password: thisAccount.password,
  };
}

async function getDomains(account) {
  console.log(`Getting domains for account: '${account}'...`);
  const body = await domainsGet(getJar());
  console.log(body);
}

async function getTunnels(account) {
  console.log(`Getting tunnels for account: '${account}'...`);
  const body = await tunnelsGet(getJar());
  console.log(body);
}

export { getAvailable, getCredentials, getTunnels, getDomains };
