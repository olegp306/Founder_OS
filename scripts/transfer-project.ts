import {
  parseProjectTransferCliArgs,
  runProjectTransferCli
} from "../src/local/project-transfer-cli";

const options = parseProjectTransferCliArgs(process.argv.slice(2), process.env);
const result = await runProjectTransferCli({ options });

console.log(JSON.stringify(result, null, 2));
