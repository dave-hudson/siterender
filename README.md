# siterender

siterender is a Node.js application that renders web pages listed in a sitemap and saves the rendered HTML
content to a specified output directory.  This tool is particularly useful for static site generation, web
scraping, and ensuring content is pre-rendered for SEO and social media sharing purposes.

The application is unusual as all the code was "written" by ChatGPT 4o.  Some interactive work was required
to get the source code into its current form, but you can see the original prompt in the file
[prompt/siterender.prompt](./prompt/siterender.prompt)

## Features

- Fetches and parses sitemaps from URLs or local files.
- Supports nested sitemaps.
- Replaces URL prefixes based on specified rules.
- Renders pages in parallel using Puppeteer.
- Parallelizes rendering operations for maximum speed/throughput.
- Saves rendered HTML content to specified output directory.
- Retry mechanism for rendering and browser launch/close operations.

## Project site

For more information please see the project site:
[https://davehudson.io/projects/siterender](https://davehudson.io/projects/siterender).
