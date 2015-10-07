!function(global) {
  'use strict';

  var now = global.performance ? performance.now || Date.getTime;

  function generateUUID(){
    var d = now();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
  }

  function EventTracker(key, post, url, clientName, config) {
    this.userId = config.userId;

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

    var appendClientContext =
      typeof config.appendClientContext === 'undefined' ? true : config.appendClientContext;

    if (appendClientContext) {
      this.clientContext = this._buildClientContext();
    }


    this.bufferTimeout = config.bufferTimeout || 100;
    this.bufferLength = config.bufferLength || 40;
    this.buffer = [];
  }

  // Send an event topic (such as `mod_events`), a type (such as `ban`), and
  // an optional data payload.
  EventTracker.prototype.track = function trackEvent (topic, type, payload) {
    var data = {
      event_topic: topic,
      event_type: this.clientName + '.' + type,
      event_ts: (new Date().getTime() / 1000),
      uuid: uuid(),
      payload: payload || {},
    };

    if (this.clientContext) {
      for (var c in this.clientContext) {
        data[c] = this.clientContext[c];
      }
    }

    this._buffer(data);
  };

  EventTracker.prototype.send = function send() {
    if (this.buffer.length) {
      this.post(this.buffer);
      this.buffer = [];
      this._resetTimer();
    }
  }

  EventTracker.prototype._buffer = function buffer(data) {
    this.buffer.push(data);

    if (this.buffer.length >= this.bufferLength) {
      this.send();
    } else if (!this.timer) {
      this._resetTimer();
    }
  }

  EventTracker.prototype._resetTimer = function resetTimer() {
    if (this.timer) {
      global.clearTimeout(this.timer);
    }

    var tracker = this;
    this.timer = global.setTimeout(function() {
      tracker.send();
    }, this.bufferTimeout);
  }

  EventTracker.prototype.buildClientContext = function buildClientContext () {
    return {
      user_agent: navigator.userAgent,
      domain: document.location.host,
    }
  }

  // Handle npm modules and window globals
  if (typeof module !== 'undefined') {
    module.exports = EventTracker;
  } else {
    global.EventTracker = EventTracker;
  }
}(this);
