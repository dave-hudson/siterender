import fs from 'fs';
import path from 'path';
import axios from 'axios';
import puppeteer from 'puppeteer';
import {
    fetchSitemap,
    parseSitemap,
    getFilePath,
    renderPage,
    ensureDirectoryExistence,
    deletePreviousFile,
    startRendering
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

jest.mock('puppeteer', () => {
    return {
        launch: jest.fn(() => ({
            newPage: jest.fn(async () => ({
                goto: jest.fn(),
                content: jest.fn(() => '<html></html>'),
                close: jest.fn(),
            })),
            close: jest.fn()
        }))
    };
});

describe('fetchSitemap', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should fetch sitemap content from URL', async () => {
        const mockData = '<urlset><url><loc>http://example.com/</loc></url></urlset>';
        (axios.get as jest.Mock).mockResolvedValue({ data: mockData });

        const result = await fetchSitemap('http://example.com/sitemap.xml');
        expect(result).toBe(mockData);
        expect(axios.get).toHaveBeenCalledWith('http://example.com/sitemap.xml', { maxRedirects: 5 });
    });

    it('should handle fetch errors', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('Fetch error'));

        await expect(fetchSitemap('http://example.com/sitemap.xml')).rejects.toThrow('Failed to fetch sitemap from http://example.com/sitemap.xml: Error: Fetch error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch sitemap from http://example.com/sitemap.xml: Error: Fetch error');
    });
});

describe('ensureDirectoryExistence', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should ensure directory exists', async () => {
        const filePath = 'output/index.html';

        await ensureDirectoryExistence(filePath);

        expect(fs.promises.mkdir).toHaveBeenCalledWith(path.dirname(filePath), { recursive: true });
    });

    it('should handle errors when ensuring directory exists', async () => {
        const filePath = 'output/index.html';
        (fs.promises.mkdir as jest.Mock).mockRejectedValue(new Error('Mkdir error'));

        await expect(ensureDirectoryExistence(filePath)).rejects.toThrow('process.exit: 1');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create directory output: Mkdir error');
    });
});

describe('deletePreviousFile', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

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
    let mockBrowser: any;
    let mockPage: any;
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });

        mockPage = {
            goto: jest.fn().mockResolvedValue(undefined),
            content: jest.fn().mockResolvedValue('<html></html>'),
            close: jest.fn().mockResolvedValue(undefined),
        };
        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
        };
        (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should render a page', async () => {
        const browser = await puppeteer.launch();
        const url = 'http://example.com';
        const outputDir = 'output';
        const filePath = getFilePath(new URL(url), outputDir);

        await renderPage(browser, url, outputDir);

        expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'networkidle2' });
        expect(mockPage.content).toHaveBeenCalled();
        expect(fs.promises.writeFile).toHaveBeenCalledWith(filePath, '<html></html>');
        expect(mockPage.close).toHaveBeenCalled();
    });

    it('should handle errors during rendering', async () => {
        const browser = await puppeteer.launch();
        const url = 'http://example.com';
        mockPage.goto.mockRejectedValue(new Error('Navigation error'));

        await expect(renderPage(browser, url, 'output')).rejects.toThrow('process.exit: 1');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to render page http://example.com: Navigation error');
        expect(mockPage.close).toHaveBeenCalled();
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

describe('startRendering', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;
    let mockBrowser: any;
    let mockPage: any;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
            throw new Error(`process.exit: ${code}`);
        });

        mockPage = {
            goto: jest.fn().mockResolvedValue(undefined),
            content: jest.fn().mockResolvedValue('<html></html>'),
            close: jest.fn().mockResolvedValue(undefined),
        };
        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn().mockResolvedValue(undefined)
        };
        (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should start rendering process', async () => {
        const mockData = '<urlset><url><loc>http://example.com/</loc></url></urlset>';
        (axios.get as jest.Mock).mockResolvedValue({ data: mockData });

        await startRendering({
            sitemapUrl: 'http://example.com/sitemap.xml',
            output: 'output',
            parallelRenders: 1,
            maxRetries: 3
        });

        expect(puppeteer.launch).toHaveBeenCalled();
        expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', { waitUntil: 'networkidle2' });
        expect(fs.promises.writeFile).toHaveBeenCalledWith('output/index.html', '<html></html>');
    });
});

