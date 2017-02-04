var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

chai.use(sinonChai);

function noop() {}

// console.warn = noop;

global.window = {};
global.navigator = { userAgent: 'ua' };
global.document = {
  referrer: 'http://example.com',
  location: {
    host: 'test.com',
    pathname: '/test',
    search: '?test=true',
    hash: '#snoo',
  },
  createElement: function() {
    return {
      host: 'example.com',
    };
  },
  getElementsByTagName: function() {
    return [{
      getAttribute: function() {
        return 'en';
      },
    }];
  },
};

var EventTracker = require('../index.js');


function calculateHash (key, string) {
  return key;
}

describe('EventTracker', function() {
  afterEach(function() {
    // reset env
    process.env.NODE_ENV = 'test';
    delete process.env.EVENT_TRACKER_KEY;
    delete process.env.EVENT_TRACKER_SECRET;
    delete process.env.EVENT_TRACKER_ENDPOINT;
    delete process.env.EVENT_TRACKER_CLIENT_NAME;
  });

  describe('constructor', function() {
    it('exists', function() {
      expect(typeof EventTracker).to.equal('function');
    });

    it('throws if missing required options', function() {
      console.warn = sinon.stub();

      expect(function() {
        new EventTracker();
      }).to.throw('Missing required option `postData`.');

      expect(function() {
        new EventTracker({ postData: noop });
      }).to.throw('Missing required option `calculateHash`.');

      expect(function() {
        new EventTracker({ postData: noop, calculateHash: noop });
      }).to.not.throw();
    });

    it('it warns and puts the tracker in debug if config is missing', function() {
      console.warn = sinon.spy();

      var tracker = new EventTracker({
        postData: noop,
        calculateHash: noop,
      });

      expect(console.warn).to.have.been.called;
      expect(tracker.debug).to.be.true;
    });

    it('it uses config from `env` if defined', function() {
      console.warn = sinon.spy();

      process.env.EVENT_TRACKER_KEY = 'foo';
      process.env.EVENT_TRACKER_SECRET = 'bar';
      process.env.EVENT_TRACKER_ENDPOINT = 'http://events-example.reddit.com/v1';
      process.env.EVENT_TRACKER_CLIENT_NAME = 'eventTrackerTests';

      var tracker = new EventTracker({
        postData: noop,
        calculateHash: noop,
        debug: false,
      });

      expect(console.warn).to.not.have.been.called;
      expect(tracker.debug).to.be.false;
    });

    it('it uses debug mode when `NODE_ENV` isn\'t prod', function() {
      console.warn = sinon.spy();

      process.env.NODE_ENV = 'test';

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: noop,
      });

      expect(console.warn).to.not.have.been.called;
      expect(tracker.debug).to.be.true;
    });

    it('it uses production mode when `NODE_ENV` is prod', function() {
      console.warn = sinon.spy();

      process.env.NODE_ENV = 'production';

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: noop,
      });

      expect(console.warn).to.not.have.been.called;
      expect(tracker.debug).to.be.false;
    });

    it('uses defaults if not passed in', function() {
      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: noop,
      });
      expect(tracker.bufferTimeout).to.equal(100);
      expect(tracker.bufferLength).to.equal(40);
    });

    it('overrides defaults if passed in', function() {
      var timeout = 10;
      var length = 5;

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: noop,
        bufferTimeout: timeout,
        bufferLength: length,
      });

      expect(tracker.bufferTimeout).to.equal(timeout);
      expect(tracker.bufferLength).to.equal(length);
    });
  });

  describe('tracking', function() {
    it('adds guid and timestamp to the data', function() {
      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: calculateHash,
        bufferTimeout: 0,
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track('topic', 'type');

      expect(stub).to.have.been.calledOnce;

      var args = stub.getCall(0).args[0];

      expect(args.uuid).to.not.be.undefined;
      expect(args.event_ts).to.not.be.undefined;
      expect(args.payload.utc_offset).to.not.be.undefined;
      stub.restore();
    });

    it('formats the data', function() {
      var topic = 'topic';
      var type = 'type';
      var appName = 'appName';

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: calculateHash,
        bufferTimeout: 0,
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track(topic, type);

      var args = stub.getCall(0).args[0];

      expect(args.event_topic).to.equal(topic);
      expect(args.event_type).to.equal(type);
      expect(typeof args.payload).to.equal('object');
      stub.restore();
    });

    it('appends client context if configured as true', function() {
      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: calculateHash,
        bufferTimeout: 0,
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track('topic', 'type');

      expect(stub).to.have.been.calledOnce;

      var args = stub.getCall(0).args[0];

      expect(args.payload.user_agent).to.equal(global.navigator.userAgent);
      expect(args.payload.domain).to.equal(global.document.location.host);
      expect(args.payload.base_url)
        .to.equal(global.document.location.pathname + global.document.location.search + global.document.location.hash);
      stub.restore();
    });

    it('does not append client context if configured as false', function() {
      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: noop,
        calculateHash: calculateHash,
        bufferTimeout: 0,
        appendClientContext: false,
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track('topic', 'type');

      expect(stub).to.have.been.calledOnce;

      var args = stub.getCall(0).args[0];

      expect(args.user_agent).to.be.undefined;
      expect(args.domain).to.be.undefined;
      expect(args.path).to.be.undefined;
      stub.restore();
    });

    it('adds events to the buffer', function() {
      var topic = 'topic';
      var type = 'type';
      var uuid = 'uuid';

      var payload = {
        uuid: uuid,
      };

      var tracker = new EventTracker({
        postData: noop,
        calculateHash: calculateHash,
        bufferTimeout: 0,
      });

      var data = tracker._buildData(topic, type, payload);
      tracker.track(topic, type, payload);

      expect(tracker.buffer.length).to.equal(1);
      expect(tracker.buffer[0]).to.deep.equal(data);
    });

    it('sends if the buffer is full', function() {
      var postStub = sinon.stub();

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: postStub,
        calculateHash: calculateHash,
        bufferLength: 3,
        debug: false,
      });

      tracker.track('event', 'topic');
      expect(postStub).to.not.have.been.called;

      tracker.track('event', 'topic');
      expect(postStub).to.not.have.been.called;

      tracker.track('event', 'topic');
      expect(postStub).to.have.been.called;
    });

    it('sends if the buffer times out', function(done) {
      var url = 'url';
      var postStub = sinon.stub();
      var timeout = 20;

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: postStub,
        calculateHash: calculateHash,
        bufferLength: 3,
        bufferTimeout: timeout,
        debug: false,
      });

      tracker.track('event', 'topic');
      expect(postStub).to.not.have.been.called;

      setTimeout(function() {
        expect(postStub).to.have.been.called;
        done();
      }, timeout + 10);
    });

    it('resets the timer after sending', function() {
      var postStub = sinon.stub();
      var timeout = 20;

      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: postStub,
        calculateHash: calculateHash,
        bufferLength: 3,
        bufferTimeout: timeout,
        debug: false,
      });

      tracker.track('event', 'topic');
      expect(postStub).to.not.have.been.called;

      setTimeout(function() {
        expect(postStub).to.have.been.calledOnce;
        tracker.track('event', 'topic');

        setTimeout(function() {
          expect(postStub).to.have.been.calledTwice;
          done();
        }, timeout + 10);
      }, timeout + 10);
    });
  });

  describe('posting', function() {
    it('posts proper parameters', function() {
      var postStub = sinon.stub();
      var tracker = new EventTracker({
        key: 'foo',
        secret: 'bar',
        clientName: 'foobar',
        endpoint: 'http://events-example.reddit.com/v1',
        postData: postStub,
        calculateHash: calculateHash,
        bufferLength: 1,
        bufferTimeout: 0,
        debug: false,

      });

      tracker.track('event', 'topic');
      var args = postStub.getCall(0).args[0];

      expect(args.url).to.equal('http://events-example.reddit.com/v1?key=foo&mac=bar');
      expect(args.data).to.be.a('string');
      expect(JSON.parse(args.data)).to.be.a('array');
      expect(args.headers['Content-Type']).to.equal('text/plain');
    });

    describe('url', function() {
      it('appends query data to the specified endpoint if a query exists', function() {
        var postStub = sinon.stub();
        var tracker = new EventTracker({
          key: 'foo',
          secret: 'bar',
          clientName: 'foobar',
          endpoint: 'http://events-example.reddit.com/v1?feature=test',
          postData: postStub,
          calculateHash: calculateHash,
          bufferLength: 1,
          bufferTimeout: 0,
          debug: false,

        });

        tracker.track('event', 'topic');
        var args = postStub.getCall(0).args[0];

        expect(args.url).to.equal('http://events-example.reddit.com/v1?feature=test&key=foo&mac=bar');
      });

      it('encodes the query data if needed', function() {
        var postStub = sinon.stub();
        var tracker = new EventTracker({
          key: '?foo',
          secret: 'bar',
          clientName: 'foobar',
          endpoint: 'http://events-example.reddit.com/v1?feature=test',
          postData: postStub,
          calculateHash: calculateHash,
          bufferLength: 1,
          bufferTimeout: 0,
          debug: false,

        });

        tracker.track('event', 'topic');
        var args = postStub.getCall(0).args[0];

        expect(args.url).to.equal('http://events-example.reddit.com/v1?feature=test&key=%3Ffoo&mac=bar');
      });
    });
  });
});
