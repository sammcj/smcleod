---
title: Applying syntax in Sublime based on the first file line
published: true
date: 2017-10-25
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-code
---

In vim, you can add a comment at the top of files to set the syntax, e.g.:

{% highlight shell %}
# vim: syntax=ruby
{% endhighlight %}

In SublimeText there are _many_ ways to detect syntax, one interesting approach I've recently found useful is to match on the top line in the file.
For example, with Puppet there is a file called `Puppetfile`, it has no extension but it's really Ruby syntax, so it's useful to add linting incase you
miss something simple like a `,` and break deployments.

I use a plugin called [syntaxmgr](https://github.com/randy3k/SyntaxManager) which extends syntax management, I believe you can do this in the languages syntax without the plugin but YMMV:

{% highlight json %}
{
    "syntaxmgr_settings":[
        {
            // apply this setting when first line matches
            "first_line_match": ["/.*syntax=ruby/sh"],
            "settings": {
                // the syntax can be identified by running
                //
                //     view.settings().get("syntax")
                //
                // at sublime console (ctrl + ` )
                //
                "syntax" : "Packages/Ruby/Ruby.sublime-syntax"
            }
        },
    ]
}
{% endhighlight %}

At the top of your `Puppetfile`, simple add:

{% highlight ruby%}
# vim: syntax=ruby
{% endhighlight %}

And your `Puppetfile` will get the correct highlighting (and linting) in both vim and SublimeText.