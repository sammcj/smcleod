---
title: "Confuddlement: Download Confluence Spaces as Markdown"
date: 2024-05-23T05:45:10+00:00
# weight: 1
# aliases: ["/first"]
tags: ["Confluence", "Markdown", "Go", "Golang"]
author: "Sam McLeod"
showToc: true
TocOpen: false
draft: false
hidemeta: false
comments: false
description: "Download Confluence Spaces as Markdown"
# canonicalURL: "https://canonical.url/to/page"
disableShare: false
disableHLJS: false
hideSummary: false
searchHidden: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowRssButtonInSectionTermList: true
UseHugoToc: true
# cover:
#     image: "https://github.com/sammcj/confuddlement/screenshots/screenshot.png?raw=true" # image path/url
#     alt: : "placeholder"
#     caption: "placeholder"
#     relative: true
#     hidden: false
---

- [Confuddlement on Github](https://github.com/sammcj/confuddlement)

I was tired of manually downloading Confluence pages and converting them to Markdown, so I wrote a small command-line tool designed to simplify this process.

Confuddlement is a Go-based tool that uses the Confluence REST API to fetch page content and convert it to Markdown files.

```plain
$ go run ./main.go

Confuddlement 0.2.0
Spaces: [COOLTEAM, MANAGEMENT]
Fetching content from space COOLTEAM

COOLTEAM (Totally Cool Team Homepage)
Retrospectives
Decision log
Development Onboarding
Saved page COOLTEAM - Feature List to ./confluence_dump/COOLTEAM - Feature List.md
Skipping page 7. Support, less than 300 characters

MANAGEMENT (Department of Overhead and Bureaucracy)
Painful Change Management
Illogical Diagrams
Saved page ./confluence_dump/Painful Change Management.md
Saved page Illogical Diagrams to ./confluence_dump/Ilogical Diagrams.md
```

## Usage

### Running the Program

1. Copy [.env.template](.env.template) to `.env` and update the environment variables.
2. Run the program using the command `go run main.go` or build the program using the command `go build` and run the resulting executable.
3. The program will fetch Confluence pages and save them as Markdown files in the specified directory.

<!--more-->

### Environment Variables

**Customisation options**

Confuddlement has several customisation options:

- Setting the directory where Markdown files will be saved
- Specifying the number of pages to fetch per API request
- Defining the minimum length of a page to be considered valid
- Skipping pages that have already been fetched

The following environment can be set to configure the program:

> - `CONFLUENCE_DUMP_DIR`: The directory where the Markdown files will be saved.
> - `CONFLUENCE_LIMIT`: The number of pages to fetch per API request.
> - `CONFLUENCE_BASE_URL`: The base URL of the Confluence instance.
> - `CONFLUENCE_USER`: The username to use for API authentication.
> - `CONFLUENCE_SPACES`: The space keys to fetch pages from, separated by commas.
> - `CONFLUENCE_API_TOKEN`: The API token to use for authentication.
> - `DELETE_PREVIOUS_DUMP`: Set to `true` to delete the previous dump directory (and state) before fetching pages.
> - `MIN_PAGE_LENGTH`: The minimum length of a page to be considered valid.
> - `SKIP_FETCHED_PAGES`: Set to `true` to skip pages that have already been fetched.
> - `DEBUG`: Set to `true` to enable debug logging.

[Confuddlement](https://github.com/sammcj/confuddlement)
