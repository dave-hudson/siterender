import fs from 'fs';
import path from 'path';
import axios from 'axios';
import puppeteer, {Browser} from 'puppeteer';
import {
    fetchSitemap,
    parseSitemap,
    getFilePath,
    renderPage,
    ensureDirectoryExistence,
    deletePreviousFile,
    startRendering,
    Args,
} from './logic';

jest.mock('axios');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        unlink: jest.fn(),
    },
    existsSync: jest.fn(),
}));

// Define mocks for puppeteer
const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html></html>'),
    close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
} as unknown as Browser;

jest.mock('puppeteer', () => {
    return {
        __esModule: true,
        default: {
            launch: jest.fn().mockImplementation(() => {
                return Promise.resolve(mockBrowser);
            })
        }
    }
});

describe('logic.ts', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });

        jest.clearAllMocks(); // Clear mock state before each test
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    describe('fetchSitemap', () => {
        it('should fetch sitemap content from URL', async () => {
            const mockData = '<urlset><url><loc>http://example.com/</loc></url></urlset>';
            (axios.get as jest.Mock).mockResolvedValue({data: mockData});

            const result = await fetchSitemap('http://example.com/sitemap.xml');
            expect(result).toBe(mockData);
            expect(axios.get).toHaveBeenCalledWith('http://example.com/sitemap.xml', {maxRedirects: 5});
        });

        it('should handle fetch errors', async () => {
            (axios.get as jest.Mock).mockRejectedValue(new Error('Fetch error'));

            await expect(fetchSitemap('http://example.com/sitemap.xml')).rejects.toThrow('Failed to fetch sitemap from http://example.com/sitemap.xml: Error: Fetch error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch sitemap from http://example.com/sitemap.xml: Error: Fetch error');
        });
    });

    describe('parseSitemap', () => {
        it('should parse XML sitemap content', () => {
            const xml = '<urlset><url><loc>http://example.com/</loc></url></urlset>';
            const result = parseSitemap(xml);

            expect(result).toEqual(['http://example.com/']);
        });
    });

    describe('getFilePath', () => {
        it('should construct file path for URLs ending with /', () => {
            const parsedUrl = new URL('http://example.com/');
            const filePath = getFilePath(parsedUrl, 'output');
            expect(filePath).toBe('output/index.html');
        });

        it('should construct file path for URLs without trailing /', () => {
            const parsedUrl = new URL('http://example.com/page');
            const filePath = getFilePath(parsedUrl, 'output');
            expect(filePath).toBe('output/page/index.html');
        });
    });

    describe('ensureDirectoryExistence', () => {
        it('should ensure directory exists', async () => {
            const filePath = 'output/index.html';

            await ensureDirectoryExistence(filePath);

            expect(fs.promises.mkdir).toHaveBeenCalledWith(path.dirname(filePath), {recursive: true});
        });

        it('should handle errors when ensuring directory exists', async () => {
            const filePath = 'output/index.html';
            (fs.promises.mkdir as jest.Mock).mockRejectedValue(new Error('Mkdir error'));

            await expect(ensureDirectoryExistence(filePath)).rejects.toThrow('process.exit: 1');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create directory output: Mkdir error');
        });
    });

    describe('deletePreviousFile', () => {
        it('should delete previous file if it exists', async () => {
            const filePath = 'output/index.html';
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            await deletePreviousFile(filePath);

            expect(fs.promises.unlink).toHaveBeenCalledWith(filePath);
        });

        it('should not delete previous file if it does not exist', async () => {
            const filePath = 'output/index.html';
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            await deletePreviousFile(filePath);

            expect(fs.promises.unlink).not.toHaveBeenCalled();
        });

        it('should handle errors when deleting previous file', async () => {
            const filePath = 'output/index.html';
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.promises.unlink as jest.Mock).mockRejectedValue(new Error('Unlink error'));

            await expect(deletePreviousFile(filePath)).rejects.toThrow('process.exit: 1');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete file output/index.html: Unlink error');
        });
    });

    describe('renderPage', () => {
        it('should render a page', async () => {
            const url = 'http://example.com';
            const outputDir = 'output';
            const filePath = getFilePath(new URL(url), outputDir);

            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

            await renderPage(mockBrowser, url, outputDir);

            expect(mockPage.goto).toHaveBeenCalledWith(url, {waitUntil: 'networkidle2'});
            expect(mockPage.content).toHaveBeenCalled();
            expect(fs.promises.writeFile).toHaveBeenCalledWith(filePath, '<html></html>');
            expect(mockPage.close).toHaveBeenCalled();
        });

        it('should handle errors during rendering', async () => {
            const url = 'http://example.com';
            mockPage.goto.mockRejectedValue(new Error('Navigation error'));

            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

            await expect(renderPage(mockBrowser, url, 'output')).rejects.toThrow('Navigation error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to render page http://example.com: Navigation error');
            expect(mockPage.close).toHaveBeenCalled();
        });
    });

    describe('startRendering', () => {
        let mockData: string;

        beforeEach(() => {
            mockData = '<urlset><url><loc>http://example.com</loc></url></urlset>';
            (axios.get as jest.Mock).mockResolvedValue({data: mockData});
            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.unlink as jest.Mock).mockResolvedValue(undefined);
            mockPage.goto.mockResolvedValue(undefined);
        });

        it('should start rendering process with a sitemap URL', async () => {
            await startRendering({
                sitemapUrl: 'http://example.com/sitemap.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 3
            } as Args);

            expect(puppeteer.launch).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', {waitUntil: 'networkidle2'});
            expect(fs.promises.writeFile).toHaveBeenCalledWith('output/index.html', '<html></html>');
        });

        it('should start rendering process with a sitemap file', async () => {
            (fs.promises.readFile as jest.Mock).mockResolvedValue(mockData);

            await startRendering({
                sitemapFile: 'sitemap.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 3
            } as Args);

            expect(puppeteer.launch).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', {waitUntil: 'networkidle2'});
            expect(fs.promises.writeFile).toHaveBeenCalledWith('output/index.html', '<html></html>');
        });

        it('should handle sitemap index', async () => {
            const sitemapIndexData = '<sitemapindex><sitemap><loc>http://example.com/sitemap1.xml</loc></sitemap></sitemapindex>';
            const subSitemapData = '<urlset><url><loc>http://example.com/page1</loc></url></urlset>';

            (axios.get as jest.Mock).mockResolvedValueOnce({data: sitemapIndexData}).mockResolvedValueOnce({data: subSitemapData});

            await startRendering({
                sitemapUrl: 'http://example.com/sitemapindex.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 3
            } as Args);

            expect(axios.get).toHaveBeenCalledWith('http://example.com/sitemapindex.xml', {maxRedirects: 5});
            expect(axios.get).toHaveBeenCalledWith('http://example.com/sitemap1.xml', {maxRedirects: 5});
            expect(mockPage.goto).toHaveBeenCalledWith('http://example.com/page1', {waitUntil: 'networkidle2'});
            expect(fs.promises.writeFile).toHaveBeenCalledWith('output/page1/index.html', '<html></html>');
        });

        it('should handle URL replacement', async () => {
            await startRendering({
                sitemapUrl: 'http://example.com/sitemap.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 3,
                replaceUrl: 'http://new.com=http://example.com'
            } as Args);

            expect(mockPage.goto).toHaveBeenCalledWith('http://new.com', {waitUntil: 'networkidle2'});
        });

        it('should retry rendering on failure', async () => {
            mockPage.goto.mockRejectedValueOnce(new Error('Navigation error')).mockResolvedValue(undefined);

            await startRendering({
                sitemapUrl: 'http://example.com/sitemap.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 3
            } as Args);

            expect(mockPage.goto).toHaveBeenCalledTimes(2);
        });

        it('should fail after maximum retries', async () => {
            mockPage.goto.mockRejectedValue(new Error('Navigation error'));

            await expect(startRendering({
                sitemapUrl: 'http://example.com/sitemap.xml',
                output: 'output',
                parallelRenders: 1,
                maxRetries: 1
            } as Args)).rejects.toThrow('process.exit: 1');

            expect(mockPage.goto).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed: http://example.com: Navigation error');
        });
    });
});

