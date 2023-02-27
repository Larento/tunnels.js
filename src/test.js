import {
  NAMES,
  PATHS,
  SCHEMAS,
  SCR_ERROR,
  readYamlConfig,
  validateYamlConfig,
} from "./util.js";

const file = readYamlConfig("../tunnels.yml");
console.log(file);
