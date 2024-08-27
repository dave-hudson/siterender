import puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {XMLParser} from 'fast-xml-parser';
import type {Browser} from 'puppeteer';

export interface Args {
    sitemapFile?: string;
    sitemapUrl?: string;
    output: string;
    replaceUrl?: string;
    parallelRenders: number;
    maxRetries: number;
}

interface UrlReplacement {
    newPrefix: string;
    oldPrefix: string;
}

const parser = new XMLParser();

/**
 * Start the rendering process based on the provided arguments.
 * @param argv - Command line arguments.
 */
export async function startRendering(argv: Args): Promise<void> {
    const urls = await getUrls(argv);
    const urlReplacement = argv.replaceUrl ? parseUrlReplacement(argv.replaceUrl) : null;
    const browser = await puppeteer.launch();

    try {
        await renderPages(browser, urls, argv.output, argv.parallelRenders, argv.maxRetries, urlReplacement);
    } finally {
        await browser.close();
    }
}

/**
 * Get URLs from the sitemap.
 * @param argv - Command line arguments.
 * @returns List of URLs to render.
 */
async function getUrls(argv: Args): Promise<string[]> {
    const sitemapContent = argv.sitemapFile
        ? await fs.promises.readFile(argv.sitemapFile, 'utf8')
        : await fetchSitemap(argv.sitemapUrl!);

    const sitemap = parser.parse(sitemapContent);

    if (sitemap.sitemapindex) {
        console.log('Processing sitemap index');
        const sitemaps = Array.isArray(sitemap.sitemapindex.sitemap)
            ? sitemap.sitemapindex.sitemap
            : [sitemap.sitemapindex.sitemap];
        let urls: string[] = [];
        for (const map of sitemaps) {
            console.log(`Processing sitemap: ${map.loc}`);
            const subSitemapContent = await fetchSitemap(map.loc);
            urls = urls.concat(parseSitemap(subSitemapContent));
        }

        return urls;
    }

    return parseSitemap(sitemapContent);
}

/**
 * Parse URLs from sitemap content.
 * @param content - XML content of the sitemap.
 * @returns List of URLs.
 */
export function parseSitemap(content: string): string[] {
    const sitemap = parser.parse(content);
    if (sitemap.urlset) {
        return Array.isArray(sitemap.urlset.url)
            ? sitemap.urlset.url.map((u: any) => u.loc)
            : [sitemap.urlset.url.loc];
    }

    return [];
}

/**
 * Fetch the sitemap content from a URL.
 * @param url - URL of the sitemap.
 * @returns Sitemap content.
 */
export async function fetchSitemap(url: string): Promise<string> {
    try {
        const response = await axios.get(url, {maxRedirects: 5});
        return response.data;
    } catch (error) {
        const errorMessage = `Failed to fetch sitemap from ${url}: ${error instanceof Error ? `Error: ${error.message}` : `Error: ${String(error)}`}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
}

/**
 * Parse the URL replacement parameter.
 * @param replaceUrl - URL replacement string.
 * @returns URL replacement object.
 */
function parseUrlReplacement(replaceUrl: string): UrlReplacement {
    const [newPrefix, oldPrefix] = replaceUrl.split('=');
    return {newPrefix, oldPrefix};
}

/**
 * Render the pages using Puppeteer.
 * @param browser - Puppeteer browser instance.
 * @param urls - List of URLs to render.
 * @param outputDir - Output directory for rendered pages.
 * @param parallelRenders - Number of parallel renders.
 * @param maxRetries - Maximum number of retries for rendering.
 * @param urlReplacement - URL replacement object.
 */
async function renderPages(
    browser: Browser,
    urls: string[],
    outputDir: string,
    parallelRenders: number,
    maxRetries: number,
    urlReplacement: UrlReplacement | null
): Promise<void> {
    const queue = [...urls];
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < parallelRenders; i++) {
        tasks.push(processQueue(browser, queue, outputDir, maxRetries, urlReplacement));
    }

    await Promise.all(tasks);
}

/**
 * Process the queue of URLs to render.
 * @param browser - Puppeteer browser instance.
 * @param queue - Queue of URLs to render.
 * @param outputDir - Output directory for rendered pages.
 * @param maxRetries - Maximum number of retries for rendering.
 * @param urlReplacement - URL replacement object.
 */
async function processQueue(
    browser: Browser,
    queue: string[],
    outputDir: string,
    maxRetries: number,
    urlReplacement: UrlReplacement | null
): Promise<void> {
    while (queue.length > 0) {
        const url = queue.shift()!;
        const finalUrl = urlReplacement && url.startsWith(urlReplacement.oldPrefix)
            ? url.replace(urlReplacement.oldPrefix, urlReplacement.newPrefix)
            : url;

        await retryRenderPage(browser, finalUrl, outputDir, maxRetries);
    }
}

/**
 * Retry rendering a page with the specified number of retries.
 * @param browser - Puppeteer browser instance.
 * @param url - URL of the page to render.
 * @param outputDir - Output directory for rendered page.
 * @param maxRetries - Maximum number of retries for rendering.
 */
async function retryRenderPage(
    browser: Browser,
    url: string,
    outputDir: string,
    maxRetries: number
): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await renderPage(browser, url, outputDir);
            console.log(`Rendered: ${url}`);
            return;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`Retrying (${attempt + 1}/${maxRetries}) for ${url}`);
                const backoff = Math.min(Math.pow(2, attempt) * 1000, 8000);
                const jitter = Math.random() * 1000;
                await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
            } else {
                console.error(`Failed: ${url}: ${error instanceof Error ? error.message : String(error)}`);
                process.exit(1);
            }
        }
    }
}

/**
 * Render a single page using Puppeteer.
 * @param browser - Puppeteer browser instance.
 * @param url - URL of the page to render.
 * @param outputDir - Output directory for rendered page.
 */
export async function renderPage(browser: Browser, url: string, outputDir: string): Promise<void> {
    const page = await browser.newPage();
    try {
        const parsedUrl = new URL(url);
        const filePath = getFilePath(parsedUrl, outputDir);

        await ensureDirectoryExistence(filePath);
        await deletePreviousFile(filePath);

        await page.goto(url, {waitUntil: 'networkidle2'});

        const content = await page.content();

        await fs.promises.writeFile(filePath, content);
    } catch (error) {
        console.error(`Failed to render page ${url}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    } finally {
        await page.close();
    }
}

/**
 * Get the file path for the rendered page.
 * @param parsedUrl - Parsed URL object.
 * @param outputDir - Output directory.
 * @returns File path for the rendered page.
 */
export function getFilePath(parsedUrl: URL, outputDir: string): string {
    let pathName = parsedUrl.pathname;
    if (pathName.endsWith('/')) {
        pathName = `${pathName}index.html`;
    } else if (!path.extname(pathName)) {
        pathName = `${pathName}/index.html`;
    }

    return path.join(outputDir, pathName);
}

/**
 * Ensure that the directory for the file path exists.
 * @param filePath - File path.
 */
export async function ensureDirectoryExistence(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        try {
            await fs.promises.mkdir(dir, {recursive: true});
        } catch (error) {
            console.error(`Failed to create directory ${dir}: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }
}

/**
 * Delete the previous file if it exists.
 * @param filePath - File path.
 */
export async function deletePreviousFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
        try {
            await fs.promises.unlink(filePath);
        } catch (error) {
            console.error(`Failed to delete file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }
}

