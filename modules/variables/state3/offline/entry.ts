import { runCommand } from './command.js';

runCommand(process.argv.slice(2)).then(result => {
    console.log('help' in result ? result.help : JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
}).catch(error => { console.error(error); process.exitCode = 1; });
