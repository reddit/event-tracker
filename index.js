!function(global) {
  'use strict';

  // Aggressively match any non-numeric or alphebetic character. Also catches
  // utf8, which is probably for the best.
  var CLIENT_NAME_INVALID_CHARACTERS = /[^A-Za-z0-9]/;

  // Stub out `now` so we can use a more precise number in uuid generation, if
  // available.
  function now() {
    return global.performance ? global.performance.now() : (new Date()).getTime();
  }

  // Pulled from elsewhere
  function uuid(){
    var d = now();

    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    return id;
  }

  /*
   * Create a new event tracker.
   *
   * key: the secret key you must have to send events, like 'ab42sdfsafsc'
   * post: a function with the args (url, data). The body should send the data.
   *   you'll probably do something like pass in `jQuery.post`, or a superagent
   *   wrapper.
   * url: the url of the events endpoint, like 'https://stats.redditmedia.com/events'
   * clientName: the name of your client, like 'mweb'
   * config: an object containing optional configuration, such as:
   *   bufferTimeout: an integer, after which ms, the buffer of events is sent
   *     to the `post` function;
   *   bufferLength: an integer, after which the buffer contains this many
   *     items, the buffer of events is sent to the `post` function;
   */
  function EventTracker(key, post, url, clientName, config) {
    config = config || {};

    if (!key) {
      throw('Missing key; pass in event client key as the first argument.');
    }

    this.key = key;

    if (!post) {
      throw('Missing post function; pass in ajax post function as the second argument.');
    }

    this.post = post;

    if (!url) {
      throw('Missing url to post to; pass in url as the third argument.');
    }

    this.url = url;

    if (!clientName) {
      throw('Missing clientName; pass in clientName as the third argument.');
    }

    this.clientName = clientName;

    if (typeof window !== 'undefined') {
      this.appendClientContext =
        typeof config.appendClientContext === 'undefined' ? true : config.appendClientContext;
    }

    this.bufferTimeout = config.bufferTimeout || 100;
    this.bufferLength = config.bufferLength || 40;
    this.buffer = [];
  }

  /*
   * Add an event to the buffer.
   *
   * topic: an event topic (such as `mod_events`)
   * type: an event type for your topic (such as `ban)
   * data payload: extra data, send whatever your heart desires
   */
  EventTracker.prototype.track = function trackEvent (topic, type, payload) {
    var data = this._buildData(topic, type, payload || {});
    this._buffer(data);
  };

  /*
   * Immediately flush the buffer. Called internally as well during buffer
   * timeout.
   */
  EventTracker.prototype.send = function send() {
    if (this.buffer.length) {
      this.post(this.url, this.buffer);
      this.buffer = [];
    }

    this._resetTimer();
  };

  EventTracker.prototype._validateClientName = function validateClientName(name) {
    if (CLIENT_NAME_INVALID_CHARACTERS.test(name)) {
      throw('Invalid client name, please use only letters or numbers', name);
    }
  }

  /*
   * Internal. Formats a payload to be sent to the event tracker.
   */
  EventTracker.prototype._buildData = function buildData (topic, type, payload) {
    var clientName = this.clientName;
    var now = new Date();

    var data = {
      event_topic: topic,
      event_type: clientName + '.' + type,
      event_ts: now.getTime() / 1000,
      utc_offset: now.getTimezoneOffset(),
      uuid: payload.uuid || uuid(),
      payload: payload,
    };

    if (this.appendClientContext) {
      var clientContext = this._buildClientContext();
      for (var c in clientContext) {
        data[c] = clientContext[c];
      }
    }

    return data;
  };

  /*
   * Internal. Adds events to the buffer, and flushes if necessary.
   */
  EventTracker.prototype._buffer = function buffer(data) {
    this.buffer.push(data);

    if (this.buffer.length >= this.bufferLength) {
      this.send();
    } else if (this.bufferTimeout && !this.timer) {
      this._resetTimer();
    }
  }

  /*
   * Internal. Resets the buffer timeout.
   */
  EventTracker.prototype._resetTimer = function resetTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    var tracker = this;
    this.timer = setTimeout(function() {
      tracker.send();
    }, this.bufferTimeout);
  }

  /*
   * Internal. Adds certain browser-based properties to the payload if
   * configured to do so.
   */
  EventTracker.prototype._buildClientContext = function buildClientContext () {
    return {
      user_agent: navigator.userAgent,
      domain: document.location.host,
      path: document.location.pathname + document.location.search,
    }
  }

  // Handle npm modules and window globals
  if (typeof module !== 'undefined') {
    module.exports = EventTracker;
  } else {
    global.EventTracker = EventTracker;
  }
}(this);
