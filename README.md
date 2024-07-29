
# siterender

siterender is a Node.js application that renders web pages listed in a sitemap and saves the rendered HTML
content to a specified output directory.  This tool is particularly useful for static site generation, web
scraping, and ensuring content is pre-rendered for SEO and social media sharing purposes.

The application is unusual as all the code was "written" by ChatGPT 4o.  Some interactive work was required
to get the source code into its current form, but you can see the original prompt in the file
prompt/siterender.prompt

## Features

- Fetches and parses sitemaps from URLs or local files.
- Supports nested sitemaps.
- Replaces URL prefixes based on specified rules.
- Renders pages in parallel using Puppeteer.
- Parallelizes rendering operations for maximum speed/throughput.
- Saves rendered HTML content to specified output directory.
- Retry mechanism for rendering and browser launch/close operations.

## Installation

Before using siterender, ensure you have Node.js installed. You can install the dependencies by running:

```sh
npm install
```

## Usage

The script can be executed from the command line with various options:

```sh
./siterender.ts [options]
```

## Options

- `--sitemap-file <path>`: Path to the local sitemap file (conflicts with `--sitemap-url`).
- `--sitemap-url <url>`: URL of the sitemap file (conflicts with `--sitemap-file`).
- `--replace-url <new=old>`: Replace URL prefixes in the form "new=old".
- `--output <path>`: Output directory (required).
- `--parallel-renders <number>`: Number of parallel renders (default is the number of CPU cores).
- `--max-retries <number>`: Max retries for rendering a page (default is 3).
- `-h, --help`: Show help message.

## Examples

### Render from a Sitemap URL

```sh
./siterender.ts --sitemap-url https://example.com/sitemap.xml --output ./output
```

### Render from a Local Sitemap File

```sh
./siterender.ts --sitemap-file ./sitemap.xml --output ./output
```

### Replace URL Prefix

```sh
./siterender.ts --sitemap-url https://example.com/sitemap.xml --replace-url "https://newdomain.com=https://olddomain.com" --output ./output
```

### Specify Parallel Renders and Max Retries

```sh
./siterender.ts --sitemap-url https://example.com/sitemap.xml --output ./output --parallel-renders 4 --max-retries 5
```

## How it Works

1. **Fetch Sitemap**: The sitemap is fetched from a URL or read from a local file.
2. **Parse Sitemap**: The XML content of the sitemap is parsed to extract URLs.
3. **URL Replacement**: If a replace rule is provided, URLs are modified accordingly.
4. **Render Pages**: Puppeteer is used to render each URL. Pages are rendered in parallel based on the specified number of parallel renders.
5. **Save Content**: The rendered HTML content is saved to the specified output directory, maintaining the directory structure of the URLs.
6. **Retry Mechanism**: The script includes retry logic for rendering pages and launching/closing the Puppeteer browser to handle transient errors.

## License

This project is licensed under a BSD 3-Clause License.

## Contributing

Suggestions are welcome, including code improvements.

## Contact

For any inquiries or issues, please contact the project maintainer.
