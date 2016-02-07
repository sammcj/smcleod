## source for smcleod.net website

Sam's personal blog of ramblings

If I've added you as a contributor to this private repo it's probably because I suck at css/js and such things, feel free to log issues, enhancements, or submit PRs.

## Previewing / Testing

```
git clone git@github.com:sammcj/smcleod.git
cd smcleod
bundle install
jekyll serve
```

## Releasing

Requires s3 API keys etc...

```
./deploy_s3.sh
```

## Points of note

- Based off https://github.com/daattali/beautiful-jekyll
  - Converted to Jekyll 3
  - Updated bootstrap
  - Moved external font and bootstrap deps to local repo
- Currently hosted off s3, might move to GH pages now that they support Jekyll 3
- Sits behind Cloudflare
