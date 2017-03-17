!function(global) {
  'use strict';

  function logEvent(data) {
    var eventTopics = data.map(function(e) { return e.event_topic; }).join(', ');

    console.info('Tracking ' + eventTopics + ' with data:', data);
  }

  function parseUrl(url) {
    var parser = document.createElement('a');

    parser.href = url;

    return {
      href: parser.href,
      protocol: parser.protocol,
      host: parser.host,
      hostname: parser.hostname,
      port: parser.port,
      pathname: parser.pathname,
      search: parser.search,
      hash: parser.hash,
      origin: parser.origin,
    };
  }

  // Stub out `now` so we can use a more precise number in uuid generation, if
  // available.
  function now() {
    if (global.performance && typeof global.performance.now === 'function') {
      return global.performance.now();
    } else if (typeof Date.now === 'function') {
      return Date.now();
    } else {
      return (new Date()).getTime();
    }
  }

  // Pulled from elsewhere
  function uuid() {
    var d = now();

    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    return id;
  }

  /**
   * Create a new event tracker.
   *
   * @param {Object} options - The tracker configuration options.
   * @param {string} options.key - The name of the secret key you must have to send events, like 'Test1'
   * @param {string} options.secret - The secret key you must have to send events, like 'ab42sdfsafsc'
   * @param {string} options.endpoint - The url of the events endpoint, like 'https://stats.redditmedia.com/events'
   * @param {string} options.clientName - The name of your client app, like 'Alien Blue'
   * @param {function} options.postData - A function which makes a POST request using the
   *    arguments ({url, data, headers, done}). Simply wrap `window.fetch`, `jQuery.ajax`, etc.
   * @param {function} options.calculateHash - A function that takes (key, string) and returns an HMAC
   * @param {number} options.bufferTimeout - An integer, after which ms, the buffer of events is sent
   *    to the `postData` function; Defaults to 100.
   * @param {number} options.bufferLength - An integer, after which the buffer contains this many
   *    items, the buffer of events is sent to the `postData` function; Defaults to 40.
   * @param {function} options.appendClientContext - Whether or not the tracker adds the follow client data
   *    to each event: { user_agent, domain, base_url, referrer_domain, referrer_url, language } 
   * @param {boolean} options.debug - Whether or not the tracker should actually send events or just log them.
   **/
  function EventTracker(options) {
    options = options || {};

    var key = options.key || process.env.TRACKER_KEY;
    var secret = options.secret || process.env.TRACKER_SECRET;
    var endpoint = options.endpoint || process.env.TRACKER_ENDPOINT;
    var clientName = options.clientName || process.env.TRACKER_CLIENT_NAME;

    this.debug = typeof options.debug === 'undefined' ?
      process.env.NODE_ENV !== 'production' : options.debug;

    if (!key) {
      console.warn('Missing required option `key`; forcing debug mode on.');
      this.debug = true;
    } else {
      this.key = key;
    }

    if (!secret) {
      console.warn('Missing required option `secret`; forcing debug mode on.');
      this.debug = true;
    } else {
      this.secret = secret;
    }

    if (!endpoint) {
      console.warn('Missing required option `endpoint`; forcing debug mode on.');
      this.debug = true;
    } else {
      this.endpoint = endpoint;
    }

    if (!clientName) {
      console.warn('Missing required option `clientName`; forcing debug mode on.');
      this.debug = true;
    } else {
      this.clientName = clientName;
    }

    if (!options.postData) {
      throw('Missing required option `postData`.');
    }

    this.postData = options.postData;

    if (!options.calculateHash) {
      throw('Missing required option `calculateHash`.');
    }

    this.calculateHash = options.calculateHash;

    if (typeof window !== 'undefined') {
      this.appendClientContext =
        typeof options.appendClientContext === 'undefined' ? true : options.appendClientContext;
    }

    this.bufferTimeout = options.bufferTimeout || 100;
    this.bufferLength = options.bufferLength || 40;
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
   * done: optional callback to fire on complete.
   */
  EventTracker.prototype.send = function send(done) {
    if (this.buffer.length) {
      if (this.debug) {
        return logEvent(this.buffer);
      }

      var url = this.endpoint +
        (this.endpoint.indexOf('?') === -1 ? '?' : '&') +
        'key=' + encodeURIComponent(this.key) +
        '&mac=' + encodeURIComponent(this.calculateHash(this.secret, data));
      var data = JSON.stringify(this.buffer);

      this.postData({
        url: url,
        data: data,
        headers: {
          'Content-Type': 'text/plain',
        },
        done: done || function() {},
      });

      this.buffer = [];
    }
  };

  /*
   * Internal. Formats a payload to be sent to the event tracker.
   */
  EventTracker.prototype._buildData = function buildData (topic, type, payload) {
    var now = new Date();

    var data = {
      event_topic: topic,
      event_type: type,
      event_ts: now.getTime(),
      uuid: payload.uuid || uuid(),
      payload: payload,
    };

    data.payload.app_name = this.clientName;
    data.payload.utc_offset = now.getTimezoneOffset() / -60;

    if (this.appendClientContext) {
      var clientContext = this._buildClientContext();
      for (var c in clientContext) {
        data.payload[c] = clientContext[c];
      }
    }

    return data;
  };

  /*
   * Internal. Adds events to the buffer, and flushes if necessary.
   */
  EventTracker.prototype._buffer = function buffer(data) {
    this.buffer.push(data);

    if (this.buffer.length >= this.bufferLength || !this.bufferTimeout) {
      this.send();
    } else if (this.bufferTimeout && !this.timer) {
      this._resetTimer();
    }
  };

  /*
   * Internal. Resets the buffer timeout.
   */
  EventTracker.prototype._resetTimer = function resetTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    var tracker = this;
    this.timer = setTimeout(function() {
      tracker.send();
      tracker.timer = undefined;
    }, this.bufferTimeout);
  };

  /*
   * Internal. Adds certain browser-based properties to the payload if
   * configured to do so.
   */
  EventTracker.prototype._buildClientContext = function buildClientContext () {
    return {
      user_agent: navigator.userAgent,
      domain: document.location.host,
      base_url: document.location.pathname + document.location.search + document.location.hash,
      referrer_domain: parseUrl(document.referrer).host,
      referrer_url: document.referrer,
      language: document.getElementsByTagName('html')[0].getAttribute('lang'),
    };
  };

  // Handle npm modules and window globals
  if (typeof module !== 'undefined') {
    module.exports = EventTracker;
  } else {
    global.EventTracker = EventTracker;
  }
}(typeof global !== 'undefined' ? global : this);
