Behold, the Event Tracker
=========================

[![Build Status](https://travis-ci.org/reddit/event-tracker.svg?branch=master)](https://travis-ci.org/reddit/event-tracker)

Usage:

```javascript
// key, ajax post, and url are required; config object is optional.
// default config object options are shown below.

var tracker = new EventTracker(
  'abcdef==', // tracker key
  jQuery.post, // function to use for ajax: `post(url, data)`
  'https://events-test.redditmedia.com/v1', // collector endpoint
  'desktopWeb', // client name, prepended to event type in payload
  calculateHash, // a function that takes (key, string) and returns an HMAC
  {
    appendClientContext: true, // automatically adds user_agent, path, and domain to payload
    bufferTimeout: 100, // flush buffer of events after 100ms
    bufferLength: 40, // flush buffer events after buffer length is 40
  }
);

tracker.track('mod_events', 'ban', {
  user_name: 'allthefoxes',
  user_id: 't2_8aioi',
  sr_name: 'noadmins',
  sr_id: 't5_2xakt',
  details_text: 'reason: being an admin',
  target_id: 't2_3bzrh',
  target_name: 'ajacksified',
  target_type: 'user',
}, defaults);

// send immediately rather than buffering. Without calling `send()`, the event
// will be sent after buffer timeout (100ms) or buffer max length (40) is
// reached. `send` flushes the current buffer of events and resets the timer.
// send optionally takes a callback.
tracker.send(callback);
```

See [this wiki page](https://reddit.atlassian.net/wiki/pages/viewpage.action?pageId=19267594)
for some examples of payload data. `user_agent` and `domain` are automatically
added to payload data if `appendClientContext` is true.

## Testing

* Install node
* Run `npm test`

## Using It

* Either use it as a git-linked NPM package, copypaste it into your project, or
  git-submodule it.
