import {
  parseDeploymentCheckCliArgs,
  runDeploymentCheckCli
} from "../src/local/deployment-check-cli";

const options = parseDeploymentCheckCliArgs(process.argv.slice(2), process.env);
const result = await runDeploymentCheckCli({ options });

console.log(JSON.stringify(result, null, 2));
