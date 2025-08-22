import { add, get, list, rm, start } from './commands';
import { name, version } from './constants';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const cli = yargs(hideBin(process.argv))
  .scriptName(name)
  .version(version)
  .command(add)
  .command(list)
  .command(get)
  .command(start)
  .command(rm)
  .help()
  .demandCommand(1);
