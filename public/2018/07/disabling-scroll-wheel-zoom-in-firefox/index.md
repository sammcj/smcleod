# Disabling scroll-wheel zoom in Firefox


This feature annoys me endlessly, I end up zoomed in and out of websites all over the internet.
... But the fix is easy and there's no addons required.

1. Navigate to `about:config` (in Firefox's URL bar)
2. Change the value of the following two properties to `0`:

```
mousewheel.with_control.action
mousewheel.with_meta.action
```

If you use Firefox sync and want these settings to sync between your machines, also add the following properties:

Create two *new* properties both of type `boolean` and set them to `true`:

```
services.sync.prefs.sync.mousewheel.with_meta.action
services.sync.prefs.sync.mousewheel.with_control.action
```

Enjoy!

