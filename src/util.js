import { dirname, resolve, join, basename, extname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { kMaxLength } from "buffer";
import { type } from "os";

const allowedTypes = new Set(["string", "number", "boolean"]);
const rootDirPath = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fromRoot(relativePath) {
  return join(rootDirPath, relativePath);
}

const NAMES = {
  CREDS_CONF: "credentials",
  TUNNELS_CONF: "tunnels",
  SESSION_ID_COOKIE_KEY: "SESSID",
  PACKETRIOT_HOME: "https://packetriot.com",
  PACKETRIOT_LOGIN: "/login",
  PACKETRIOT_DOMAINS: "/domains",
  PACKETRIOT_TUNNELS: "/tunnels",
};

const PATHS = {
  CREDS_PATH: fromRoot(`${NAMES.CREDS_CONF}.yml`),
  TUNNELS_PATH: fromRoot(`${NAMES.TUNNELS_CONF}.yml`),
  COOKIES_PATH: fromRoot("cookies.json"),
};

const SCHEMAS = {};

const SCR_ERROR = {
  KEY_INVALID: `Provided Cloudflare API Key isn't correct or doesn't have permissions to view zones.`,

  DOMAIN_NOT_FOUND: (name) =>
    `Domain name '${name}' not found in Cloudflare account.`,

  ACCOUNTS_NOT_FOUND: `No valid accounts found in '${PATHS.CREDS_PATH}'`,

  ACCOUNT_NOT_FOUND: (tun, acc) =>
    `In '${tun}' tunnel definition: account '${acc}' does not exist.`,

  FILE_NOT_FOUND: (name) => `File '${name}' was not found.`,

  COOKIE_NOT_FOUND: (cookie, acc) =>
    `Cookie '${cookie}' was not found in file under account '${acc}'.`,

  COOKIE_EXPIRED: (cookie, acc) =>
    `Cookie '${cookie}' under account '${acc} has expired.'`,

  SCHEMA_NOT_FOUND: (fileName) =>
    `Config schema for '${fileName}' was not defined.'`,

  FIELD_TYPE_MISMATCH: (name, desc, expectType, gotType) =>
    `Field '${name}' is expected to be of type <${expectType}>, but got <${gotType}>. Field description:\n${desc}`,

  FIELD_COMPLEX_CHILDLESS: (name, desc) =>
    `Field '${name}' is complex and is expected to have children. Field description: ${desc}`,

  FIELD_NOT_FOUND: (parentName, name, desc) =>
    `Field '${name}' is not found inside '${parentName}'. Field description:\n${desc}`,
};

SCHEMAS[NAMES.CREDS_CONF] = field(
  {
    hostname: field(
      "string",
      "Remote host name or domain name registered in both Cloudflare and Packetriot accounts."
    ),
    cloudflare: field(
      {
        token: field("string", "Cloudflare API token."),
      },
      "Cloudflare-related things."
    ),

    packetriot: field(
      {
        accounts: field(
          [
            field(
              {
                name: field(
                  "string",
                  "Account name. Used in tunnel definitions."
                ),
                email: field("string", "Account email."),
                password: field("string", "Account password."),
                server: field(
                  "number",
                  "Server ID, refer to the server list in README."
                ),
              },
              "Account object."
            ),
          ],
          "Accounts in array."
        ),
      },
      "Packetriot-related things."
    ),
  },
  "Schema of 'credentials.yml'."
);

SCHEMAS[NAMES.TUNNELS_CONF] = field(
  [
    field(
      {
        name: field("string", "Tunnel name."),
        account: field("string", "Packetriot account name."),
        subdomain: field("string", "Subdomain of hostname."),
        localhost: field(
          "string",
          "Localhost address to replace default.",
          "127.0.0.1"
        ),
        port: field("number", "Port on localhost to be tunneled."),
        cert: field(
          "boolean",
          "Whether to add Let's Encrypt certificates.",
          true
        ),
      },
      "Tunnnel definition."
    ),
  ],
  "Schema of 'tunnels.yml'."
);

function field(type, desc, fallback) {
  let field = new Map();
  let fieldType, fieldChildren;

  if (typeof type == "string" && allowedTypes.has(type)) {
    fieldType = type;
  } else if (Array.isArray(type)) {
    fieldType = "array";
    fieldChildren = type;
  } else if (type instanceof Object) {
    fieldType = "object";
    fieldChildren = type;
  } else {
    throw new Error(`Bad type definition: ${type}. Description: '${desc}'`);
  }

  field.set("type", fieldType);
  if (desc) field.set("desc", desc);
  if (fallback) field.set("fallback", fallback);
  if (fieldChildren) field.set("children", fieldChildren);

  return field;
}

function readYamlConfig(path) {
  const configFile = readFileSync(path, "utf8");
  let config = parse(configFile);
  const fileName = basename(path);
  const schema = SCHEMAS[basename(fileName, extname(path))];
  if (!schema) {
    throw new Error(SCR_ERROR.SCHEMA_NOT_FOUND(fileName));
  }

  try {
    config = validateYamlConfig(schema, config);
  } catch (e) {
    console.error(`CONFIG ERROR: ${e.message}`);
    console.log(`\nDefined schema:`);
    logSchema(schema);
    process.exit(1);
  }
  return config;
}

function validateYamlConfig(schema, object) {
  object = validateField(schema, object);
  return object;
}

function validateField(
  schemaField,
  objectField,
  name = "_",
  parentName = "__"
) {
  const schemaChildren = schemaField.get("children");
  const fallback = schemaField.get("fallback");
  const desc = schemaField.get("desc");
  let schemaType = schemaField.get("type");
  let objectType = typeof objectField;
  const isComplexType = ["object", "array"].includes(objectType) ? true : false;

  if (objectField == null) {
    objectType = "null";
  } else if (Array.isArray(objectField)) {
    objectType = "array";
  } else if (objectField instanceof Object) {
    objectType = "object";
  }

  // console.log(`complex: ${isComplexType}, fallback: ${fallback}`);
  // console.log(`Sch type: ${schemaType}, Obj type: ${objectType}`);

  if (objectType != schemaType) {
    if (objectType == "null") {
      if (!fallback || isComplexType) {
        throw new Error(SCR_ERROR.FIELD_NOT_FOUND(parentName, name, desc));
      }
      objectField = fallback;
    } else {
      throw new Error(
        SCR_ERROR.FIELD_TYPE_MISMATCH(name, desc, schemaType, objectType)
      );
    }
  }

  switch (schemaType) {
    case "array":
      if (objectField.length == 0) {
        throw new Error(SCR_ERROR.FIELD_COMPLEX_CHILDLESS(name, desc));
      }

      const schemaChild = schemaChildren[0];

      for (let i = 0; i < objectField.length; i++) {
        const objectChild = objectField[i];
        objectField[i] = validateField(
          schemaChild,
          objectChild,
          undefined,
          name
        );
      }
      break;
    case "object":
      if (Object.entries(objectField).length == 0) {
        throw new Error(SCR_ERROR.FIELD_COMPLEX_CHILDLESS(name, desc));
      }

      for (const key in schemaChildren) {
        const schemaChild = schemaChildren[key];
        const objectChild = objectField[key];
        objectField[key] = validateField(schemaChild, objectChild, key, name);
      }
      break;
    default:
      break;
  }

  // console.log("All good. OBJ FIELD: ", objectField, "\n");
  return objectField;
}

function logSchema(schema) {
  let level = 0;
  logField(schema, level);
  console.log();
}

function logField(field, level, name) {
  const indent = level > 1 ? "   ".repeat(level - 1) : "";
  const arrow = level > 0 ? "└" : "";
  const pipe = level > 0 ? "─ " : "";
  const padding = level > 0 ? indent + "│\n" : "";

  const type = field.get("type");
  const desc = field.get("desc");
  const fallback = ["array", "object"].includes(type)
    ? field.get("fallback")
    : null;

  let str = indent + arrow + pipe;
  if (name) str = str + `${name}: `;
  str = str + `<${type}>`;
  if (desc) str = str + ` - ${desc}`;
  if (fallback) str = str + ` [Fallback: '${fallback}']`;

  console.log(str);
  const children = field.get("children");

  if (type == "array") {
    logField(children[0], level + 1);
  } else if (type == "object") {
    for (let [k, v] of Object.entries(children)) {
      logField(v, level + 1, k);
    }
  }
}

export {
  NAMES,
  PATHS,
  SCHEMAS,
  SCR_ERROR,
  readYamlConfig,
  validateYamlConfig,
  logSchema,
};
