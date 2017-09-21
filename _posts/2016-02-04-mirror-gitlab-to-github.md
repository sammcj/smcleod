---
title: Mirroring a Gitlab project to Github
date: 2016-02-04
categories: tech
layout: post-sidebar
author_name : Sam McLeod
author_url : /author/sam
author_avatar: sam
author_avatar: sam
# show_related_posts: true
show_avatar : false
feature_image: backdrop-austria

---

Let's pretend you have a project on Gitlab called `ask-izzy` and you want to mirror it up to Gitlab which is located at https://github.com/ask-izzy/ask-izzy

Assuming you're running Gitlab as the default user of `git` and that your repositories are stored in `/mnt/repositories` you can following something similar to the following instructions:

1. Grant write access to Github

Get your Gitlab install's pubkey from the git user

{% highlight bash %}
cat /home/git/.ssh/id_rsa.pub
{% endhighlight %}

On Github add this pubkey as deploy key on the repo, make sure you tick the option to allow write access.

2. Add a post-recieve hook to the Gitlab project

{% highlight bash %}
mkdir /mnt/repositories/developers/ask-izzy.git/custom_hooks/
echo "exec git push --quiet github &" > \
    /mnt/repositories/developers/ask-izzy.git/custom_hooks/post-receive
chown -R git:git /mnt/repositories/developers/ask-izzy.git/custom_hooks
chmod +x /mnt/repositories/developers/ask-izzy.git/custom_hooks/post-receive
{% endhighlight %}

3. Add Github as a remote to the Gitlab project

{% highlight bash %}
cd /mnt/repositories/developers/ask-izzy.git
vi config
{% endhighlight %}

and add in the Github remote:

{% highlight bash %}
[remote "github"]
  url = git@github.com:ask-izzy/ask-izzy.git
  fetch = +refs/*:refs/*
  mirror = true
{% endhighlight %}


