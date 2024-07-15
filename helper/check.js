import axios from 'axios';
import https from 'https';
import handlebars from 'handlebars';
import evaluateExpression from './evaluateExpression.js';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import sleep from './sleep.js';
import { loadEnvironment, loadJson } from './loader.js';
import inquirer from 'inquirer';

const abortRequest = "ABORT - I don't want to check anything anymore";
function fixedLengthString(str, len) {
  return str.padEnd(len, ' ').substring(0, len);
}

function getProperty(obj, path) {
  return Array.from(path.matchAll(/([^.\[\]]+)/g), (match) => match[0]).reduce((acc, part) => {
    if (Array.isArray(acc)) {
      return acc[parseInt(part)];
    }
    return acc && acc[part];
  }, obj);
}

async function check(args) {
  const multipleChoice = args['multiple-choice'];
  const stopOnFailure = args['stop-on-failure'];
  let requestsFilter = args['request'];
  const waitBetweenRequests = args['wait-between-requests'] ? parseInt(args['wait-between-requests']) : 0;
  const displayResponse = args['display-response'];
  const repeat = args['repeat'] || 1;
  const insecure = args['insecure'];
  const verboseResults = args['verbose-results'];
  const collection = args.collection;
  const config = await loadJson(collection);
  const basedir = path.dirname(collection);
  const env = await loadEnvironment(args);

  const instance = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: !insecure,
    }),
  });

  let isGlobalError = false;
  let failCount = 0;
  let okCount = 0;

  do {
    if (multipleChoice) {
      let answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'request',
          message: 'Which request should be executed?' + (repeat > 1 ? ` (will be repeated ${repeat} times)` : ''),
          choices: [abortRequest].concat(config.map((r) => r.name)),
        },
      ]);
      requestsFilter = answers.request;
    }

    for (let repeatCnt = 0; repeatCnt < repeat; repeatCnt++) {
      for (const request of config) {
        if (requestsFilter) {
          if (Array.isArray(requestsFilter)) {
            if (!requestsFilter.find((r) => r == request.name)) continue;
          } else {
            if (requestsFilter != request.name) continue;
          }
        }

        let isLocalError = false;
        let localErrorMsg = '';

        const name = request.name;
        const method = request.method;
        const url = handlebars.compile(request.url, { noEscape: true })(env);

        const config = {
          url,
          method,
          headers: JSON.parse(handlebars.compile(JSON.stringify(request.headers), { noEscape: true })(env)),
          maxRedirects: isNaN(request.maxRedirects) ? undefined : request.maxRedirects,
        };

        let response;
        if (request.body) {
          switch (request.body.type) {
            case 'json':
              if (request.body.data) {
                config.data = JSON.parse(
                  handlebars.compile(JSON.stringify(request.body.data), { noEscape: true })(env)
                );
              }
              break;
            case 'formdata':
              config.data = new FormData();
              for (const keyValue of request.body.form) {
                if (keyValue.value instanceof Object) {
                  config.data.append(keyValue.name, handlebars.compile(JSON.stringify(keyValue.value))(env));
                } else {
                  config.data.append(keyValue.name, handlebars.compile(keyValue.value)(env));
                }
              }
              for (const file of request.body.files) {
                config.data.append(file.name, fs.createReadStream(path.join(basedir, file.value)), {
                  filename: path.basename(file.value),
                });
              }
              break;
            default:
              console.log('unknown body type ' + request.body.type);
              isLocalError = true;
              localErrorMsg = 'only json body supported';
          }
        }
        const startTime = Date.now();
        try {
          response = await instance(config);
        } catch (error) {
          if (error.response) {
            response = error.response;
          } else {
            isLocalError = true;
            localErrorMsg = error.message;
          }
        }

        if (response) {
          for (const test of request.tests) {
            switch (test.type) {
              case 'set-env-var':
                const value = getProperty({ json: response.data }, test.custom);
                const destinationProperty = test.value.match(/{{([^,}]*),.*}}/)[1];
                env[destinationProperty] = value;
                break;
              case 'res-code':
                switch (test.action.toString()) {
                  case 'equal':
                    if (response.status != test.value) {
                      isLocalError = true;
                      localErrorMsg = `response code ${response.status} not equal ${test.value}`;
                    }
                    break;
                  case 'regex':
                    if (!new RegExp(test.value).test(response.status)) {
                      isLocalError = true;
                      localErrorMsg = `response code ${response.status} does not match ${test.value}`;
                    }
                    break;
                  default:
                    isLocalError = true;
                    localErrorMsg = 'unknown action: ' + test.action;
                }
                break;
              case 'json-query':
                const v = getProperty({ json: response.data }, test.custom);
                if (!evaluateExpression(test.action, v, handlebars.compile(test.value, { noEscape: true })(env))) {
                  isLocalError = true;
                  localErrorMsg = `json query "${test.custom} ${test.action} '${test.value}'" failed with value '${v}'`;
                }
                break;
              default:
                isLocalError = true;
                localErrorMsg = 'unknown test type: ' + test.type;
            }
          }
        }
        console.log(
          `${isLocalError ? `\x1b[31mFAIL\x1b[0m` : '\x1b[32mOK\x1b[0m  '} ${fixedLengthString(
            name,
            60
          )} ${fixedLengthString(method, 5)} ${`${Date.now() - startTime}`.padStart(5, ' ')} ms ${
            isLocalError ? ` \x1b[31mERROR ${localErrorMsg}\x1b[0m` : ''
          }`
        );
        if (isLocalError || verboseResults) {
          console.log(
            `\x1b[33mVerbose: {\x1b[0m\n` +
              `   \x1b[33mURL\x1b[0m:         ${request.url}\n` +
              `   \x1b[33mMethode\x1b[0m:     ${request.method}\n` +
              `   \x1b[33mBody\x1b[0m:        ${
                request.body
                  ? JSON.parse(handlebars.compile(JSON.stringify(request.body), { noEscape: true })(env))
                  : `-`
              }\n` +
              `   \x1b[33mStatus\x1b[0m:      ${response.status}\n` +
              `   \x1b[33mRes. Header\x1b[0m: ${response.headers.toString().replaceAll(`\n`, `; `)}\n` +
              `   \x1b[33mRes. Body\x1b[0m:   ${
                response.data
                  ? JSON.parse(handlebars.compile(JSON.stringify(response.data), { noEscape: true })(env))
                  : `-`
              }\n\x1b[33m}\x1b[0m\n`
          );
        }

        if ((requestsFilter && (!Array.isArray(requestsFilter) || requestsFilter?.length == 1)) || displayResponse) {
          console.log('\x1b[36m........ Request ............... . . .  .  .   .   .    .    .\x1b[0m');
          console.log('URL    : ' + url);
          console.log('Headers: ' + JSON.stringify(config.headers));
          if (response) {
            console.log('\x1b[36m........ Response .............. . . .  .  .   .   .    .    .\x1b[0m');
            switch (response.status) {
              case 200:
                console.log('Status : \x1b[32m' + response.status + '\x1b[0m');
                break;
              default:
                console.log('Status : \x1b[31m' + response.status + '\x1b[0m');
            }
            console.log('Headers: ' + JSON.stringify(response.headers, null, 2));
            console.log('\x1b[36m........ Response-Data ......... . . .  .  .   .   .    .    .\x1b[0m');
            if (response.headers['content-type']?.startsWith('application/json')) {
              console.log(JSON.stringify(response.data, null, 2));
            } else {
              console.log(response.data.toString());
            }
            console.log('\x1b[36m................................ . . .  .  .   .   .    .    .\x1b[0m');
          }
        }

        if (isLocalError) {
          isGlobalError = true;
          failCount++;
          if (stopOnFailure == 1) break;
        } else {
          okCount++;
        }

        if (request.waitAfterRequest) await sleep(request.waitAfterRequest);
        await sleep(waitBetweenRequests);
      }
    }
  } while (multipleChoice && requestsFilter !== abortRequest);

  if (failCount + okCount > 1)
    console.log(`\n${failCount + okCount} Requests: ${failCount}x \x1b[31mFAIL\x1b[0m ${okCount}x \x1b[32mOK\x1b[0m`);
  return failCount;
}

export default check;
