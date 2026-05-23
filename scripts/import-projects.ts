import {
  parseProjectImportCliArgs,
  runProjectImportCli
} from "../src/local/project-import-cli";

const options = parseProjectImportCliArgs(process.argv.slice(2), process.env);
const result = await runProjectImportCli({ options });

console.log(JSON.stringify(result, null, 2));
