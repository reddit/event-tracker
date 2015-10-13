var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

chai.use(sinonChai)

global.window = {};
global.navigator = { userAgent: 'ua' };
global.document = {
  location: {
    host: 'test.com',
    pathname: '/test',
    search: '?test=true'
  }
};

var EventTracker = require('../index.js');

describe('EventTracker', function() {
  describe('constructor', function() {
    it('exists', function() {
      expect(typeof EventTracker).to.equal('function');
    });

    it ('throws if missing required config', function() {
      expect(function() {
        new EventTracker()
      }).to.throw(/missing key/i);

      expect(function() {
        new EventTracker('key')
      }).to.throw(/missing post/i);

      expect(function() {
        new EventTracker('key', function(){})
      }).to.throw(/missing url/i);

      expect(function() {
        new EventTracker('key', function(){}, 'url')
      }).to.throw(/missing clientName/i);

      expect(function() {
        new EventTracker('key', function(){}, 'url', 'clientName', { })
      }).to.not.throw();
    });

    it('uses defaults if not passed in', function() {
      var tracker = new EventTracker('key', function(){}, 'url', 'clientName', { });
      expect(tracker.bufferTimeout).to.equal(100);
      expect(tracker.bufferLength).to.equal(40);
    });

    it('overrides defaults if passed in', function() {
      var timeout = 10;
      var length = 5;

      var tracker = new EventTracker('key', function(){}, 'url', 'clientName', {
        bufferTimeout: timeout,
        bufferLength: length
      });

      expect(tracker.bufferTimeout).to.equal(timeout);
      expect(tracker.bufferLength).to.equal(length);
    });
  });

  describe('tracking', function() {
    it('adds guid and timestamp to the data', function() {
      var tracker = new EventTracker('key', function(){}, 'url', 'clientName', {
        bufferTimeout: 0
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track('topic', 'type');

      expect(stub).to.have.been.calledOnce;

      var args = stub.getCall(0).args[0];

      expect(args.uuid).to.not.be.undefined;
      expect(args.event_ts).to.not.be.undefined;
      expect(args.utc_offset).to.not.be.undefined;
      stub.restore();
    });

    it('formats the data', function() {
      var topic = 'topic';
      var type = 'type';
      var clientName = 'clientName';

      var tracker = new EventTracker('key', function(){}, 'url', clientName, {
        bufferTimeout: 0
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track(topic, type);

      var args = stub.getCall(0).args[0];

      expect(args.event_topic).to.equal(topic);
      expect(args.event_type).to.equal(clientName + '.' + type);
      expect(typeof args.payload).to.equal('object');
      stub.restore();
    });

    it('appends client context if configured as true', function() {
      var tracker = new EventTracker('key', function(){}, 'url', 'clientName', {
        bufferTimeout: 0
      });

      var stub = sinon.stub(EventTracker.prototype, '_buffer');
      tracker.track('topic', 'type');

      expect(stub).to.have.been.calledOnce;

      var args = stub.getCall(0).args[0];

      expect(args.user_agent).to.equal(global.navigator.userAgent);
      expect(args.domain).to.equal(global.document.location.host);
      expect(args.path).to.equal(global.document.location.pathname + global.document.location.search);
      stub.restore();
    });

    it('does not append client context if configured as false', function() {
      var tracker = new EventTracker('key', function(){}, 'url', 'clientName', {
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
      var clientName = 'clientName';
      var uuid = 'uuid';

      var payload = {
        uuid: uuid,
      }

      var tracker = new EventTracker('key', function(){}, 'url', clientName, {
        bufferTimeout: 0
      });

      var data = tracker._buildData(topic, type, payload);
      tracker.track(topic, type, payload);

      expect(tracker.buffer.length).to.equal(1);
      expect(tracker.buffer[0]).to.deep.equal(data);
    });

    it('sends if the buffer is full', function() {
      var url = 'url';
      var postStub = sinon.stub();

      var tracker = new EventTracker('key', postStub, url, 'clientName', {
        bufferLength: 3
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

      var tracker = new EventTracker('key', postStub, url, 'clientName', {
        bufferLength: 3,
        bufferTimeout: timeout
      });

      tracker.track('event', 'topic');
      expect(postStub).to.not.have.been.called;

      setTimeout(function() {
        expect(postStub).to.have.been.called;
        done();
      }, timeout + 10);
    });

    it('resets the timer after sending', function() {
      var url = 'url';
      var postStub = sinon.stub();
      var timeout = 20;

      var tracker = new EventTracker('key', postStub, url, 'clientName', {
        bufferLength: 3,
        bufferTimeout: timeout
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
});
