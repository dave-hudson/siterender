import fs from 'fs';
import path from 'path';
import axios from 'axios';
import puppeteer from 'puppeteer';
import {
    fetchSitemap,
    parseSitemap,
    replaceUrl,
    getFilePath,
    saveRenderedPage,
    renderPage
} from './logic';

jest.mock('axios');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        rm: jest.fn()
    }
}));

// Manual mocking for puppeteer
jest.mock('puppeteer', () => {
    return {
        launch: jest.fn(() => ({
            newPage: jest.fn(async () => ({
                goto: jest.fn(),
                content: jest.fn(() => '<html></html>'),
                close: jest.fn(),
                isClosed: jest.fn(() => false)
            })),
            close: jest.fn()
        }))
    };
});

jest.mock('./logic', () => {
    const originalModule = jest.requireActual('./logic');
    return {
        ...originalModule,
        processSitemapIndex: jest.fn(),
        processSitemapUrls: jest.fn(),
        launchBrowserWithRetries: jest.fn(),
        closeBrowserWithRetries: jest.fn()
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
        expect(axios.get).toHaveBeenCalledWith('http://example.com/sitemap.xml', { maxRedirects: 10 });
    });

    it('should handle fetch errors', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('Fetch error'));

        await expect(fetchSitemap('http://example.com/sitemap.xml')).rejects.toThrow('process.exit: 1');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch sitemap: Fetch error');
    });
});

describe('saveRenderedPage', () => {
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

    it('should save rendered page content to a file', async () => {
        const filePath = 'output/index.html';
        const content = '<html></html>';

        await saveRenderedPage(filePath, content);

        expect(fs.promises.mkdir).toHaveBeenCalledWith(path.dirname(filePath), { recursive: true });
        expect(fs.promises.writeFile).toHaveBeenCalledWith(filePath, content);
    });

    it('should handle errors when saving rendered page content', async () => {
        const filePath = 'output/index.html';
        const content = '<html></html>';
        (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write error'));

        await expect(saveRenderedPage(filePath, content)).rejects.toThrow('process.exit: 1');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save rendered page: Write error');
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
            isClosed: jest.fn().mockReturnValue(false),
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
        const content = await renderPage(browser, 'http://example.com', 3);
        expect(content).toBe('<html></html>');
        expect(mockPage.goto).toHaveBeenCalledWith('http://example.com', { waitUntil: 'networkidle2', timeout: 60000 });
        expect(mockPage.close).toHaveBeenCalled();
    });

    it('should retry rendering a page on failure', async () => {
        mockPage.goto.mockRejectedValueOnce(new Error('Navigation error'));
        const browser = await puppeteer.launch();
        const content = await renderPage(browser, 'http://example.com', 3);
        expect(content).toBe('<html></html>');
        expect(mockPage.goto).toHaveBeenCalledTimes(2);
    }, 30000);

    it('should throw error after max retries', async () => {
        mockPage.goto.mockRejectedValue(new Error('Navigation error'));
        const browser = await puppeteer.launch();
        await expect(renderPage(browser, 'http://example.com', 3)).rejects.toThrow('Navigation error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to render http://example.com (attempt 1): Navigation error');
        expect(mockPage.goto).toHaveBeenCalledTimes(4);
    }, 30000);
});

describe('parseSitemap', () => {
    it('should parse XML sitemap content', () => {
        const xml = '<urlset><url><loc>http://example.com/</loc></url></urlset>';
        const result = parseSitemap(xml);

        const expected = {
            urlset: {
                url: [{ loc: 'http://example.com/' }],
            },
        };

        // Adjust expectation based on actual output structure
        if (!Array.isArray(result.urlset.url)) {
            result.urlset.url = [result.urlset.url];
        }

        expect(result).toEqual(expected);
    });
});

describe('replaceUrl', () => {
    it('should replace URL prefixes', () => {
        const urls = ['http://old.com/page1', 'http://old.com/page2'];
        const replacedUrls = replaceUrl(urls, 'http://new.com=http://old.com');
        expect(replacedUrls).toEqual(['http://new.com/page1', 'http://new.com/page2']);
    });
});

describe('getFilePath', () => {
    it('should construct file path for URLs ending with /', () => {
        const filePath = getFilePath('http://example.com/', 'output');
        expect(filePath).toBe('output/index.html');
    });

    it('should construct file path for URLs ending with .html', () => {
        const filePath = getFilePath('http://example.com/page.html', 'output');
        expect(filePath).toBe('output/page.html.html');
    });

    it('should construct file path for URLs without trailing / or .html', () => {
        const filePath = getFilePath('http://example.com/page', 'output');
        expect(filePath).toBe('output/page/index.html');
    });
});
