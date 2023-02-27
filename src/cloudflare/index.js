import Cloudflare from "cloudflare";
import { SCR_ERROR } from "../util.js";

function init(token) {
  let cloudflare;
  try {
    cloudflare = Cloudflare({ token });
  } catch (e) {
    throw new Error(SCR_ERROR.KEY_INVALID);
  }
  return cloudflare;
}

async function findZone(cloudflare, domainName) {
  const zonesResp = await cloudflare.zones.browse();
  if (!zonesResp.success) throw new Error(SCR_ERROR.KEY_INVALID);

  const zone = zonesResp.result.find((x) => x.name == domainName);
  if (!zone) throw new Error(SCR_ERROR.DOMAIN_NOT_FOUND(domainName));

  return zone;
}

function addRecord_A(cloudflare) {
  console.log(`Adding DNS A record.`);
}

function addRecord_CNAME(cloudflare) {
  console.log(`Adding DNS CNAME record.`);
}

export { init, findZone, addRecord_A, addRecord_CNAME };
