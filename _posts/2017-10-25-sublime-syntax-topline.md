---
title: Applying syntax in Sublime based on the first file line
excerpt: Applying syntax in Sublime based on the first file line
date: 2017-10-25
categories: tech
author_url : /author/sam
header:
  teaser: img/backdrop-code.jpg
---

![](/img/backdrop-code.jpg)

In vim, you can add a comment at the top of files to set the syntax, e.g.:

``` shell
# vim: syntax=ruby
```

In SublimeText there are _many_ ways to detect syntax, one interesting approach I've recently found useful is to match on the top line in the file.
For example, with Puppet there is a file called `Puppetfile`, it has no extension but it's really Ruby syntax, so it's useful to add linting incase you
miss something simple like a `,` and break deployments.

I use a plugin called [ApplySyntax](https://facelessuser.github.io/ApplySyntax/) making it easy to apply syntax options to files, I believe you can do this in the languages syntax without the plugin but YMMV:

``` yaml
{
...
    // Put your custom syntax rules here:
    "syntaxes": [
        {
        "syntax": [ "Ruby/Ruby" ],
        "rules": [
                { "first_line": ".*syntax=ruby.*" }, # To match on the first line in the file
                { "file_path": "^Puppetfile$"} # Or match on the file name or path itself
            ]
        }
    ]
...
}
```
