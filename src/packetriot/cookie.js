import * as fs from "fs";
import { CookieJar, parseDate } from "tough-cookie";

import { NAMES, PATHS, SCR_ERROR } from "../util.js";
import { loginGet, loginPost } from "./request.js";
import { getCredentials } from "./account.js";
import { createInflate } from "zlib";
import { writeFile } from "fs/promises";

const cookies = new CookieJar();

function getJar() {
  return cookies;
}

function checkFileExists(path) {
  if (fs.existsSync(path)) {
    return true;
  }

  return false;
}

function createFile(path, availableAccounts) {
  if (!fs.existsSync(path)) {
    const accountsObj = {};
    availableAccounts = Array.from(availableAccounts);
    availableAccounts.map((k) => (accountsObj[k] = {}));
    fs.writeFileSync(path, JSON.stringify(accountsObj));
  }
}

function load(path, account, cookieName) {
  const cookie = readSessionIDCookie(path, account);
  if (!cookie) {
    return;
  }

  if (!checkExpired(cookie)) {
    console.warn(SCR_ERROR.COOKIE_EXPIRED(cookieName, account));
    return;
  }

  return cookie;
}

async function getSessionIDCookie(accounts, account) {
  const credentials = getCredentials(accounts, account);
  await loginGet(cookies);
  await loginPost(cookies, credentials);
  const cookie = findInJar(
    cookies,
    NAMES.SESSION_ID_COOKIE_KEY,
    NAMES.PACKETRIOT_HOME
  );
  if (!cookie || cookie.key != NAMES.SESSION_ID_COOKIE_KEY) {
    console.warn(SCR_ERROR.COOKIE_NOT_FOUND(NAMES.SESSION_ID_COOKIE_KEY));
    return;
  }

  return cookie;
}

function readSessionIDCookie(path, account) {
  if (!checkFileExists(path)) {
    console.warn(SCR_ERROR.FILE_NOT_FOUND(PATHS.COOKIES_PATH));
    return;
  }

  const cookiesStr = fs.readFileSync(path, "utf8");
  console.log(`cookie str: ${cookiesStr}`);
  if (!cookiesStr) {
    console.warn(SCR_ERROR.FILE_NOT_FOUND(PATHS.COOKIES_PATH));
    return;
  }

  const cookies = JSON.parse(cookiesStr);
  const cookie = cookies[account];
  if (!cookie || cookie.key != NAMES.SESSION_ID_COOKIE_KEY) {
    console.warn(SCR_ERROR.COOKIE_NOT_FOUND(NAMES.SESSION_ID_COOKIE_KEY));
    return;
  }

  return cookie;
}

function checkExpired(cookie) {
  const cookieExpirationDate = parseDate(cookie.expires);
  const currentDate = new Date();
  if (currentDate.getTime() >= cookieExpirationDate.getTime()) {
    return false;
  }

  return true;
}

function updateFile(path, account, cookie) {
  const cookieStr = fs.readFileSync(path, "utf8");
  const cookies = JSON.parse(cookieStr);
  cookies[account] = cookie;
  fs.writeFileSync(path, JSON.stringify(cookies));
  return true;
}

function findInJar(cookieJar, cookieName, domain) {
  return cookieJar.serializeSync().cookies.find((cookie) => {
    return cookie.key == cookieName && cookie.domain == domain;
  });
}

export { getJar, load, createFile, updateFile, getSessionIDCookie };
