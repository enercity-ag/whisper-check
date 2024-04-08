#! /usr/bin/env node

import { writeFile } from 'fs/promises';
import banner from './helper/banner.js';
import { loadJson } from './helper/loader.js';
import check from './helper/check.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
console.log(banner);

yargs(hideBin(process.argv))
  .scriptName('npx @enercity-ag/whisper-check')
  .usage('$0 <cmd> [args]')
  .command(
    'check <collection>',
    'Execute requests of the given collection.',
    (yargs) => {
      yargs
        .positional('collection', {
          describe: 'WhisperCheck collection file',
          type: 'string',
        })
        .options({
          envFile: {
            describe:
              'Specifies one or multiple environment files. The environment file must be a valid json file containing multiple objects. It may contain placeholders like {{PATH}} which will be replaced with values from the environment.',
            type: 'array',
          },
          env: {
            describe: 'Specifies which environment to use.',
            type: 'string',
          },
          showEnv: {
            describe: 'Shows the environment used for the requests.',
            type: 'boolean',
            default: false,
          },
          request: {
            describe:
              'Only execute given requests. Can be used multiple times. If not specified all requests will be executed.',
            type: 'array',
          },
          'multiple-choice': {
            alias: 'm',
            describe:
              'Prompt for request which should be executed. Warning - choosing this option disables dhe --request option.',
            type: 'boolean',
            default: false,
          },
          'wait-between-requests': {
            describe: 'Wait time in ms between requests.',
            type: 'number',
            default: 0,
          },
          'stop-on-failure': {
            describe: 'Stops executing requests after first failure.',
            type: 'boolean',
            default: 0,
          },
          'display-response': {
            describe:
              'Prints the response of each executed request. Will be automatically set if only one request is executed.',
            type: 'boolean',
            default: false,
          },
          repeat: {
            alias: 'r',
            describe: 'Repeat the request(s) n times.',
            type: 'number',
            default: 1,
          },
        });
    },
    function (argv) {
      check(argv)
        .then((failCount) => {
          failCount > 0 ? process.exit(1) : process.exit(0);
        })
        .catch((error) => {
          console.log(error);
          process.exit(1);
        });
    }
  )
  .command(
    'convert <input> <output>',
    "Converts a thunderclient collection into an WhisperCheck collection. **Note**: The `convert` command doesn't try to fix any paths in the source file pointing to other files (e.g. attachments). But you'll get a warning for each found reference.    ",
    (yargs) => {
      yargs
        .positional('input', {
          describe: 'thunderclient collection file (input)',
          type: 'string',
        })
        .positional('output', {
          describe: 'WhisperCheck collection file (output)',
          type: 'string',
        });
    },
    function (argv) {
      convert(argv);
    }
  )
  .parse();

async function convert(args) {
  const input = args.input;
  const output = args.output;

  let srcConfig = await loadJson(input);
  const dstConfig = [];
  const folders = srcConfig.folders;

  // sort requests by folder and sortNum
  const sortedRequests = await srcConfig.requests.sort((a, b) => {
    if (a.containerId != b.containerId) {
      const folderA = folders.find((f) => f._id == a.containerId);
      const folderB = folders.find((f) => f._id == b.containerId);
      return parseFloat(folderA.sortNum) - parseFloat(folderB.sortNum);
    }
    return parseFloat(a.sortNum) - parseFloat(b.sortNum);
  });

  for (const request of sortedRequests) {
    const newRequest = {
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers.reduce((acc, cur) => ({ ...acc, [cur.name]: cur.value }), {}),
      tests: request.tests,
    };
    if (request.body) {
      newRequest.body = {
        type: request.body.type,
      };
      if (request.body.raw) newRequest.body.data = JSON.parse(request.body.raw);
      if (request.body.form) newRequest.body.form = request.body.form;
      if (request.body.files) {
        console.log(`\x1b[33mcheck paths for files in request ${request.name}\x1b[0m`);
        newRequest.body.files = request.body.files;
      }
    }
    dstConfig.push(newRequest);
  }
  writeFile(output, JSON.stringify(dstConfig, null, 2));
  console.log(`Converted ${input}. Wrote ${dstConfig.length} requests to ${output}`);
}

// const cmd = yargs.argv._[0];

// switch (cmd) {
//   case 'convert':
//     convert(yargs.argv);
//     break;
//   case 'check':
//     check(yargs.argv)
//       .then((failCount) => {
//         process.exit(-failCount);
//       })
//       .catch((error) => {
//         console.log(error);
//         process.exit(-1);
//       });
//     break;
//   default:
//     console.log(`Unknown command: ${cmd}`);
//     break;
// }
