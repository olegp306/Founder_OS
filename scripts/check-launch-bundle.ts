import {
  parseLaunchBundleCliArgs,
  runLaunchBundleCli
} from "../src/local/launch-bundle-cli";

const options = parseLaunchBundleCliArgs(process.argv.slice(2));
const result = await runLaunchBundleCli({ options });

console.log(JSON.stringify(result, null, 2));
