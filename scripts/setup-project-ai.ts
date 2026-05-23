import {
  parseProjectAiSetupCliArgs,
  runProjectAiSetupCli
} from "../src/local/project-ai-setup-cli";

const options = parseProjectAiSetupCliArgs(process.argv.slice(2), process.env);
const result = await runProjectAiSetupCli({ options });

console.log(JSON.stringify(result, null, 2));
