---
title: Mirroring a Gitlab project to Github
date: 2016-02-04
categories: tech
layout: post
author_url : /author/sam
image: img/backdrop-austria.jpg

---

Let's pretend you have a project on Gitlab called `ask-izzy` and you want to mirror it up to Gitlab which is located at https://github.com/ask-izzy/ask-izzy

Assuming you're running Gitlab as the default user of `git` and that your repositories are stored in `/mnt/repositories` you can following something similar to the following instructions:

1. Grant write access to Github

Get your Gitlab install's pubkey from the git user

```
cat /home/git/.ssh/id_rsa.pub
```

On Github add this pubkey as deploy key on the repo, make sure you tick the option to allow write access.

2. Add a post-recieve hook to the Gitlab project

```
mkdir /mnt/repositories/developers/ask-izzy.git/custom_hooks/
echo "exec git push --quiet github &" > \
    /mnt/repositories/developers/ask-izzy.git/custom_hooks/post-receive
chown -R git:git /mnt/repositories/developers/ask-izzy.git/custom_hooks
chmod +x /mnt/repositories/developers/ask-izzy.git/custom_hooks/post-receive
```

3. Add Github as a remote to the Gitlab project

```
cd /mnt/repositories/developers/ask-izzy.git
vi config
```

and add in the Github remote:

```
[remote "github"]
  url = git@github.com:ask-izzy/ask-izzy.git
  fetch = +refs/*:refs/*
  mirror = true
```


