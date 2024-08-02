#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startRendering, Args } from './logic';
import os from 'os';

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 --sitemap-file <file> OR --sitemap-url <url> --output <directory> [options]')
    .option('sitemap-file', {
        describe: 'Path to the sitemap file',
        type: 'string',
    })
    .option('sitemap-url', {
        describe: 'URL of the sitemap file',
        type: 'string',
    })
    .option('output', {
        describe: 'Output directory for rendered pages',
        type: 'string',
        demandOption: true,
    })
    .option('replace-url', {
        describe: 'Replace URL prefix in the form <new-url-prefix>=<old-url-prefix>',
        type: 'string',
    })
    .option('parallel-renders', {
        describe: 'Number of parallel renders',
        type: 'number',
        default: os.cpus().length,
    })
    .option('max-retries', {
        describe: 'Maximum number of retries for rendering',
        type: 'number',
        default: 3,
    })
    .conflicts('sitemap-file', 'sitemap-url')
    .check((argv) => {
        if (!argv['sitemap-file'] && !argv['sitemap-url']) {
            throw new Error('Either --sitemap-file or --sitemap-url must be provided');
        }
        if (argv['replace-url'] && !argv['replace-url'].includes('=')) {
            throw new Error('--replace-url must be in the form <new-url-prefix>=<old-url-prefix>');
        }
        return true;
    })
    .strict()
    .fail((msg, err, yargs) => {
        if (err) {
            console.error('Error:', err.message);
        } else {
            console.error('Error:', msg);
        }
        console.error(yargs.help());
        process.exit(1);
    })
    .help('h')
    .alias('h', 'help')
    .argv;

const args: Args = {
    sitemapFile: argv['sitemap-file'],
    sitemapUrl: argv['sitemap-url'],
    output: argv.output,
    replaceUrl: argv['replace-url'],
    parallelRenders: argv['parallel-renders'],
    maxRetries: argv['max-retries'],
};

startRendering(args)
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

