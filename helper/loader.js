import fs from 'fs';
import { parse } from 'envfile';
import { readFile } from 'fs/promises';
import handlebars from 'handlebars';
import inquirer from 'inquirer';

let env = { ...process.env };

try {
  if (fs.existsSync('.env')) {
    env = { ...parse(fs.readFileSync('.env', 'utf8')), ...env };
  }
} catch (error) {
  console.log(`\x1b[31mError reading file .env: ${error}\x1b[0m`);
}

async function loadEnvironment(args) {
  let envCollection = {};

  if (args.envFile) {
    for (const file of args.envFile) {
      Object.assign(envCollection, await loadEnvironmentFile(file));
    }
  }

  return envCollection[
    args.env ||
      (
        await inquirer.prompt([
          {
            type: 'list',
            name: 'request',
            message: 'Which environment should be used?',
            choices: Object.keys(envCollection),
          },
        ])
      ).request
  ];
}

async function loadEnvironmentFile(file) {
  const data = await readFile(file);
  return JSON.parse(handlebars.compile(data.toString(), { noEscape: true })(env));
}

async function loadJson(file) {
  try {
    const data = await readFile(file);
    return JSON.parse(data.toString());
  } catch (error) {
    console.log(`Error reading file ${file}: ${error}`);
    process.exit(-1);
  }
}

export { loadEnvironment, loadJson };
